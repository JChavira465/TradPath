import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { JobStatus, Prisma } from "@tradpath/database";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { TwilioService } from "../twilio/twilio.service";
import { EmailService } from "../email/email.service";
import { withRetryOnCollision } from "../common/utils/sequential-number.util";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { ListJobsQueryDto } from "./dto/list-jobs.query.dto";
import { CalendarJobsQueryDto } from "./dto/calendar-jobs.query.dto";
import { CompleteJobDto } from "./dto/complete-job.dto";
import { WorkOrderPdfService } from "./work-order-pdf.service";

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
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly twilio: TwilioService,
    private readonly email: EmailService,
    private readonly workOrderPdf: WorkOrderPdfService,
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

  private async assertServiceOfferingBelongsToOrg(orgId: string, serviceOfferingId?: string) {
    if (!serviceOfferingId) return;
    const offering = await this.prisma.serviceOffering.findFirst({
      where: { id: serviceOfferingId, organizationId: orgId },
    });
    if (!offering) {
      throw new BadRequestException("Service offering not found in this organization");
    }
  }

  async create(orgId: string, userId: string, dto: CreateJobDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: orgId },
    });
    if (!customer) {
      throw new BadRequestException("Customer not found in this organization");
    }
    await this.assertAssigneesBelongToOrg(orgId, dto.assignedUserIds);
    await this.assertServiceOfferingBelongsToOrg(orgId, dto.serviceOfferingId);

    try {
      return await withRetryOnCollision(async () => {
        const jobNumber = await this.nextJobNumber(orgId);
        return this.prisma.job.create({
          data: {
            organizationId: orgId,
            customerId: dto.customerId,
            serviceOfferingId: dto.serviceOfferingId,
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
            laborCost: dto.laborCost ?? 0,
            materialCost: dto.materialCost ?? 0,
            profit: -((dto.laborCost ?? 0) + (dto.materialCost ?? 0)),
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
    const existing = await this.findOne(orgId, id);
    await this.assertAssigneesBelongToOrg(orgId, dto.assignedUserIds);
    await this.assertServiceOfferingBelongsToOrg(orgId, dto.serviceOfferingId);

    const laborCost = dto.laborCost ?? Number(existing.laborCost);
    const materialCost = dto.materialCost ?? Number(existing.materialCost);
    const recomputeProfit = dto.laborCost !== undefined || dto.materialCost !== undefined;

    return this.prisma.job.update({
      where: { id },
      data: {
        ...dto,
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
        profit: recomputeProfit ? Number(existing.totalRevenue) - laborCost - materialCost : undefined,
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
    meta: { type: string; caption?: string; latitude?: number; longitude?: number; checkpointId?: string },
  ) {
    const job = await this.findOne(orgId, jobId);

    if (meta.checkpointId) {
      const checkpoint = await this.prisma.jobPhotoCheckpoint.findFirst({
        where: { id: meta.checkpointId, organizationId: orgId, serviceOfferingId: job.serviceOfferingId ?? undefined },
      });
      if (!checkpoint) {
        throw new BadRequestException("Photo checkpoint not found for this job's service offering");
      }
    }

    const upload = await this.storage.uploadPhoto(orgId, buffer);

    return this.prisma.jobPhoto.create({
      data: {
        jobId,
        uploadedBy,
        url: upload.publicUrl!,
        type: meta.type as any,
        checkpointId: meta.checkpointId,
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

  // Signatures live in the private bucket (see StorageService.uploadSignature)
  // — the JobPhoto.url column holds a storage PATH for these, not a public
  // URL, so callers must always resolve it via getPhotoUrl before display.
  async addSignature(orgId: string, jobId: string, uploadedBy: string, buffer: Buffer, role: "CUSTOMER" | "TECHNICIAN") {
    await this.findOne(orgId, jobId);
    const upload = await this.storage.uploadSignature(orgId, buffer);

    return this.prisma.jobPhoto.create({
      data: {
        jobId,
        uploadedBy,
        url: upload.path,
        type: "SIGNATURE",
        caption: role,
        isCustomerVisible: false,
        takenAt: new Date(),
      },
    });
  }

  async getPhotoUrl(orgId: string, jobId: string, photoId: string) {
    await this.findOne(orgId, jobId);
    const photo = await this.prisma.jobPhoto.findFirst({ where: { id: photoId, jobId } });
    if (!photo) {
      throw new NotFoundException("Photo not found");
    }
    if (photo.type === "SIGNATURE") {
      return { url: await this.storage.getSignedUrl(photo.url) };
    }
    return { url: photo.url };
  }

  // Server-enforced (not just UI): every REQUIRED checkpoint for the job's
  // service offering must have at least one photo attached before the job
  // can move to COMPLETED. A job with no serviceOfferingId has no defined
  // checkpoints, so nothing is required — this only ever tightens, never
  // silently blocks jobs the org never configured checkpoints for.
  async checkpointStatus(orgId: string, jobId: string) {
    const job = await this.findOne(orgId, jobId);
    if (!job.serviceOfferingId) {
      return [];
    }

    const [checkpoints, photos] = await Promise.all([
      this.prisma.jobPhotoCheckpoint.findMany({
        where: { organizationId: orgId, serviceOfferingId: job.serviceOfferingId },
        orderBy: { sortOrder: "asc" },
      }),
      this.prisma.jobPhoto.findMany({ where: { jobId }, select: { checkpointId: true } }),
    ]);

    const fulfilledCheckpointIds = new Set(photos.map((p) => p.checkpointId).filter(Boolean));
    return checkpoints.map((cp) => ({
      id: cp.id,
      label: cp.label,
      phase: cp.phase,
      required: cp.required,
      fulfilled: fulfilledCheckpointIds.has(cp.id),
    }));
  }

  async complete(orgId: string, id: string, dto: CompleteJobDto) {
    const job = await this.findOne(orgId, id);

    if (job.status === "COMPLETED" || job.status === "CANCELLED") {
      throw new BadRequestException(`Cannot complete a job in ${job.status} status`);
    }

    const checkpoints = await this.checkpointStatus(orgId, id);
    const missingRequired = checkpoints.filter((cp) => cp.required && !cp.fulfilled);
    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing required photo(s): ${missingRequired.map((cp) => cp.label).join(", ")}`,
      );
    }

    const completed = await this.prisma.job.update({
      where: { id },
      data: {
        status: "COMPLETED",
        actualEnd: new Date(),
        completionNotes: dto.completionNotes,
        completionFlowCompletedAt: new Date(),
      },
    });

    // Best-effort: a PDF/email failure must never roll back or block the
    // completion itself — the tech's work is already done. Failures are
    // logged; getWorkOrderPdfUrl() falls back to generating on demand.
    this.generateAndSendWorkOrder(orgId, id).catch((err) =>
      this.logger.warn({ event: "work_order.generate_failed", jobId: id, message: err.message }),
    );

    return completed;
  }

  private async generateAndSendWorkOrder(orgId: string, jobId: string) {
    const buffer = await this.workOrderPdf.generate({ orgId, jobId });
    const upload = await this.storage.uploadPDF(orgId, buffer, "work-orders");
    await this.prisma.job.update({ where: { id: jobId }, data: { workOrderPdfPath: upload.path } });

    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { customer: true } });
    if (job?.customer.email) {
      const signedUrl = await this.storage.getSignedUrl(upload.path, 7 * 24 * 60 * 60);
      await this.email.send({
        to: job.customer.email,
        subject: `Work order for job #${job.jobNumber}`,
        html: `<p>Hi ${job.customer.firstName},</p><p>Here's the completion report for your recent service. This link is valid for 7 days.</p><p><a href="${signedUrl}">View work order</a></p>`,
      });
    }
  }

  async getWorkOrderPdfUrl(orgId: string, id: string) {
    const job = await this.findOne(orgId, id);
    if (job.workOrderPdfPath) {
      return { url: await this.storage.getSignedUrl(job.workOrderPdfPath) };
    }
    const buffer = await this.workOrderPdf.generate({ orgId, jobId: id });
    const upload = await this.storage.uploadPDF(orgId, buffer, "work-orders");
    await this.prisma.job.update({ where: { id }, data: { workOrderPdfPath: upload.path } });
    return { url: await this.storage.getSignedUrl(upload.path) };
  }
}
