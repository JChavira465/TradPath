import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs.query.dto";

function buildWhere(query: ListAuditLogsQueryDto) {
  const where: any = {};
  if (query.organizationId) where.organizationId = query.organizationId;
  if (query.userId) where.userId = query.userId;
  if (query.action) where.action = query.action;
  if (query.resource) where.resource = query.resource;
  if (query.isSuperAdminAction !== undefined) where.isSuperAdminAction = query.isSuperAdminAction === "true";
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from && { gte: new Date(query.from) }),
      ...(query.to && { lte: new Date(query.to) }),
    };
  }
  return where;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));
    const where = buildWhere(query);

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, pageSize };
  }

  async exportCsv(query: ListAuditLogsQueryDto) {
    const where = buildWhere(query);
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: {
        organization: { select: { name: true } },
        user: { select: { email: true } },
      },
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [
      "Timestamp",
      "Organization",
      "User",
      "Action",
      "Resource",
      "ResourceId",
      "SuperAdminAction",
      "Platform",
      "OldValue",
      "NewValue",
    ];
    const rows = [header.join(",")];
    for (const log of logs) {
      rows.push(
        [
          log.createdAt.toISOString(),
          escape(log.organization?.name ?? ""),
          escape(log.user?.email ?? ""),
          log.action,
          log.resource,
          log.resourceId ?? "",
          String(log.isSuperAdminAction),
          log.platform,
          escape(log.oldValue ? JSON.stringify(log.oldValue) : ""),
          escape(log.newValue ? JSON.stringify(log.newValue) : ""),
        ].join(","),
      );
    }
    return rows.join("\n");
  }
}
