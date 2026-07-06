import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { ExecutiveDashboardService } from "./executive-dashboard.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/dashboard")
export class ExecutiveDashboardController {
  constructor(private readonly dashboard: ExecutiveDashboardService) {}

  @Get()
  summary() {
    return this.dashboard.summary();
  }
}
