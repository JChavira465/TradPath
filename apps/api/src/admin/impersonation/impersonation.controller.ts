import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";

class StartImpersonationDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;
}

/**
 * S11 — guard applied at the controller class level, never per-endpoint.
 * This controller only ever runs in the SUPER ADMIN's own session (the
 * request that *starts* impersonation). Ending an impersonation session
 * runs as the impersonated user instead, so it lives in a separate
 * controller (ImpersonationSessionController) that doesn't require
 * isSuperAdmin on the acting token.
 */
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/impersonate")
export class ImpersonationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async start(
    @Body() dto: StartImpersonationDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!target) {
      throw new ForbiddenException("User not found");
    }

    const readOnly = dto.readOnly ?? true;

    const token = this.jwt.sign(
      {
        sub: target.id,
        type: "access",
        impersonation: { adminUserId: admin.userId, readOnly },
      },
      { secret: this.config.get<string>("JWT_SECRET"), expiresIn: "1h" },
    );

    await this.audit.log({
      organizationId: target.organizationId,
      userId: admin.userId,
      action: "IMPERSONATION_START",
      resource: "User",
      resourceId: target.id,
      newValue: { readOnly },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      isSuperAdminAction: true,
      platform: "ADMIN",
    });

    return { accessToken: token, expiresIn: 3600, readOnly };
  }
}
