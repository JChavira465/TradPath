import { Logger } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { OnboardingService } from "../onboarding/onboarding.service";
import { ONBOARDING_EMAIL_SEQUENCE_QUEUE } from "./queues.constants";

const SEQUENCE_DAYS = [0, 1, 3, 5, 7, 10, 12, 14];

const DAY_SUBJECT: Record<number, string> = {
  0: "Welcome to TradPath!",
  1: "Getting the most out of TradPath",
  3: "A few quick wins for your first week",
  5: "Still setting up? Here's where to start",
  7: "One week in — how's it going?",
  10: "A couple of things left to try",
  12: "Almost done setting up",
  14: "Your trial highlights so far",
};

@Processor(ONBOARDING_EMAIL_SEQUENCE_QUEUE)
export class OnboardingEmailSequenceProcessor {
  private readonly logger = new Logger(OnboardingEmailSequenceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly onboarding: OnboardingService,
    private readonly config: ConfigService,
  ) {}

  // Daily-cadence onboarding drip. Stops entirely once the org upgrades off
  // the free/starter plan (spec: "stops on upgrade") — dismissing the
  // in-app checklist widget does NOT stop these, only an actual upgrade
  // does. Each step is skipped if the org already completed that part of
  // the checklist, so nobody gets nagged about something they've already
  // done. EmailService itself checks the suppression list before every
  // send, so an unsubscribed address is honored automatically here too.
  @Process("scan")
  async scan(job: Job<{ force?: boolean }>) {
    const orgs = await this.prisma.organization.findMany({
      where: { subscriptionPlan: "STARTER" },
      select: { id: true, name: true, createdAt: true },
    });

    let sent = 0;
    const now = new Date();

    for (const org of orgs) {
      const daysSinceSignup = Math.floor((now.getTime() - org.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      if (!job.data?.force && !SEQUENCE_DAYS.includes(daysSinceSignup)) continue;

      const alreadySent = await this.prisma.onboardingEmailLog.findUnique({
        where: { organizationId_day: { organizationId: org.id, day: daysSinceSignup } },
      });
      if (alreadySent) continue;

      const owner = await this.prisma.user.findFirst({
        where: { organizationId: org.id, role: "OWNER" },
        orderBy: { createdAt: "asc" },
        select: { email: true, firstName: true },
      });
      if (!owner) continue;

      const checklist = await this.onboarding.checklist(org.id);
      const remaining = checklist.items.filter((i) => !i.done);
      if (remaining.length === 0) continue;

      const frontendUrl = this.config.get<string>("FRONTEND_URL");
      const unsubscribeUrl = `${this.config.get<string>("API_URL")}/api/email/unsubscribe?email=${encodeURIComponent(owner.email)}`;
      const itemsHtml = remaining
        .slice(0, 3)
        .map((i) => `<li><a href="${frontendUrl}${i.actionHref}">${i.label}</a></li>`)
        .join("");

      const sentOk = await this.email.send({
        to: owner.email,
        subject: DAY_SUBJECT[daysSinceSignup] ?? "Getting started with TradPath",
        html: `<p>Hi ${owner.firstName},</p><p>Here's what's left to finish setting up ${org.name}:</p><ul>${itemsHtml}</ul><p style="margin-top:24px;font-size:12px;color:#999;"><a href="${unsubscribeUrl}">Unsubscribe from these emails</a></p>`,
      });

      await this.prisma.onboardingEmailLog.create({ data: { organizationId: org.id, day: daysSinceSignup } });
      if (sentOk) sent += 1;

      this.logger.log({ event: "onboarding_email.sent", organizationId: org.id, day: daysSinceSignup, delivered: sentOk });
    }

    return { sent };
  }
}
