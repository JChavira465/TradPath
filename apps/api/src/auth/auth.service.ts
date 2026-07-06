import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { PrismaService } from "../prisma/prisma.service";
import { AccountLockedException } from "../common/exceptions/account-locked.exception";
import { sha256 } from "../common/utils/crypto.util";
import { EmailService } from "../email/email.service";
import { TokenService, RefreshMeta } from "./token.service";
import { MfaService } from "./mfa.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const MAX_MFA_ATTEMPTS = 5;
const MFA_LOCKOUT_MINUTES = 15;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mfa: MfaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, meta: RefreshMeta) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      // Same generic message as any other registration failure — do not
      // reveal that the email is already taken.
      throw new BadRequestException("Unable to complete registration");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const slugBase = dto.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const { user, organization } = await this.prisma.$transaction(async (tx) => {
      let slug = slugBase || nanoid(8);
      let suffix = 0;
      // ensure slug uniqueness without leaking a separate "org exists" endpoint
      while (await tx.organization.findUnique({ where: { slug } })) {
        suffix += 1;
        slug = `${slugBase}-${suffix}`;
      }

      const organization = await tx.organization.create({
        data: { name: dto.organizationName, slug },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: "OWNER",
          organizationId: organization.id,
        },
      });

      return { user, organization };
    });

    const accessToken = this.tokens.signAccessToken(user.id);
    const refresh = await this.tokens.issueNewFamily(user.id, organization.id, meta);

    return { accessToken, refreshToken: refresh.rawToken, user, organization };
  }

  async login(dto: LoginDto, meta: RefreshMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new AccountLockedException(retryAfter);
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      const failedCount = user.failedLoginCount + 1;
      if (failedCount >= MAX_FAILED_LOGINS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil },
        });
        throw new AccountLockedException(LOCKOUT_MINUTES * 60);
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failedCount },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.isSuspended) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    this.logger.log({ event: "auth.login.success", userId: user.id, ip: meta.ipAddress });

    if (user.mfaEnabled) {
      return { mfaRequired: true as const, mfaChallengeToken: this.tokens.signMfaChallengeToken(user.id) };
    }

    const accessToken = this.tokens.signAccessToken(user.id);
    const refresh = await this.tokens.issueNewFamily(user.id, user.organizationId, meta);

    return { mfaRequired: false as const, accessToken, refreshToken: refresh.rawToken, user };
  }

  async verifyMfa(mfaChallengeToken: string, code: string, meta: RefreshMeta) {
    let userId: string;
    try {
      ({ sub: userId } = this.tokens.verifyMfaChallengeToken(mfaChallengeToken));
    } catch {
      throw new UnauthorizedException("Invalid or expired challenge");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new UnauthorizedException("Invalid or expired challenge");
    }

    if (user.mfaLockedUntil && user.mfaLockedUntil > new Date()) {
      const retryAfter = Math.ceil((user.mfaLockedUntil.getTime() - Date.now()) / 1000);
      throw new AccountLockedException(retryAfter);
    }

    const valid = this.mfa.verify(code, user.mfaSecretEncrypted);
    if (!valid) {
      const attempts = user.mfaFailedAttempts + 1;
      if (attempts >= MAX_MFA_ATTEMPTS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            mfaFailedAttempts: 0,
            mfaLockedUntil: new Date(Date.now() + MFA_LOCKOUT_MINUTES * 60 * 1000),
          },
        });
        throw new AccountLockedException(MFA_LOCKOUT_MINUTES * 60);
      }
      await this.prisma.user.update({ where: { id: user.id }, data: { mfaFailedAttempts: attempts } });
      throw new UnauthorizedException("Invalid code");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaFailedAttempts: 0, mfaLockedUntil: null, lastLoginAt: new Date() },
    });

    const accessToken = this.tokens.signAccessToken(user.id);
    const refresh = await this.tokens.issueNewFamily(user.id, user.organizationId, meta);

    return { accessToken, refreshToken: refresh.rawToken, user };
  }

  async refresh(rawToken: string, meta: RefreshMeta) {
    const { rawToken: newRawToken, user } = await this.tokens.rotateRefreshToken(rawToken, meta);
    const accessToken = this.tokens.signAccessToken(user.id);
    return { accessToken, refreshToken: newRawToken, user };
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) {
      await this.tokens.revokeByRawToken(rawToken);
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always behave the same whether or not the email exists.
    if (!user) {
      return;
    }

    const rawToken = nanoid(48);
    const tokenHash = sha256(rawToken);
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    this.logger.log({ event: "auth.password_reset.requested", userId: user.id });
    if (process.env.NODE_ENV !== "production") {
      this.logger.debug(`[dev-only] password reset token for ${email}: ${rawToken}`);
    }

    const resetUrl = `${this.config.get<string>("FRONTEND_URL")}/auth/reset-password?token=${rawToken}`;
    await this.email.send({
      to: email,
      subject: "Reset your TradPath password",
      html: `<p>We received a request to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    });
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = sha256(rawToken);
    const reset = await this.prisma.passwordReset.findUnique({ where: { tokenHash } });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // Accepting a team invite creates the User and logs them straight in —
  // structurally the same shape as register(), just sourcing the org and
  // role from a TeamInvite instead of creating a brand-new organization.
  async acceptInvite(dto: { token: string; firstName: string; lastName: string; password: string }, meta: RefreshMeta) {
    const tokenHash = sha256(dto.token);
    const invite = await this.prisma.teamInvite.findUnique({ where: { tokenHash } });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired invite");
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      throw new BadRequestException("A user with that email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: invite.role,
          organizationId: invite.organizationId,
          emailVerified: true,
        },
      });
      await tx.teamInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
      return created;
    });

    const accessToken = this.tokens.signAccessToken(user.id);
    const refresh = await this.tokens.issueNewFamily(user.id, invite.organizationId, meta);

    return { accessToken, refreshToken: refresh.rawToken, user };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const { passwordHash: _passwordHash, mfaSecretEncrypted: _mfaSecret, organization, ...safeUser } = user;
    return {
      ...safeUser,
      // Prisma's BigInt has no native JSON serializer — Number is safe here
      // (storage usage won't approach 2^53 bytes / ~9 petabytes).
      organization: organization && { ...organization, storageUsedBytes: Number(organization.storageUsedBytes) },
    };
  }

  async updatePushToken(userId: string, token: string, platform: "web" | "mobile") {
    await this.prisma.user.update({
      where: { id: userId },
      data: platform === "web" ? { pushTokenWeb: token } : { pushToken: token },
    });
  }
}
