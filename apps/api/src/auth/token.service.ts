import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { nanoid } from "nanoid";
import { PrismaService } from "../prisma/prisma.service";
import { sha256 } from "../common/utils/crypto.util";

export interface RefreshMeta {
  ipAddress?: string;
  userAgent?: string;
  platform: "WEB" | "MOBILE" | "ADMIN";
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId, type: "access" },
      // jsonwebtoken's types brand `expiresIn` as a template-literal type
      // (e.g. `${number}m`) rather than plain `string` — our value comes
      // from config at runtime, so it's cast rather than re-validated here.
      { expiresIn: (this.config.get<string>("JWT_ACCESS_TOKEN_TTL") ?? "15m") as never },
    );
  }

  signMfaChallengeToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId, type: "mfa_challenge" },
      { expiresIn: (this.config.get<string>("MFA_CHALLENGE_TOKEN_TTL") ?? "5m") as never },
    );
  }

  verifyMfaChallengeToken(token: string): { sub: string } {
    const payload = this.jwt.verify<{ sub: string; type: string }>(token);
    if (payload.type !== "mfa_challenge") {
      throw new UnauthorizedException("Invalid challenge token");
    }
    return payload;
  }

  // S3 — issues a brand-new refresh token family (login/register).
  async issueNewFamily(userId: string, organizationId: string, meta: RefreshMeta) {
    const familyId = nanoid(21);
    return this.issueInFamily(userId, organizationId, familyId, meta);
  }

  private async issueInFamily(
    userId: string,
    organizationId: string,
    familyId: string,
    meta: RefreshMeta,
  ) {
    const rawToken = nanoid(64);
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        organizationId,
        tokenHash,
        familyId,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        platform: meta.platform,
      },
    });

    return { rawToken, familyId, expiresAt };
  }

  // S3 — rotate on use; if the presented token was already revoked,
  // that's stolen-token reuse: kill the whole family and force re-login.
  async rotateRefreshToken(rawToken: string, meta: RefreshMeta) {
    const tokenHash = sha256(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException("Session revoked — please log in again");
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    if (existing.user.isSuspended) {
      throw new UnauthorizedException("Account suspended");
    }

    const { rawToken: newRawToken, expiresAt } = await this.issueInFamily(
      existing.userId,
      existing.organizationId!,
      existing.familyId,
      meta,
    );
    const newTokenHash = sha256(newRawToken);

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByTokenHash: newTokenHash },
    });

    return { rawToken: newRawToken, user: existing.user, expiresAt };
  }

  async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByRawToken(rawToken: string) {
    const tokenHash = sha256(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (existing) {
      await this.revokeFamily(existing.familyId);
    }
  }
}
