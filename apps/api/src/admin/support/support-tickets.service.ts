import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { ListTicketsQueryDto } from "./dto/list-tickets.query.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";

interface ActorMeta {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListTicketsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));

    const where: any = {};
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { tickets, total, page, pageSize };
  }

  async detail(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException("Support ticket not found");
    }
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, meta: ActorMeta) {
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Support ticket not found");
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        priority: dto.priority,
        assignedTo: dto.assignedTo,
        resolvedAt: dto.status === "RESOLVED" || dto.status === "CLOSED" ? new Date() : existing.resolvedAt,
      },
    });

    await this.audit.log({
      organizationId: existing.organizationId,
      userId: meta.actorUserId,
      action: "SUPPORT_TICKET_UPDATED",
      resource: "SupportTicket",
      resourceId: id,
      oldValue: { status: existing.status, priority: existing.priority, assignedTo: existing.assignedTo },
      newValue: dto,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }
}
