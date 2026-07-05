import { Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { BypassImpersonationReadOnly } from "../../common/decorators/bypass-impersonation-read-only.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import { AuditService } from "../../common/audit/audit.service";

/**
 * Ends an impersonation session. Called with the impersonation token
 * itself (acting as the target user), so it only requires a valid JWT
 * that actually carries impersonation context — not isSuperAdmin.
 */
@UseGuards(JwtAuthGuard)
@Controller("admin/impersonate")
export class ImpersonationSessionController {
  constructor(private readonly audit: AuditService) {}

  @Post("stop")
  @BypassImpersonationReadOnly()
  async stop(@CurrentUser() user: AuthenticatedUser, @Req() req: FastifyRequest) {
    if (!user.impersonation) {
      throw new ForbiddenException("No active impersonation session");
    }

    await this.audit.log({
      organizationId: user.orgId,
      userId: user.impersonation.adminUserId,
      action: "IMPERSONATION_STOP",
      resource: "User",
      resourceId: user.userId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      isSuperAdminAction: true,
      platform: "ADMIN",
    });

    return { success: true };
  }
}
