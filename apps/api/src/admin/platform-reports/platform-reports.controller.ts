import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { PlatformReportsService } from "./platform-reports.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/reports")
export class PlatformReportsController {
  constructor(private readonly reports: PlatformReportsService) {}

  @Get("summary")
  summary() {
    return this.reports.summary();
  }

  @Get("at-risk")
  atRisk() {
    return this.reports.atRiskOrgs();
  }
}
