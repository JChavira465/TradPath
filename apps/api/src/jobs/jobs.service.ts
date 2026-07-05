import { BadRequestException, Injectable, NotFoundException, NotImplementedException } from "@nestjs/common";
import { JobStatus, Prisma } from "@tradpath/database";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { TwilioService } from "../twilio/twilio.service";
import { withRetryOnCollision } from "../common/utils/sequential-number.util";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { ListJobsQueryDto } from "./dto/list-jobs.query.dto";
import { CalendarJobsQueryDto } from "./dto/calendar-jobs.query.dto";
import { CompleteJobDto } from "./dto/complete-job.dto";

// S2 — no COMPLETED -> SCHEDULED, etc. Terminal states have no way out.
const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  SCHEDULED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly twilio: TwilioService,
  ) {}

  // S1 — every query filtered by organizationId, sourced only from the JWT.
  async list(orgId: string, query: ListJobsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.JobWhereInput = {
      organizationId: orgId,
      ...(query.status && { status: query.status }),
      ...(query.assignedUserId && { assignedUserIds: { has: query.assignedUserId } }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { jobNumber: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: { customer: true },
        orderBy: { scheduledStart: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async today(orgId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return this.prisma.job.findMany({
      where: {
        organizationId: orgId,
        scheduledStart: { gte: start, lte: end },
        status: { notIn: ["CANCELLED"] },
      },
      include: { customer: true },
      orderBy: { scheduledStart: "asc" },
    });
  }

  // Calendar view — all jobs with a scheduled slot overlapping [from, to],
  // regardless of status (cancelled jobs still render, dimmed, on the
  // frontend calendar rather than silently disappearing).
  async calendar(orgId: string, query: CalendarJobsQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    return this.prisma.job.findMany({
      where: {
        organizationId: orgId,
        scheduledStart: { not: null, lte: to },
        OR: [{ scheduledEnd: { gte: from } }, { scheduledEnd: null }],
        ...(query.assignedUserId && { assignedUserIds: { has: query.assignedUserId } }),
      },
      include: { customer: true },
      orderBy: { scheduledStart: "asc" },
    });
  }

  // Unscheduled sidebar — open jobs with no scheduledStart yet, so they can
  // be dragged onto the calendar.
  async unscheduled(orgId: string) {
    return this.prisma.job.findMany({
      where: {
        organizationId: orgId,
        scheduledStart: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async dashboardSummary(orgId: string) {
    const [byStatus, todayCount, weekRevenue] = await Promise.all([
      this.prisma.job.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { _all: true },
      }),
      this.prisma.job.count({
        where: {
          organizationId: orgId,
          scheduledStart: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      this.prisma.job.aggregate({
        where: {
          organizationId: orgId,
          status: "COMPLETED",
          actualEnd: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _sum: { totalRevenue: true },
      }),
    ]);

    return {
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      todayCount,
      last7DaysRevenue: weekRevenue._sum.totalRevenue ?? 0,
    };
  }

  async findOne(orgId: string, id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, organizationId: orgId },
      include: { customer: true, photos: true, textMessages: true, timeEntries: true },
    });
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    return job;
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

  private async nextJobNumber(orgId: string): Promise<string> {
    const last = await this.prisma.job.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: { jobNumber: true },
    });
    return String(last ? (parseInt(last.jobNumber, 10) || 1000) + 1 : 1001);
  }

  async create(orgId: string, userId: string, dto: CreateJobDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: orgId },
    });
    if (!customer) {
      throw new BadRequestException("Customer not found in this organization");
    }
    await this.assertAssigneesBelongToOrg(orgId, dto.assignedUserIds);

    try {
      return await withRetryOnCollision(async () => {
        const jobNumber = await this.nextJobNumber(orgId);
        return this.prisma.job.create({
          data: {
            organizationId: orgId,
            customerId: dto.customerId,
            jobNumber,
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            type: dto.type,
            serviceAddress: dto.serviceAddress ?? customer.serviceAddress,
            city: dto.city ?? customer.city,
            state: dto.state ?? customer.state,
            zip: dto.zip ?? customer.zip,
            scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
            scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
            estimatedDuration: dto.estimatedDuration,
            assignedUserIds: dto.assignedUserIds ?? [],
            internalNotes: dto.internalNotes,
            customerNotes: dto.customerNotes,
            createdBy: userId,
          },
        });
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new BadRequestException("Could not allocate a job number, please retry");
      }
      throw err;
    }
  }

  async update(orgId: string, id: string, dto: UpdateJobDto) {
    await this.findOne(orgId, id);
    await this.assertAssigneesBelongToOrg(orgId, dto.assignedUserIds);

    return this.prisma.job.update({
      where: { id },
      data: {
        ...dto,
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    await this.prisma.job.delete({ where: { id } });
    return { success: true };
  }

  async updateStatus(orgId: string, id: string, status: JobStatus) {
    const job = await this.findOne(orgId, id);

    if (job.status === status) {
      return job;
    }

    const allowed = ALLOWED_TRANSITIONS[job.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition job from ${job.status} to ${status}`);
    }

    const data: Prisma.JobUpdateInput = { status };
    if (status === "IN_PROGRESS" && !job.actualStart) {
      data.actualStart = new Date();
    }
    if (status === "COMPLETED") {
      data.actualEnd = new Date();
    }

    return this.prisma.job.update({ where: { id }, data });
  }

  async onMyWay(orgId: string, id: string, latitude: number, longitude: number) {
    const job = await this.prisma.job.findFirst({
      where: { id, organizationId: orgId },
      include: { customer: true },
    });
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const body = `Your technician is on the way! Track live location: ${mapsUrl}`;

    const organization = await this.prisma.organization.findUnique({ where: { id: orgId } });
    let twilioSid: string | null = null;
    if (organization?.twilioPhoneNumber && job.customer?.phone) {
      twilioSid = await this.twilio.sendSms(organization.twilioPhoneNumber, job.customer.phone, body);
    }

    await this.prisma.$transaction([
      this.prisma.job.update({ where: { id }, data: { onMyWaySentAt: new Date() } }),
      this.prisma.jobTextMessage.create({
        data: {
          organizationId: orgId,
          jobId: id,
          customerId: job.customerId,
          direction: "OUTBOUND",
          body,
          twilioSid: twilioSid ?? undefined,
          sentAt: new Date(),
        },
      }),
    ]);

    return { success: true, mapsUrl, smsQueued: !!twilioSid };
  }

  async addPhoto(
    orgId: string,
    jobId: string,
    uploadedBy: string,
    buffer: Buffer,
    meta: { type: string; caption?: string; latitude?: number; longitude?: number },
  ) {
    await this.findOne(orgId, jobId);

    const upload = await this.storage.uploadPhoto(orgId, buffer);

    return this.prisma.jobPhoto.create({
      data: {
        jobId,
        uploadedBy,
        url: upload.publicUrl!,
        type: meta.type as any,
        caption: meta.caption,
        latitude: meta.latitude,
        longitude: meta.longitude,
        takenAt: new Date(),
      },
    });
  }

  async listPhotos(orgId: string, jobId: string) {
    await this.findOne(orgId, jobId);
    return this.prisma.jobPhoto.findMany({ where: { jobId }, orderBy: { createdAt: "asc" } });
  }

  async complete(orgId: string, id: string, dto: CompleteJobDto) {
    const job = await this.findOne(orgId, id);

    if (job.status === "COMPLETED" || job.status === "CANCELLED") {
      throw new BadRequestException(`Cannot complete a job in ${job.status} status`);
    }

    return this.prisma.job.update({
      where: { id },
      data: {
        status: "COMPLETED",
        actualEnd: new Date(),
        completionNotes: dto.completionNotes,
        completionFlowCompletedAt: new Date(),
      },
    });
  }

  async getWorkOrderPdfUrl(orgId: string, id: string): Promise<never> {
    await this.findOne(orgId, id);
    // Real PDF generation (photos, signatures, GPS/timestamp, totals) is
    // Sprint 7 scope. The route exists now so the API surface is stable.
    throw new NotImplementedException("Work order PDF generation is not available until Sprint 7");
  }
}
