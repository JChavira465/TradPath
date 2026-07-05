import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../types/authenticated-user.type";

interface AccessTokenPayload {
  sub: string;
  type: "access";
  impersonation?: { adminUserId: string; readOnly: boolean };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET")!,
    });
  }

  // S7 — reject if user is null, suspended, locked, or the org is suspended.
  // Runs on every request so a suspended account dies within the access
  // token's 15-minute lifetime even if the bearer token is still valid.
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Invalid token type");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (user.isSuspended) {
      throw new UnauthorizedException("Account suspended");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account temporarily locked");
    }
    if (user.organization?.isSuspended) {
      throw new UnauthorizedException("Organization suspended");
    }

    return {
      userId: user.id,
      orgId: user.organizationId,
      email: user.email,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      impersonation: payload.impersonation,
    };
  }
}
