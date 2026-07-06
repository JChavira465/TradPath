import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { DashboardService } from "./dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  summary(@CurrentOrg() orgId: string) {
    return this.dashboard.summary(orgId);
  }
}
