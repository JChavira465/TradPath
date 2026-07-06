import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import { AnnouncementsService } from "./announcements.service";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { UpdateAnnouncementDto } from "./dto/update-announcement.dto";

function actorMeta(admin: AuthenticatedUser, req: FastifyRequest) {
  return { actorUserId: admin.userId, ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/announcements")
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list() {
    return this.announcements.list();
  }

  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.announcements.create(dto, actorMeta(admin, req));
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.announcements.update(id, dto, actorMeta(admin, req));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.announcements.remove(id, actorMeta(admin, req));
  }
}
