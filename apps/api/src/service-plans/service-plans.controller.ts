import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { ServicePlansService } from "./service-plans.service";
import { CreateServicePlanDto } from "./dto/create-service-plan.dto";
import { UpdateServicePlanDto } from "./dto/update-service-plan.dto";

class CancelServicePlanDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@UseGuards(JwtAuthGuard)
@Controller("service-plans")
export class ServicePlansController {
  constructor(private readonly servicePlans: ServicePlansService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query("customerId") customerId?: string) {
    return this.servicePlans.list(orgId, customerId);
  }

  @Get("dashboard")
  dashboard(@CurrentOrg() orgId: string) {
    return this.servicePlans.dashboard(orgId);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateServicePlanDto) {
    return this.servicePlans.create(orgId, user.userId, dto);
  }

  @Get(":id")
  findOne(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.servicePlans.findOne(orgId, id);
  }

  @Patch(":id")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateServicePlanDto) {
    return this.servicePlans.update(orgId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.servicePlans.remove(orgId, id);
  }

  @Post(":id/pause")
  @HttpCode(200)
  pause(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.servicePlans.pause(orgId, id);
  }

  @Post(":id/resume")
  @HttpCode(200)
  resume(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.servicePlans.resume(orgId, id);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: CancelServicePlanDto) {
    return this.servicePlans.cancel(orgId, id, dto.reason);
  }

  @Post(":id/generate-job")
  @HttpCode(200)
  generateJob(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.servicePlans.generateJobNow(orgId, id);
  }
}
