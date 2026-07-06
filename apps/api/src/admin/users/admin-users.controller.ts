import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import { AdminUsersService } from "./admin-users.service";
import { ListUsersQueryDto } from "./dto/list-users.query.dto";

function actorMeta(admin: AuthenticatedUser, req: FastifyRequest) {
  return { actorUserId: admin.userId, ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.users.detail(id);
  }

  @Get(":id/login-history")
  loginHistory(@Param("id") id: string) {
    return this.users.loginHistory(id);
  }

  @Get(":id/sessions")
  sessions(@Param("id") id: string) {
    return this.users.sessions(id);
  }

  @Post(":id/force-reset")
  forceReset(@Param("id") id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.users.forcePasswordReset(id, actorMeta(admin, req));
  }

  @Post(":id/unlock")
  unlock(@Param("id") id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.users.unlock(id, actorMeta(admin, req));
  }

  @Post(":id/disable")
  disable(@Param("id") id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.users.disable(id, actorMeta(admin, req));
  }

  @Post(":id/enable")
  enable(@Param("id") id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.users.enable(id, actorMeta(admin, req));
  }

  @Post(":id/revoke-sessions")
  revokeSessions(@Param("id") id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.users.revokeSessions(id, actorMeta(admin, req));
  }
}
