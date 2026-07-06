import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { AuditLogsService } from "./audit-logs.service";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs.query.dto";

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogs.list(query);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="audit-logs.csv"')
  exportCsv(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogs.exportCsv(query);
  }
}
