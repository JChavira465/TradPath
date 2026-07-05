import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import {
  SERVICE_PLAN_BILLING_QUEUE,
  SERVICE_PLAN_EXPIRY_QUEUE,
  SERVICE_PLAN_JOB_GENERATOR_QUEUE,
  SERVICE_PLAN_REMINDER_QUEUE,
} from "./queues.constants";

// Each queue runs its "scan" job every hour; the processor itself decides
// whether it's actually 6/7/8/9am in each ORG's own timezone before acting
// (see localHourIn in common/utils/timezone.util.ts) — a single hourly
// cron covers every timezone rather than needing one cron per org.
@Injectable()
export class ServicePlanSchedulersService implements OnModuleInit {
  constructor(
    @InjectQueue(SERVICE_PLAN_JOB_GENERATOR_QUEUE) private readonly jobGeneratorQueue: Queue,
    @InjectQueue(SERVICE_PLAN_BILLING_QUEUE) private readonly billingQueue: Queue,
    @InjectQueue(SERVICE_PLAN_REMINDER_QUEUE) private readonly reminderQueue: Queue,
    @InjectQueue(SERVICE_PLAN_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.jobGeneratorQueue.add("scan", {}, { repeat: { cron: "0 * * * *" }, jobId: "service-plan-job-generator-hourly" }),
      this.billingQueue.add("scan", {}, { repeat: { cron: "0 * * * *" }, jobId: "service-plan-billing-hourly" }),
      this.reminderQueue.add("scan", {}, { repeat: { cron: "0 * * * *" }, jobId: "service-plan-reminder-hourly" }),
      this.expiryQueue.add("scan", {}, { repeat: { cron: "0 * * * *" }, jobId: "service-plan-expiry-hourly" }),
    ]);
  }
}
