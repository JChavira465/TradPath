import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
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
import { SystemHealthController } from "./system-health.controller";
import { SystemHealthService } from "./system-health.service";

@Module({
  imports: [
    // Reuses the shared connection config from BullModule.forRootAsync,
    // already established by QueuesModule elsewhere in the module graph —
    // registerQueue here just gives this module its own client handles to
    // the SAME underlying queues, for read-only health inspection.
    BullModule.registerQueue(
      { name: INVOICE_FOLLOW_UP_QUEUE },
      { name: SERVICE_PLAN_JOB_GENERATOR_QUEUE },
      { name: SERVICE_PLAN_BILLING_QUEUE },
      { name: SERVICE_PLAN_REMINDER_QUEUE },
      { name: SERVICE_PLAN_EXPIRY_QUEUE },
      { name: EQUIPMENT_ALERTS_QUEUE },
      { name: MORNING_BRIEFING_QUEUE },
      { name: ONBOARDING_EMAIL_SEQUENCE_QUEUE },
    ),
  ],
  controllers: [SystemHealthController],
  providers: [SystemHealthService],
})
export class SystemHealthModule {}
