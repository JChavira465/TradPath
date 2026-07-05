import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { AccountLockedException } from "../../common/exceptions/account-locked.exception";
import { TokenService, RefreshMeta } from "../../auth/token.service";
import { MfaService } from "../../auth/mfa.service";
import { LoginDto } from "../../auth/dto/login.dto";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const MAX_MFA_ATTEMPTS = 5;
const MFA_LOCKOUT_MINUTES = 15;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mfa: MfaService,
  ) {}

  // Step 1: password check. Super admins ALWAYS have MFA required —
  // this step never returns tokens directly, only a challenge.
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.isSuperAdmin) {
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
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) },
        });
        throw new AccountLockedException(LOCKOUT_MINUTES * 60);
      }
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: failedCount } });
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.isSuspended) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.mfaEnabled) {
      throw new ForbiddenException("MFA setup is required for admin accounts");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    return { mfaChallengeToken: this.tokens.signMfaChallengeToken(user.id) };
  }

  async verifyMfa(mfaChallengeToken: string, code: string, meta: RefreshMeta) {
    let userId: string;
    try {
      ({ sub: userId } = this.tokens.verifyMfaChallengeToken(mfaChallengeToken));
    } catch {
      throw new UnauthorizedException("Invalid or expired challenge");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isSuperAdmin || !user.mfaEnabled || !user.mfaSecretEncrypted) {
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
          data: { mfaFailedAttempts: 0, mfaLockedUntil: new Date(Date.now() + MFA_LOCKOUT_MINUTES * 60 * 1000) },
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
    if (!user.isSuperAdmin) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const accessToken = this.tokens.signAccessToken(user.id);
    return { accessToken, refreshToken: newRawToken };
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) {
      await this.tokens.revokeByRawToken(rawToken);
    }
  }
}
