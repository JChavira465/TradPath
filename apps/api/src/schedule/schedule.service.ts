import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateScheduleEventDto } from "./dto/create-schedule-event.dto";
import { UpdateScheduleEventDto } from "./dto/update-schedule-event.dto";

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  // S1 — every query filtered by organizationId, sourced only from the JWT.
  async list(orgId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    return this.prisma.scheduleEvent.findMany({
      where: {
        organizationId: orgId,
        start: { lte: toDate },
        end: { gte: fromDate },
      },
      include: {
        job: {
          select: { id: true, jobNumber: true, title: true, status: true, type: true, bookingRequestId: true, servicePlanId: true },
        },
      },
      orderBy: { start: "asc" },
    });
  }

  private async assertAssigneesBelongToOrg(orgId: string, assignedUserIds?: string[]) {
    if (!assignedUserIds || assignedUserIds.length === 0) return;
    const count = await this.prisma.user.count({
      where: { id: { in: assignedUserIds }, organizationId: orgId },
    });
    if (count !== assignedUserIds.length) {
      throw new BadRequestException("One or more assigned users do not belong to this organization");
    }
  }

  private async assertJobBelongsToOrg(orgId: string, jobId?: string) {
    if (!jobId) return;
    const job = await this.prisma.job.findFirst({ where: { id: jobId, organizationId: orgId } });
    if (!job) {
      throw new BadRequestException("Job not found in this organization");
    }
  }

  private assertValidRange(start: string, end: string) {
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      throw new BadRequestException("Event end must be after start");
    }
  }

  private async assertExists(orgId: string, id: string) {
    const event = await this.prisma.scheduleEvent.findFirst({ where: { id, organizationId: orgId } });
    if (!event) {
      throw new NotFoundException("Schedule event not found");
    }
    return event;
  }

  async create(orgId: string, dto: CreateScheduleEventDto) {
    this.assertValidRange(dto.start, dto.end);
    await Promise.all([
      this.assertAssigneesBelongToOrg(orgId, dto.assignedUserIds),
      this.assertJobBelongsToOrg(orgId, dto.jobId),
    ]);

    return this.prisma.scheduleEvent.create({
      data: {
        organizationId: orgId,
        jobId: dto.jobId,
        title: dto.title,
        description: dto.description,
        assignedUserIds: dto.assignedUserIds ?? [],
        start: new Date(dto.start),
        end: new Date(dto.end),
        allDay: dto.allDay ?? false,
        color: dto.color,
        recurrenceRule: dto.recurrenceRule,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateScheduleEventDto) {
    const existing = await this.assertExists(orgId, id);
    const start = dto.start ?? existing.start.toISOString();
    const end = dto.end ?? existing.end.toISOString();
    this.assertValidRange(start, end);

    await Promise.all([
      this.assertAssigneesBelongToOrg(orgId, dto.assignedUserIds),
      this.assertJobBelongsToOrg(orgId, dto.jobId),
    ]);

    return this.prisma.scheduleEvent.update({
      where: { id },
      data: {
        ...dto,
        start: dto.start ? new Date(dto.start) : undefined,
        end: dto.end ? new Date(dto.end) : undefined,
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    await this.prisma.scheduleEvent.delete({ where: { id } });
    return { success: true };
  }
}
