import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../redis/cache.service";
import { AI_CREDIT_LIMITS } from "../../ai/ai-credit-limits.constant";

const CACHE_TTL_SECONDS = 300;

function roundToCacheBucket(date: Date): Date {
  const bucketMs = CACHE_TTL_SECONDS * 1000;
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async summary() {
    const bucket = roundToCacheBucket(new Date()).toISOString();
    return this.cache.getOrSet(`admin:executive-dashboard:${bucket}`, CACHE_TTL_SECONDS, () => this.compute());
  }

  private async compute() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      companyCount,
      userCount,
      activePlans,
      planStatusCounts,
      churnedLast30Days,
      trialsEndingSoon,
      bookingCounts,
      aiUsageByPlan,
      failedPaymentsLast30Days,
      storageAgg,
      openTicketCount,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { isSuperAdmin: false } }),
      this.prisma.servicePlan.findMany({
        where: { status: "ACTIVE" },
        select: { price: true, billingCycle: true },
      }),
      this.prisma.servicePlan.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.servicePlan.count({
        where: { status: "CANCELLED", cancelledAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.organization.count({
        where: { deletedAt: null, trialEndsAt: { gte: now, lte: sevenDaysFromNow } },
      }),
      this.prisma.bookingRequest.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.organization.groupBy({
        by: ["subscriptionPlan"],
        where: { deletedAt: null },
        _sum: { aiCreditsUsed: true },
        _count: { _all: true },
      }),
      this.prisma.failedPayment.count({ where: { failedAt: { gte: thirtyDaysAgo } } }),
      this.prisma.organization.aggregate({ where: { deletedAt: null }, _sum: { storageUsedBytes: true } }),
      this.prisma.supportTicket.count({ where: { status: "OPEN" } }),
    ]);

    let mrr = 0;
    for (const plan of activePlans) {
      mrr += plan.billingCycle === "MONTHLY" ? Number(plan.price) : Number(plan.price) / 12;
    }

    // Org counts by TradPath subscription tier (STARTER/GROWTH/PRO) — a
    // different axis from the `mrr` above, which is customer-facing
    // ServicePlan revenue our orgs collect from their own customers.
    const orgsByTier = await this.prisma.organization.groupBy({
      by: ["subscriptionPlan"],
      where: { deletedAt: null, subscriptionStatus: { not: "CANCELED" } },
      _count: { _all: true },
    });

    return {
      companyCount,
      userCount,
      platformMrr: round2(mrr),
      platformArr: round2(mrr * 12),
      planGrowthChurn: {
        byStatus: Object.fromEntries(planStatusCounts.map((s) => [s.status, s._count._all])),
        churnedLast30Days,
      },
      trialsEndingSoon,
      bookingsByStatus: Object.fromEntries(bookingCounts.map((b) => [b.status, b._count._all])),
      orgsByTier: Object.fromEntries(orgsByTier.map((o) => [o.subscriptionPlan, o._count._all])),
      aiUsage: aiUsageByPlan.map((row) => ({
        plan: row.subscriptionPlan,
        orgCount: row._count._all,
        creditsUsed: row._sum.aiCreditsUsed ?? 0,
        creditsLimit: AI_CREDIT_LIMITS[row.subscriptionPlan] ?? null,
      })),
      failedPaymentsLast30Days,
      storageUsedBytes: Number(storageAgg._sum.storageUsedBytes ?? 0),
      openTicketCount,
    };
  }
}
