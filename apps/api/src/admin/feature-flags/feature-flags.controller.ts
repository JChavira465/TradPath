import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import { FeatureFlagsService } from "./feature-flags.service";
import { CreateFlagDto } from "./dto/create-flag.dto";
import { UpdateFlagDto } from "./dto/update-flag.dto";
import { SetOrgOverrideDto } from "./dto/set-org-override.dto";

function actorMeta(admin: AuthenticatedUser, req: FastifyRequest) {
  return { actorUserId: admin.userId, ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/feature-flags")
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get()
  list() {
    return this.flags.list();
  }

  @Post()
  create(@Body() dto: CreateFlagDto, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.flags.create(dto, actorMeta(admin, req));
  }

  @Patch(":key")
  update(
    @Param("key") key: string,
    @Body() dto: UpdateFlagDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.flags.update(key, dto, actorMeta(admin, req));
  }

  @Delete(":key")
  remove(@Param("key") key: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.flags.remove(key, actorMeta(admin, req));
  }

  @Get(":key/overrides")
  listOverrides(@Param("key") key: string) {
    return this.flags.listOverrides(key);
  }

  @Post(":key/overrides")
  setOverride(
    @Param("key") key: string,
    @Body() dto: SetOrgOverrideDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.flags.setOverride(key, dto, actorMeta(admin, req));
  }

  @Delete(":key/overrides/:organizationId")
  removeOverride(
    @Param("key") key: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.flags.removeOverride(key, organizationId, actorMeta(admin, req));
  }
}
