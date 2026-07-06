import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bull";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EQUIPMENT_ALERTS_QUEUE,
  INVOICE_FOLLOW_UP_QUEUE,
  MORNING_BRIEFING_QUEUE,
  ONBOARDING_EMAIL_SEQUENCE_QUEUE,
  SERVICE_PLAN_BILLING_QUEUE,
  SERVICE_PLAN_EXPIRY_QUEUE,
  SERVICE_PLAN_JOB_GENERATOR_QUEUE,
  SERVICE_PLAN_REMINDER_QUEUE,
} from "../../queues/queues.constants";

@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);
  private readonly queues: Record<string, Queue>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(INVOICE_FOLLOW_UP_QUEUE) invoiceFollowUp: Queue,
    @InjectQueue(SERVICE_PLAN_JOB_GENERATOR_QUEUE) servicePlanJobGenerator: Queue,
    @InjectQueue(SERVICE_PLAN_BILLING_QUEUE) servicePlanBilling: Queue,
    @InjectQueue(SERVICE_PLAN_REMINDER_QUEUE) servicePlanReminder: Queue,
    @InjectQueue(SERVICE_PLAN_EXPIRY_QUEUE) servicePlanExpiry: Queue,
    @InjectQueue(EQUIPMENT_ALERTS_QUEUE) equipmentAlerts: Queue,
    @InjectQueue(MORNING_BRIEFING_QUEUE) morningBriefing: Queue,
    @InjectQueue(ONBOARDING_EMAIL_SEQUENCE_QUEUE) onboardingEmailSequence: Queue,
  ) {
    this.queues = {
      [INVOICE_FOLLOW_UP_QUEUE]: invoiceFollowUp,
      [SERVICE_PLAN_JOB_GENERATOR_QUEUE]: servicePlanJobGenerator,
      [SERVICE_PLAN_BILLING_QUEUE]: servicePlanBilling,
      [SERVICE_PLAN_REMINDER_QUEUE]: servicePlanReminder,
      [SERVICE_PLAN_EXPIRY_QUEUE]: servicePlanExpiry,
      [EQUIPMENT_ALERTS_QUEUE]: equipmentAlerts,
      [MORNING_BRIEFING_QUEUE]: morningBriefing,
      [ONBOARDING_EMAIL_SEQUENCE_QUEUE]: onboardingEmailSequence,
    };
  }

  async summary() {
    const [api, db, redis, queues, externalServices, errorRate] = await Promise.all([
      this.checkApi(),
      this.checkDb(),
      this.checkRedis(),
      this.checkQueues(),
      Promise.resolve(this.checkExternalServices()),
      this.recentErrorRate(),
    ]);
    return { api, db, redis, queues, externalServices, errorRate };
  }

  private async checkApi() {
    return { status: "ok", uptimeSeconds: Math.round(process.uptime()) };
  }

  private async checkDb() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: "error", message: err.message };
    }
  }

  private async checkRedis() {
    const start = Date.now();
    try {
      // Any of the queues' underlying ioredis client works for a raw ping —
      // they all share the same Redis connection config.
      const anyQueue = Object.values(this.queues)[0];
      await anyQueue.client.ping();
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: "error", message: err.message };
    }
  }

  private async checkQueues() {
    const entries = await Promise.all(
      Object.entries(this.queues).map(async ([name, queue]) => {
        try {
          const counts = await queue.getJobCounts();
          return { name, ...counts };
        } catch (err: any) {
          return { name, status: "error", message: err.message };
        }
      }),
    );
    return entries;
  }

  private checkExternalServices() {
    const isSet = (key: string) => {
      const value = this.config.get<string>(key);
      return !!value && !value.includes("xxx");
    };
    return {
      openai: isSet("OPENAI_API_KEY"),
      twilio: isSet("TWILIO_ACCOUNT_SID") && isSet("TWILIO_AUTH_TOKEN"),
      sendgrid: isSet("SENDGRID_API_KEY"),
      supabaseStorage: isSet("SUPABASE_URL") && isSet("SUPABASE_SERVICE_ROLE_KEY"),
      stripe: isSet("STRIPE_SECRET_KEY"),
      stripeWebhook: isSet("STRIPE_WEBHOOK_SECRET"),
    };
  }

  // Approximates an "error rate" from failed-job counts across queues over
  // the last 24h — there's no separate application-error event stream to
  // query, so failed Bull jobs are the closest proxy already available.
  private async recentErrorRate() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    let failedLast24h = 0;
    let completedLast24h = 0;

    for (const queue of Object.values(this.queues)) {
      const [failed, completed] = await Promise.all([
        queue.getFailed(0, 200),
        queue.getCompleted(0, 200),
      ]);
      failedLast24h += failed.filter((j) => j.finishedOn && j.finishedOn >= oneDayAgo).length;
      completedLast24h += completed.filter((j) => j.finishedOn && j.finishedOn >= oneDayAgo).length;
    }

    const total = failedLast24h + completedLast24h;
    return {
      failedLast24h,
      completedLast24h,
      errorRatePercent: total > 0 ? Math.round((failedLast24h / total) * 10000) / 100 : 0,
    };
  }

  async retryFailedJobs(queueName: string) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new BadRequestException(`Unknown queue: ${queueName}`);
    }
    const failed = await queue.getFailed();
    let retried = 0;
    for (const job of failed) {
      try {
        await job.retry();
        retried += 1;
      } catch (err: any) {
        this.logger.warn({ event: "admin.retry_failed_job_error", queueName, jobId: job.id, message: err.message });
      }
    }
    return { queueName, attempted: failed.length, retried };
  }
}
