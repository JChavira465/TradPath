import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../redis/cache.service";

const CACHE_TTL_SECONDS = 300;
const TREND_MONTHS = 6;
const AT_RISK_NO_LOGIN_DAYS = 30;
const AT_RISK_HEALTH_SCORE_THRESHOLD = 40;
const AT_RISK_FAILED_PAYMENT_THRESHOLD = 2;

function roundToCacheBucket(date: Date): Date {
  const bucketMs = CACHE_TTL_SECONDS * 1000;
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
}

function monthLabel(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

@Injectable()
export class PlatformReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async summary() {
    const bucket = roundToCacheBucket(new Date()).toISOString();
    return this.cache.getOrSet(`admin:platform-reports:${bucket}`, CACHE_TTL_SECONDS, () => this.compute());
  }

  private async compute() {
    const [signupsTrend, revenueTrend, planDistribution] = await Promise.all([
      this.signupsTrend(),
      this.revenueTrend(),
      this.planDistribution(),
    ]);
    return { signupsTrend, revenueTrend, planDistribution };
  }

  // Same month-bucketing approach as ReportsService.mrrTrend (S8) — labels
  // built from local year/month arithmetic, never from a UTC-converted
  // Date, to avoid mislabeling the current month near timezone boundaries.
  private monthRanges() {
    const now = new Date();
    const ranges: { label: string; start: Date; end: Date }[] = [];
    for (let i = TREND_MONTHS - 1; i >= 0; i--) {
      const targetMonth = now.getMonth() - i;
      const start = new Date(now.getFullYear(), targetMonth, 1);
      const end = new Date(now.getFullYear(), targetMonth + 1, 0, 23, 59, 59);
      ranges.push({ label: monthLabel(start.getFullYear(), start.getMonth()), start, end });
    }
    return ranges;
  }

  private async signupsTrend() {
    const ranges = this.monthRanges();
    return Promise.all(
      ranges.map(async ({ label, start, end }) => {
        const count = await this.prisma.organization.count({ where: { createdAt: { gte: start, lte: end } } });
        return { month: label, signups: count };
      }),
    );
  }

  private async revenueTrend() {
    const ranges = this.monthRanges();
    return Promise.all(
      ranges.map(async ({ label, start, end }) => {
        const invoices = await this.prisma.invoice.findMany({
          where: { createdAt: { gte: start, lte: end }, status: { not: "VOID" } },
          select: { total: true },
        });
        const revenue = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
        return { month: label, revenue: Math.round(revenue * 100) / 100 };
      }),
    );
  }

  private async planDistribution() {
    const counts = await this.prisma.organization.groupBy({
      by: ["subscriptionPlan"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    return Object.fromEntries(counts.map((c) => [c.subscriptionPlan, c._count._all]));
  }

  // At-risk signals: an org can trip more than one signal at once. This is
  // a lightweight heuristic pass (not a scoring model) meant to surface a
  // shortlist for a human to look at, not a definitive churn prediction.
  async atRiskOrgs() {
    const now = new Date();
    const noLoginCutoff = new Date(now.getTime() - AT_RISK_NO_LOGIN_DAYS * 24 * 60 * 60 * 1000);

    const orgs = await this.prisma.organization.findMany({
      where: { deletedAt: null, isArchived: false },
      select: {
        id: true,
        name: true,
        slug: true,
        healthScore: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        users: { select: { lastLoginAt: true }, orderBy: { lastLoginAt: "desc" }, take: 1 },
        _count: { select: { jobs: true, invoices: true } },
      },
    });

    const orgIds = orgs.map((o) => o.id);
    const failedPaymentCounts = await this.prisma.failedPayment.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgIds }, failedAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } },
      _count: { _all: true },
    });
    const failedByOrg = new Map(failedPaymentCounts.map((f) => [f.organizationId, f._count._all]));

    const results = orgs.map((org) => {
      const lastLoginAt = org.users[0]?.lastLoginAt ?? null;
      const failedPaymentCount = failedByOrg.get(org.id) ?? 0;

      const signals: string[] = [];
      if (org.healthScore !== null && org.healthScore < AT_RISK_HEALTH_SCORE_THRESHOLD) signals.push("LOW_HEALTH_SCORE");
      if (!lastLoginAt || lastLoginAt < noLoginCutoff) signals.push("NO_RECENT_LOGIN");
      if (failedPaymentCount >= AT_RISK_FAILED_PAYMENT_THRESHOLD) signals.push("REPEATED_FAILED_PAYMENTS");
      if (org._count.jobs === 0 && org._count.invoices === 0) signals.push("NO_USAGE");

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.subscriptionPlan,
        status: org.subscriptionStatus,
        healthScore: org.healthScore,
        lastLoginAt,
        failedPaymentCount,
        jobCount: org._count.jobs,
        invoiceCount: org._count.invoices,
        signals,
      };
    });

    return results.filter((r) => r.signals.length > 0).sort((a, b) => b.signals.length - a.signals.length);
  }
}
