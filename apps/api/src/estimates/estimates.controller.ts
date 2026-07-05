import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { EstimatesService } from "./estimates.service";
import { CreateEstimateDto } from "./dto/create-estimate.dto";
import { UpdateEstimateDto } from "./dto/update-estimate.dto";

@UseGuards(JwtAuthGuard)
@Controller("estimates")
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query("customerId") customerId?: string) {
    return this.estimates.list(orgId, customerId);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEstimateDto) {
    return this.estimates.create(orgId, user.userId, dto);
  }

  @Get(":id")
  findOne(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.estimates.findOne(orgId, id);
  }

  @Patch(":id")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateEstimateDto) {
    return this.estimates.update(orgId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.estimates.remove(orgId, id);
  }

  @Post(":id/send")
  @HttpCode(200)
  send(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.estimates.send(orgId, id);
  }

  @Post(":id/convert-to-job")
  @HttpCode(200)
  convertToJob(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.estimates.convertToJob(orgId, id, user.userId);
  }
}
