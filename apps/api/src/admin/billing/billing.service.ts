import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { STRIPE_CLIENT } from "../../stripe/stripe.constants";
import { PLATFORM_PLAN_MONTHLY_PRICE } from "./billing.constants";
import { CreateRefundDto } from "./dto/create-refund.dto";
import { CreateCouponDto } from "./dto/create-coupon.dto";

interface ActorMeta {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async subscriptions(page = 1, pageSize = 25) {
    const [orgs, total] = await Promise.all([
      this.prisma.organization.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.organization.count({ where: { deletedAt: null } }),
    ]);
    return { organizations: orgs, total, page, pageSize };
  }

  async planMrrBreakdown() {
    const counts = await this.prisma.organization.groupBy({
      by: ["subscriptionPlan"],
      where: { deletedAt: null, subscriptionStatus: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
      _count: { _all: true },
    });

    const byPlan = counts.map((row) => {
      const price = PLATFORM_PLAN_MONTHLY_PRICE[row.subscriptionPlan] ?? 0;
      const mrr = round2(price * row._count._all);
      return { plan: row.subscriptionPlan, orgCount: row._count._all, mrr };
    });

    const totalMrr = round2(byPlan.reduce((sum, p) => sum + p.mrr, 0));
    return { byPlan, totalMrr, totalArr: round2(totalMrr * 12) };
  }

  async trialsEndingSoon(days = 7) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.prisma.organization.findMany({
      where: { deletedAt: null, subscriptionStatus: "TRIALING", trialEndsAt: { gte: now, lte: until } },
      select: { id: true, name: true, slug: true, subscriptionPlan: true, trialEndsAt: true },
      orderBy: { trialEndsAt: "asc" },
    });
  }

  // FailedPayment.organizationId is a plain field, not a Prisma relation
  // (a failed platform-billing charge or a failed customer service-plan
  // charge may not always resolve to an org), so the org name is joined
  // in application code rather than via `include`.
  async failedPayments(page = 1, pageSize = 25) {
    const [payments, total] = await Promise.all([
      this.prisma.failedPayment.findMany({
        orderBy: { failedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.failedPayment.count(),
    ]);

    const orgIds = [...new Set(payments.map((p) => p.organizationId).filter((id): id is string => !!id))];
    const orgs = orgIds.length
      ? await this.prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true, slug: true } })
      : [];
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    return {
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        organization: p.organizationId ? (orgById.get(p.organizationId) ?? null) : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async createRefund(dto: CreateRefundDto, meta: ActorMeta) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: dto.stripePaymentIntentId,
        amount: dto.amount ? Math.round(dto.amount * 100) : undefined,
        reason: dto.reason as Stripe.RefundCreateParams.Reason | undefined,
      });

      const payment = await this.prisma.payment.findFirst({ where: { stripePaymentId: dto.stripePaymentIntentId } });

      await this.audit.log({
        organizationId: payment?.organizationId,
        userId: meta.actorUserId,
        action: "PAYMENT_REFUNDED",
        resource: "Payment",
        resourceId: payment?.id ?? dto.stripePaymentIntentId,
        newValue: { stripeRefundId: refund.id, amount: dto.amount ?? null, reason: dto.reason },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        isSuperAdminAction: true,
        platform: "ADMIN",
      });

      return { success: true, refundId: refund.id, status: refund.status };
    } catch (err: any) {
      this.logger.warn({ event: "admin.refund_failed", message: err.message });
      throw new BadRequestException(`Refund failed: ${err.message}`);
    }
  }

  async listCoupons() {
    try {
      const coupons = await this.stripe.coupons.list({ limit: 100 });
      return coupons.data.map((c) => ({
        id: c.id,
        name: c.name,
        percentOff: c.percent_off,
        amountOff: c.amount_off ? c.amount_off / 100 : null,
        durationInMonths: c.duration_in_months,
        valid: c.valid,
      }));
    } catch (err: any) {
      this.logger.warn({ event: "admin.coupons_list_failed", message: err.message });
      return [];
    }
  }

  async createCoupon(dto: CreateCouponDto, meta: ActorMeta) {
    if (dto.type === "percent" && dto.value > 100) {
      throw new BadRequestException("Percent-off coupons must be between 1 and 100");
    }

    try {
      const coupon = await this.stripe.coupons.create({
        name: dto.name,
        percent_off: dto.type === "percent" ? dto.value : undefined,
        amount_off: dto.type === "amount" ? Math.round(dto.value * 100) : undefined,
        currency: dto.type === "amount" ? "usd" : undefined,
        duration: dto.durationInMonths ? "repeating" : "once",
        duration_in_months: dto.durationInMonths,
      });

      await this.audit.log({
        userId: meta.actorUserId,
        action: "COUPON_CREATED",
        resource: "Coupon",
        resourceId: coupon.id,
        newValue: { name: dto.name, type: dto.type, value: dto.value },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        isSuperAdminAction: true,
        platform: "ADMIN",
      });

      return { id: coupon.id, name: coupon.name };
    } catch (err: any) {
      this.logger.warn({ event: "admin.coupon_create_failed", message: err.message });
      throw new BadRequestException(`Coupon creation failed: ${err.message}`);
    }
  }
}
