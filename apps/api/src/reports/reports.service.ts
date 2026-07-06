import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../redis/cache.service";
import { InvoicesService } from "../invoices/invoices.service";
import { ServicePlansService } from "../service-plans/service-plans.service";
import { AI_CREDIT_LIMITS } from "../ai/ai-credit-limits.constant";
import { ReportsQueryDto } from "./dto/reports-query.dto";

const CACHE_TTL_SECONDS = 300;
const MARGIN_HEALTHY_THRESHOLD = 20; // percent — >= is "green"
const MRR_TREND_MONTHS = 6;
const TOP_CUSTOMERS_LIMIT = 10;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Rounds down to the cache-TTL bucket so repeated no-range requests within
// the same window produce an identical cache key — otherwise a bare
// `new Date()` default is unique to the millisecond and the cache never hits.
function roundToCacheBucket(date: Date): Date {
  const bucketMs = CACHE_TTL_SECONDS * 1000;
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly invoices: InvoicesService,
    private readonly servicePlans: ServicePlansService,
  ) {}

  private range(query: ReportsQueryDto) {
    const to = query.to ? new Date(query.to) : roundToCacheBucket(new Date());
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  async summary(orgId: string, query: ReportsQueryDto) {
    const { from, to } = this.range(query);
    const cacheKey = `reports:${orgId}:${from.toISOString()}:${to.toISOString()}`;
    return this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS, () => this.compute(orgId, from, to));
  }

  private async compute(orgId: string, from: Date, to: Date) {
    const [
      revenue,
      mrrTrend,
      profitPerJob,
      jobStats,
      topCustomers,
      employeeHours,
      arAging,
      planGrowthChurn,
      bookingConversion,
      aiUsage,
    ] = await Promise.all([
      this.revenue(orgId, from, to),
      this.mrrTrend(orgId),
      this.profitPerJob(orgId, from, to),
      this.jobStats(orgId, from, to),
      this.topCustomers(orgId, from, to),
      this.employeeHours(orgId, from, to),
      this.invoices.arSummary(orgId),
      this.planGrowthChurn(orgId, from, to),
      this.bookingConversion(orgId, from, to),
      this.aiUsage(orgId),
    ]);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      revenue,
      mrrTrend,
      profitPerJob,
      completionRate: jobStats.completionRate,
      avgJobValue: jobStats.avgJobValue,
      topCustomers,
      employeeHours,
      arAging,
      planGrowthChurn,
      bookingConversion,
      aiUsage,
    };
  }

  private async revenue(orgId: string, from: Date, to: Date) {
    const invoicesInRange = await this.prisma.invoice.findMany({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to }, status: { not: "VOID" } },
      select: { type: true, total: true },
    });
    const oneTime = invoicesInRange.filter((i) => i.type === "ONE_TIME").reduce((s, i) => s + Number(i.total), 0);
    const recurring = invoicesInRange.filter((i) => i.type === "SUBSCRIPTION").reduce((s, i) => s + Number(i.total), 0);
    return { oneTime: round2(oneTime), recurring: round2(recurring), total: round2(oneTime + recurring) };
  }

  // Reconstructs an approximate MRR at each of the last N month-ends from
  // ServicePlan create/cancel timestamps — there's no stored MRR snapshot
  // history, so this is a best-effort trend, not a ledger.
  private async mrrTrend(orgId: string) {
    const plans = await this.prisma.servicePlan.findMany({
      where: { organizationId: orgId },
      select: { price: true, billingCycle: true, startDate: true, cancelledAt: true, status: true },
    });

    const months: { month: string; mrr: number }[] = [];
    const now = new Date();
    for (let i = MRR_TREND_MONTHS - 1; i >= 0; i--) {
      const targetMonth = now.getMonth() - i;
      const monthEnd = new Date(now.getFullYear(), targetMonth + 1, 0, 23, 59, 59);
      let mrr = 0;
      for (const plan of plans) {
        const started = plan.startDate <= monthEnd;
        const stillActiveAtMonthEnd = !plan.cancelledAt || plan.cancelledAt > monthEnd;
        if (started && stillActiveAtMonthEnd) {
          mrr += plan.billingCycle === "MONTHLY" ? Number(plan.price) : Number(plan.price) / 12;
        }
      }
      // Label built from local year/month arithmetic directly (never via
      // monthEnd.toISOString()) — converting a local end-of-day Date to
      // UTC can roll it into the next calendar month for any timezone
      // behind UTC, mislabeling the most recent month as next month's.
      const labelDate = new Date(now.getFullYear(), targetMonth, 1);
      const month = `${labelDate.getFullYear()}-${String(labelDate.getMonth() + 1).padStart(2, "0")}`;
      months.push({ month, mrr: round2(mrr) });
    }
    return months;
  }

  private async profitPerJob(orgId: string, from: Date, to: Date) {
    const jobs = await this.prisma.job.findMany({
      where: { organizationId: orgId, status: "COMPLETED", actualEnd: { gte: from, lte: to } },
      select: { id: true, jobNumber: true, title: true, totalRevenue: true, laborCost: true, materialCost: true, profit: true },
      orderBy: { actualEnd: "desc" },
      take: 100,
    });
    return jobs.map((job) => {
      const revenue = Number(job.totalRevenue);
      const profit = Number(job.profit);
      const marginPercent = revenue > 0 ? round2((profit / revenue) * 100) : null;
      return {
        jobId: job.id,
        jobNumber: job.jobNumber,
        title: job.title,
        revenue,
        laborCost: Number(job.laborCost),
        materialCost: Number(job.materialCost),
        profit,
        marginPercent,
        healthy: marginPercent !== null && marginPercent >= MARGIN_HEALTHY_THRESHOLD,
      };
    });
  }

  private async jobStats(orgId: string, from: Date, to: Date) {
    const [total, completed, completedWithRevenue] = await Promise.all([
      this.prisma.job.count({ where: { organizationId: orgId, createdAt: { gte: from, lte: to } } }),
      this.prisma.job.count({ where: { organizationId: orgId, status: "COMPLETED", actualEnd: { gte: from, lte: to } } }),
      this.prisma.job.aggregate({
        where: { organizationId: orgId, status: "COMPLETED", actualEnd: { gte: from, lte: to }, totalRevenue: { gt: 0 } },
        _avg: { totalRevenue: true },
        _count: true,
      }),
    ]);
    return {
      completionRate: total > 0 ? round2((completed / total) * 100) : 0,
      avgJobValue: completedWithRevenue._count > 0 ? round2(Number(completedWithRevenue._avg.totalRevenue ?? 0)) : 0,
    };
  }

  private async topCustomers(orgId: string, from: Date, to: Date) {
    const grouped = await this.prisma.invoice.groupBy({
      by: ["customerId"],
      where: { organizationId: orgId, createdAt: { gte: from, lte: to }, status: { not: "VOID" } },
      _sum: { total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
      take: TOP_CUSTOMERS_LIMIT,
    });
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId) } },
      select: { id: true, firstName: true, lastName: true, company: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));
    return grouped.map((g) => {
      const c = byId.get(g.customerId);
      return {
        customerId: g.customerId,
        name: c ? (c.company || `${c.firstName} ${c.lastName}`) : "Unknown",
        totalBilled: round2(Number(g._sum.total ?? 0)),
        invoiceCount: g._count._all,
      };
    });
  }

  private async employeeHours(orgId: string, from: Date, to: Date) {
    const entries = await this.prisma.timeEntry.findMany({
      where: { organizationId: orgId, clockIn: { gte: from, lte: to }, clockOut: { not: null } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    const byUser = new Map<string, { userId: string; name: string; totalHours: number; overtimeHours: number }>();
    for (const entry of entries) {
      const key = entry.userId;
      if (!byUser.has(key)) {
        byUser.set(key, { userId: key, name: `${entry.user.firstName} ${entry.user.lastName}`, totalHours: 0, overtimeHours: 0 });
      }
      const bucket = byUser.get(key)!;
      bucket.totalHours += Number(entry.totalHours ?? 0);
      bucket.overtimeHours += Number(entry.overtimeHours ?? 0);
    }
    return Array.from(byUser.values()).map((b) => ({
      ...b,
      totalHours: round2(b.totalHours),
      overtimeHours: round2(b.overtimeHours),
    }));
  }

  private async planGrowthChurn(orgId: string, from: Date, to: Date) {
    const [dashboard, newPlansInRange] = await Promise.all([
      this.servicePlans.dashboard(orgId),
      this.prisma.servicePlan.count({ where: { organizationId: orgId, startDate: { gte: from, lte: to } } }),
    ]);
    return { ...dashboard, newPlansInRange };
  }

  private async bookingConversion(orgId: string, from: Date, to: Date) {
    const requests = await this.prisma.bookingRequest.findMany({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
      select: { status: true },
    });
    const total = requests.length;
    const confirmed = requests.filter((r) => r.status === "CONFIRMED").length;
    return {
      total,
      confirmed,
      conversionRate: total > 0 ? round2((confirmed / total) * 100) : 0,
    };
  }

  private async aiUsage(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionPlan: true, aiCreditsUsed: true, aiCreditsResetAt: true },
    });
    const limit = AI_CREDIT_LIMITS[org?.subscriptionPlan ?? "STARTER"] ?? 0;
    return {
      plan: org?.subscriptionPlan ?? "STARTER",
      creditsUsed: org?.aiCreditsUsed ?? 0,
      creditsLimit: limit === Infinity ? null : limit,
      resetAt: org?.aiCreditsResetAt?.toISOString() ?? null,
    };
  }
}
