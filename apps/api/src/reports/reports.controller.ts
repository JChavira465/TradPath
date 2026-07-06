import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "./reports.service";
import { ReportsExportService } from "./reports-export.service";
import { ReportsQueryDto } from "./dto/reports-query.dto";

@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly export_: ReportsExportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("summary")
  summary(@CurrentOrg() orgId: string, @Query() query: ReportsQueryDto) {
    return this.reports.summary(orgId, query);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="report.csv"')
  async exportCsv(@CurrentOrg() orgId: string, @Query() query: ReportsQueryDto) {
    const summary = await this.reports.summary(orgId, query);
    return this.export_.toCsv(summary);
  }

  @Get("export.pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'attachment; filename="report.pdf"')
  async exportPdf(@CurrentOrg() orgId: string, @Query() query: ReportsQueryDto) {
    const [summary, org] = await Promise.all([
      this.reports.summary(orgId, query),
      this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    ]);
    return this.export_.toPdf(summary, org?.name ?? "TradPath");
  }
}
