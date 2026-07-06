import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { TeamService } from "./team.service";
import { InviteTeamMemberDto } from "./dto/invite-team-member.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

function requestMeta(req: FastifyRequest) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] as string | undefined, platform: "WEB" as const };
}

@UseGuards(JwtAuthGuard)
@Controller("team")
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.team.list(orgId);
  }

  @Post("invite")
  invite(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: InviteTeamMemberDto) {
    return this.team.invite(orgId, user.userId, dto);
  }

  @Patch(":userId/role")
  updateRole(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: FastifyRequest,
  ) {
    return this.team.updateRole(orgId, user, userId, dto.role, requestMeta(req));
  }

  @Delete(":userId")
  remove(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.team.remove(orgId, user, userId, requestMeta(req));
  }
}
