import { Logger } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { localHourIn, startOfLocalDay } from "../common/utils/timezone.util";
import { SERVICE_PLAN_REMINDER_QUEUE } from "./queues.constants";

const TARGET_HOUR = 8;
const REMINDER_WINDOW_DAYS = 3;

@Processor(SERVICE_PLAN_REMINDER_QUEUE)
export class ServicePlanReminderProcessor {
  private readonly logger = new Logger(ServicePlanReminderProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // Reminds customers ahead of an upcoming visit. SMS/email dispatch isn't
  // wired yet (no Twilio/SendGrid), so this logs intent — same pattern as
  // the invoice follow-up processor.
  @Process("scan")
  async scan(job: Job<{ force?: boolean }>) {
    const orgs = await this.prisma.organization.findMany({ select: { id: true, timezone: true } });
    let reminded = 0;

    for (const org of orgs) {
      if (!job.data?.force && localHourIn(org.timezone) !== TARGET_HOUR) continue;

      const today = startOfLocalDay(org.timezone);
      const windowEnd = new Date(today.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const upcoming = await this.prisma.servicePlan.findMany({
        where: {
          organizationId: org.id,
          status: "ACTIVE",
          nextServiceDate: { gte: today, lte: windowEnd },
        },
        include: { customer: true },
      });

      for (const plan of upcoming) {
        this.logger.log({
          event: "service_plan.reminder_sent",
          servicePlanId: plan.id,
          nextServiceDate: plan.nextServiceDate,
          channel: plan.customer.email ? "email" : plan.customer.phone ? "sms" : "none",
        });
        reminded += 1;
      }
    }

    return { reminded };
  }
}
