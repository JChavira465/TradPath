import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { STRIPE_CLIENT } from "../stripe/stripe.constants";
import { advanceByFrequency } from "../common/utils/service-frequency.util";
import { withRetryOnCollision } from "../common/utils/sequential-number.util";
import { CreateServicePlanDto } from "./dto/create-service-plan.dto";
import { UpdateServicePlanDto } from "./dto/update-service-plan.dto";

const ACTIVE_LIKE = new Set(["ACTIVE", "PAUSED"]);

@Injectable()
export class ServicePlansService {
  private readonly logger = new Logger(ServicePlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
  ) {}

  async list(orgId: string, customerId?: string) {
    return this.prisma.servicePlan.findMany({
      where: { organizationId: orgId, ...(customerId && { customerId }) },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });
  }

  private async assertExists(orgId: string, id: string) {
    const plan = await this.prisma.servicePlan.findFirst({ where: { id, organizationId: orgId } });
    if (!plan) {
      throw new NotFoundException("Service plan not found");
    }
    return plan;
  }

  async findOne(orgId: string, id: string) {
    const plan = await this.prisma.servicePlan.findFirst({
      where: { id, organizationId: orgId },
      include: { customer: true, jobs: { include: { job: true } }, invoices: { include: { invoice: true } } },
    });
    if (!plan) {
      throw new NotFoundException("Service plan not found");
    }
    return plan;
  }

  // Best-effort: creates a Stripe Product/Price/Customer/Subscription so
  // recurring billing can run through Stripe. Never blocks plan creation —
  // without a real Stripe key this fails, is logged, and the plan is saved
  // without Stripe IDs; BillingProcessor still generates invoices directly.
  //
  // `payment_behavior: default_incomplete` + expanding the latest invoice's
  // PaymentIntent is what makes "subscribe via Stripe Elements" possible:
  // the subscription is created in an incomplete state and the returned
  // clientSecret lets the browser collect a card and confirm the first
  // payment itself, rather than requiring a payment method up front.
  private async trySetUpStripe(customerId: string, name: string, price: number, billingCycle: "MONTHLY" | "ANNUAL") {
    try {
      const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) return {};

      let stripeCustomerId = customer.stripeCustomerId;
      if (!stripeCustomerId) {
        const stripeCustomer = await this.stripe.customers.create({
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email ?? undefined,
          phone: customer.phone ?? undefined,
        });
        stripeCustomerId = stripeCustomer.id;
        await this.prisma.customer.update({ where: { id: customerId }, data: { stripeCustomerId } });
      }

      const product = await this.stripe.products.create({ name });
      const stripePrice = await this.stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(price * 100),
        currency: "usd",
        recurring: { interval: billingCycle === "MONTHLY" ? "month" : "year" },
      });
      const subscription = await this.stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: stripePrice.id }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });

      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
      const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null | undefined;

      return {
        stripePriceId: stripePrice.id,
        stripeSubscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret ?? undefined,
      };
    } catch (err: any) {
      this.logger.warn({ event: "service_plan.stripe_setup_failed", message: err.message });
      return {};
    }
  }

  async create(orgId: string, userId: string, dto: CreateServicePlanDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, organizationId: orgId } });
    if (!customer) {
      throw new BadRequestException("Customer not found in this organization");
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const { clientSecret, ...stripeIds } = await this.trySetUpStripe(
      dto.customerId,
      dto.name,
      dto.price,
      dto.billingCycle,
    );

    const plan = await this.prisma.servicePlan.create({
      data: {
        organizationId: orgId,
        customerId: dto.customerId,
        name: dto.name,
        description: dto.description,
        billingCycle: dto.billingCycle,
        price: dto.price,
        serviceFrequency: dto.serviceFrequency,
        serviceDescription: dto.serviceDescription,
        assignedUserIds: dto.assignedUserIds ?? [],
        autoGenerateJobs: dto.autoGenerateJobs ?? true,
        autoSendInvoice: dto.autoSendInvoice ?? true,
        discountPercent: dto.discountPercent ?? 0,
        startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        nextServiceDate: startDate,
        nextBillingDate: startDate,
        isPublic: dto.isPublic ?? false,
        publicName: dto.publicName,
        publicDescription: dto.publicDescription,
        createdBy: userId,
        ...stripeIds,
      },
    });

    // Transient, not persisted — only the public /subscribe flow reads
    // this to hand the browser a Stripe Elements client secret.
    return Object.assign(plan, { stripeClientSecret: clientSecret });
  }

  async update(orgId: string, id: string, dto: UpdateServicePlanDto) {
    await this.assertExists(orgId, id);
    return this.prisma.servicePlan.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    await this.prisma.servicePlan.delete({ where: { id } });
    return { success: true };
  }

  async pause(orgId: string, id: string) {
    const plan = await this.assertExists(orgId, id);
    if (plan.status !== "ACTIVE") {
      throw new BadRequestException(`Cannot pause a plan in ${plan.status} status`);
    }
    return this.prisma.servicePlan.update({ where: { id }, data: { status: "PAUSED" } });
  }

  async resume(orgId: string, id: string) {
    const plan = await this.assertExists(orgId, id);
    if (plan.status !== "PAUSED") {
      throw new BadRequestException(`Cannot resume a plan in ${plan.status} status`);
    }
    return this.prisma.servicePlan.update({ where: { id }, data: { status: "ACTIVE" } });
  }

  async cancel(orgId: string, id: string, reason?: string) {
    const plan = await this.assertExists(orgId, id);
    if (!ACTIVE_LIKE.has(plan.status)) {
      throw new BadRequestException(`Cannot cancel a plan in ${plan.status} status`);
    }

    if (plan.stripeSubscriptionId) {
      try {
        await this.stripe.subscriptions.cancel(plan.stripeSubscriptionId);
      } catch (err: any) {
        this.logger.warn({ event: "service_plan.stripe_cancel_failed", message: err.message });
      }
    }

    return this.prisma.servicePlan.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
  }

  // Idempotent: a plan can only generate one job per due date — if a
  // ServicePlanJob already exists for this scheduledFor, skip.
  async generateJobNow(orgId: string, id: string) {
    const plan = await this.assertExists(orgId, id);
    if (plan.status !== "ACTIVE") {
      throw new BadRequestException("Only active plans can generate jobs");
    }

    const scheduledFor = plan.nextServiceDate ?? new Date();
    const existing = await this.prisma.servicePlanJob.findFirst({
      where: { servicePlanId: id, scheduledFor },
    });
    if (existing) {
      return this.prisma.job.findUnique({ where: { id: existing.jobId } });
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: plan.customerId } });

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
            customerId: plan.customerId,
            jobNumber,
            title: plan.name,
            description: plan.serviceDescription,
            type: "RECURRING",
            serviceAddress: customer?.serviceAddress,
            city: customer?.city,
            state: customer?.state,
            zip: customer?.zip,
            scheduledStart: scheduledFor,
            assignedUserIds: plan.assignedUserIds,
            createdBy: plan.createdBy,
          },
        });
        await tx.servicePlanJob.create({
          data: { servicePlanId: id, jobId: job.id, scheduledFor },
        });
        await tx.servicePlan.update({
          where: { id },
          data: { nextServiceDate: advanceByFrequency(scheduledFor, plan.serviceFrequency) },
        });
        return job;
      }),
    );
  }

  async dashboard(orgId: string) {
    const activePlans = await this.prisma.servicePlan.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { price: true, billingCycle: true },
    });

    let mrr = 0;
    for (const plan of activePlans) {
      mrr += plan.billingCycle === "MONTHLY" ? Number(plan.price) : Number(plan.price) / 12;
    }

    const [statusCounts, churnedLast30] = await Promise.all([
      this.prisma.servicePlan.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { _all: true },
      }),
      this.prisma.servicePlan.count({
        where: {
          organizationId: orgId,
          status: "CANCELLED",
          cancelledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      activeCount: activePlans.length,
      byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
      churnedLast30Days: churnedLast30,
    };
  }
}
