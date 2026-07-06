import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import { CompaniesService } from "./companies.service";
import { ListCompaniesQueryDto } from "./dto/list-companies.query.dto";
import { TypedConfirmationDto } from "./dto/typed-confirmation.dto";
import { TransferOwnershipDto } from "./dto/transfer-ownership.dto";

function actorMeta(admin: AuthenticatedUser, req: FastifyRequest) {
  return { actorUserId: admin.userId, ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(@Query() query: ListCompaniesQueryDto) {
    return this.companies.list(query);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="companies.csv"')
  exportCsv(@Query() query: ListCompaniesQueryDto) {
    return this.companies.exportCsv(query);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.companies.detail(id);
  }

  @Post(":id/suspend")
  suspend(@Param("id") id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.companies.suspend(id, actorMeta(admin, req));
  }

  @Post(":id/reactivate")
  reactivate(@Param("id") id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.companies.reactivate(id, actorMeta(admin, req));
  }

  @Post(":id/archive")
  archive(
    @Param("id") id: string,
    @Body() dto: TypedConfirmationDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.companies.archive(id, dto.confirmSlug, actorMeta(admin, req));
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Body() dto: TypedConfirmationDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.companies.remove(id, dto.confirmSlug, actorMeta(admin, req));
  }

  @Patch(":id/reset-trial")
  resetTrial(
    @Param("id") id: string,
    @Body("days") days: number | undefined,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.companies.resetTrial(id, days ?? 14, actorMeta(admin, req));
  }

  @Post(":id/transfer-ownership")
  transferOwnership(
    @Param("id") id: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.companies.transferOwnership(id, dto.newOwnerUserId, actorMeta(admin, req));
  }
}
