import { Logger } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { startOfLocalDay, localHourIn } from "../common/utils/timezone.util";
import { MORNING_BRIEFING_QUEUE } from "./queues.constants";

const RENEWAL_WINDOW_DAYS = 3;

@Processor(MORNING_BRIEFING_QUEUE)
export class MorningBriefingProcessor {
  private readonly logger = new Logger(MorningBriefingProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // Per-org, timezone-aware daily digest. SMS/push dispatch isn't wired up
  // (matches every other processor in this file) — this logs the compiled
  // summary so it can be swapped for real delivery once channels exist.
  @Process("scan")
  async scan(job: Job<{ force?: boolean }>) {
    const orgs = await this.prisma.organization.findMany({
      where: { morningBriefingEnabled: true },
      select: { id: true, timezone: true, morningBriefingTime: true, morningBriefingChannel: true },
    });

    let sent = 0;

    for (const org of orgs) {
      const targetHour = Number(org.morningBriefingTime.split(":")[0]) || 7;
      if (!job.data?.force && localHourIn(org.timezone) !== targetHour) continue;

      const today = startOfLocalDay(org.timezone);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const renewalWindowEnd = new Date(today.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const [jobsToday, ar, clockedIn, bookingsToday, renewalsDue] = await Promise.all([
        this.prisma.job.count({
          where: { organizationId: org.id, scheduledStart: { gte: today, lt: tomorrow } },
        }),
        this.prisma.invoice.aggregate({
          where: { organizationId: org.id, status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] } },
          _sum: { amountDue: true },
          _count: true,
        }),
        this.prisma.timeEntry.count({ where: { organizationId: org.id, clockOut: null } }),
        this.prisma.bookingRequest.count({
          where: { organizationId: org.id, status: "PENDING", requestedDate: { gte: today, lt: tomorrow } },
        }),
        this.prisma.servicePlan.count({
          where: { organizationId: org.id, status: "ACTIVE", nextBillingDate: { gte: today, lte: renewalWindowEnd } },
        }),
      ]);

      this.logger.log({
        event: "morning_briefing.sent",
        organizationId: org.id,
        channel: org.morningBriefingChannel,
        jobsToday,
        outstandingAr: Number(ar._sum.amountDue ?? 0),
        overdueInvoiceCount: ar._count,
        clockedIn,
        pendingBookingsToday: bookingsToday,
        renewalsDueSoon: renewalsDue,
      });
      sent += 1;
    }

    return { sent };
  }
}
