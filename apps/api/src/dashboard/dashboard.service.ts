import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InvoicesService } from "../invoices/invoices.service";
import { ServicePlansService } from "../service-plans/service-plans.service";
import { startOfLocalDay } from "../common/utils/timezone.util";

const RENEWAL_WINDOW_DAYS = 14;

interface ActivityItem {
  type: "payment" | "invoice_sent" | "job_completed" | "booking_request";
  description: string;
  timestamp: Date;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly servicePlans: ServicePlansService,
  ) {}

  async summary(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
    const timezone = org?.timezone ?? "America/Chicago";

    const today = startOfLocalDay(timezone);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const renewalWindowEnd = new Date(today.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      todayJobs,
      weekJobs,
      pendingBookingsCount,
      arSummary,
      clockedInCount,
      thisMonthPayments,
      lastMonthPayments,
      planDashboard,
      renewalsDueSoon,
      unreadMessagesCount,
      recentPayments,
      recentInvoicesSent,
      recentCompletedJobs,
      recentBookings,
    ] = await Promise.all([
      this.prisma.job.findMany({
        where: { organizationId: orgId, scheduledStart: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } },
        include: { customer: true },
        orderBy: { scheduledStart: "asc" },
      }),
      this.prisma.job.findMany({
        where: { organizationId: orgId, scheduledStart: { gte: today, lt: weekEnd } },
        include: { customer: true },
        orderBy: { scheduledStart: "asc" },
      }),
      this.prisma.bookingRequest.count({ where: { organizationId: orgId, status: "PENDING" } }),
      this.invoices.arSummary(orgId),
      this.prisma.timeEntry.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
      this.prisma.payment.aggregate({
        where: { organizationId: orgId, paidAt: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { organizationId: orgId, paidAt: { gte: lastMonthStart, lt: thisMonthStart } },
        _sum: { amount: true },
      }),
      this.servicePlans.dashboard(orgId),
      this.prisma.servicePlan.findMany({
        where: { organizationId: orgId, status: "ACTIVE", nextBillingDate: { gte: today, lte: renewalWindowEnd } },
        include: { customer: true },
        orderBy: { nextBillingDate: "asc" },
      }),
      this.prisma.jobTextMessage.count({ where: { organizationId: orgId, direction: "INBOUND", readAt: null } }),
      this.prisma.payment.findMany({
        where: { organizationId: orgId },
        orderBy: { paidAt: "desc" },
        take: 5,
        include: { invoice: { select: { invoiceNumber: true } } },
      }),
      this.prisma.invoice.findMany({
        where: { organizationId: orgId, sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        take: 5,
        select: { invoiceNumber: true, sentAt: true, total: true },
      }),
      this.prisma.job.findMany({
        where: { organizationId: orgId, status: "COMPLETED" },
        orderBy: { actualEnd: "desc" },
        take: 5,
        select: { jobNumber: true, title: true, actualEnd: true },
      }),
      this.prisma.bookingRequest.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { firstName: true, lastName: true, createdAt: true },
      }),
    ]);

    const thisMonthRevenue = Number(thisMonthPayments._sum.amount ?? 0);
    const lastMonthRevenue = Number(lastMonthPayments._sum.amount ?? 0);
    const revenueMoMChangePercent =
      lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : null;

    const activity: ActivityItem[] = [
      ...recentPayments.map((p) => ({
        type: "payment" as const,
        description: `Payment of $${Number(p.amount).toFixed(2)} received for invoice #${p.invoice.invoiceNumber}`,
        timestamp: p.paidAt,
      })),
      ...recentInvoicesSent.map((i) => ({
        type: "invoice_sent" as const,
        description: `Invoice #${i.invoiceNumber} sent for $${Number(i.total).toFixed(2)}`,
        timestamp: i.sentAt!,
      })),
      ...recentCompletedJobs
        .filter((j) => j.actualEnd)
        .map((j) => ({
          type: "job_completed" as const,
          description: `Job #${j.jobNumber} (${j.title}) completed`,
          timestamp: j.actualEnd!,
        })),
      ...recentBookings.map((b) => ({
        type: "booking_request" as const,
        description: `New booking request from ${b.firstName} ${b.lastName}`,
        timestamp: b.createdAt,
      })),
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      todayJobs,
      weekJobs,
      pendingBookingsCount,
      arSummary,
      clockedInCount,
      revenueMoM: { thisMonth: thisMonthRevenue, lastMonth: lastMonthRevenue, changePercent: revenueMoMChangePercent },
      planMrr: { mrr: planDashboard.mrr, arr: planDashboard.arr, activeCount: planDashboard.activeCount },
      renewalsDueSoon,
      unreadMessagesCount,
      activity,
    };
  }
}
