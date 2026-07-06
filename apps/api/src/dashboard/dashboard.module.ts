import { Module } from "@nestjs/common";
import { InvoicesModule } from "../invoices/invoices.module";
import { ServicePlansModule } from "../service-plans/service-plans.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [InvoicesModule, ServicePlansModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
