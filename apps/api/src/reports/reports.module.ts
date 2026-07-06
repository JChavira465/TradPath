import { Module } from "@nestjs/common";
import { InvoicesModule } from "../invoices/invoices.module";
import { ServicePlansModule } from "../service-plans/service-plans.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportsExportService } from "./reports-export.service";

@Module({
  imports: [InvoicesModule, ServicePlansModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExportService],
})
export class ReportsModule {}
