import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { computeAndVerifyTotals } from "../common/utils/line-items.util";
import { nextSequentialNumber, withRetryOnCollision } from "../common/utils/sequential-number.util";
import { CreateEstimateDto } from "./dto/create-estimate.dto";
import { UpdateEstimateDto } from "./dto/update-estimate.dto";

const LOCKED_STATUSES = new Set(["CONVERTED", "DECLINED", "EXPIRED"]);

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async list(orgId: string, customerId?: string) {
    return this.prisma.estimate.findMany({
      where: { organizationId: orgId, ...(customerId && { customerId }) },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });
  }

  private async assertExists(orgId: string, id: string) {
    const estimate = await this.prisma.estimate.findFirst({ where: { id, organizationId: orgId } });
    if (!estimate) {
      throw new NotFoundException("Estimate not found");
    }
    return estimate;
  }

  async findOne(orgId: string, id: string) {
    return this.prisma.estimate.findFirst({
      where: { id, organizationId: orgId },
      include: { customer: true },
    }).then((e) => {
      if (!e) throw new NotFoundException("Estimate not found");
      return e;
    });
  }

  private async nextEstimateNumber(orgId: string): Promise<string> {
    return nextSequentialNumber(() =>
      this.prisma.estimate
        .findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, select: { estimateNumber: true } })
        .then((e) => (e ? { number: e.estimateNumber } : null)),
    );
  }

  async create(orgId: string, userId: string, dto: CreateEstimateDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, organizationId: orgId } });
    if (!customer) {
      throw new BadRequestException("Customer not found in this organization");
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    const taxRate = dto.taxRate ?? Number(org?.defaultTaxRate ?? 0);
    const discountAmount = dto.discountAmount ?? 0;

    const totals = computeAndVerifyTotals(dto.lineItems, taxRate, discountAmount, dto.subtotal, dto.total);

    try {
      return await withRetryOnCollision(async () => {
        const estimateNumber = await this.nextEstimateNumber(orgId);
        return this.prisma.estimate.create({
          data: {
            organizationId: orgId,
            customerId: dto.customerId,
            jobId: dto.jobId,
            estimateNumber,
            title: dto.title,
            validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
            lineItems: dto.lineItems as any,
            subtotal: totals.subtotal,
            taxRate,
            taxAmount: totals.taxAmount,
            discountAmount,
            total: totals.total,
            notes: dto.notes,
            termsAndConditions: dto.termsAndConditions,
            createdBy: userId,
          },
        });
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new BadRequestException("Could not allocate an estimate number, please retry");
      }
      throw err;
    }
  }

  async update(orgId: string, id: string, dto: UpdateEstimateDto) {
    const estimate = await this.assertExists(orgId, id);
    if (LOCKED_STATUSES.has(estimate.status)) {
      throw new BadRequestException(`Cannot edit an estimate in ${estimate.status} status`);
    }

    const lineItems = (dto.lineItems ?? (estimate.lineItems as any)) as any[];
    const taxRate = dto.taxRate ?? Number(estimate.taxRate);
    const discountAmount = dto.discountAmount ?? Number(estimate.discountAmount);
    const totals = computeAndVerifyTotals(lineItems, taxRate, discountAmount, dto.subtotal, dto.total);

    return this.prisma.estimate.update({
      where: { id },
      data: {
        title: dto.title,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        lineItems: dto.lineItems ? (dto.lineItems as any) : undefined,
        subtotal: totals.subtotal,
        taxRate,
        taxAmount: totals.taxAmount,
        discountAmount,
        total: totals.total,
        notes: dto.notes,
        termsAndConditions: dto.termsAndConditions,
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    await this.prisma.estimate.delete({ where: { id } });
    return { success: true };
  }

  async send(orgId: string, id: string) {
    const estimate = await this.assertExists(orgId, id);
    if (estimate.status !== "DRAFT" && estimate.status !== "SENT") {
      throw new BadRequestException(`Cannot send an estimate in ${estimate.status} status`);
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: estimate.customerId } });

    const updated = await this.prisma.estimate.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });

    if (customer?.email) {
      await this.email.send({
        to: customer.email,
        subject: `Estimate #${estimate.estimateNumber}: ${estimate.title}`,
        html: `<p>Hi ${customer.firstName},</p><p>You have a new estimate for $${estimate.total} — "${estimate.title}".</p>`,
      });
    }

    return updated;
  }

  async convertToJob(orgId: string, id: string, userId: string) {
    const estimate = await this.assertExists(orgId, id);
    if (estimate.jobId) {
      throw new BadRequestException("Estimate is already linked to a job");
    }
    if (estimate.status === "DECLINED" || estimate.status === "EXPIRED") {
      throw new BadRequestException(`Cannot convert an estimate in ${estimate.status} status`);
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: estimate.customerId } });

    return withRetryOnCollision(() =>
      this.prisma.$transaction(async (tx) => {
        const lastJob = await tx.job.findFirst({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          select: { jobNumber: true },
        });
        const jobNumber = String(lastJob ? (parseInt(lastJob.jobNumber, 10) || 1000) + 1 : 1001);

        const job = await tx.job.create({
          data: {
            organizationId: orgId,
            customerId: estimate.customerId,
            jobNumber,
            title: estimate.title,
            serviceAddress: customer?.serviceAddress,
            city: customer?.city,
            state: customer?.state,
            zip: customer?.zip,
            createdBy: userId,
          },
        });

        await tx.estimate.update({
          where: { id },
          data: { jobId: job.id, status: "CONVERTED", approvedAt: estimate.approvedAt ?? new Date() },
        });

        return job;
      }),
    );
  }
}
