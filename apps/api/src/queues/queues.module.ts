import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  EQUIPMENT_ALERTS_QUEUE,
  INVOICE_FOLLOW_UP_QUEUE,
  MORNING_BRIEFING_QUEUE,
  SERVICE_PLAN_BILLING_QUEUE,
  SERVICE_PLAN_EXPIRY_QUEUE,
  SERVICE_PLAN_JOB_GENERATOR_QUEUE,
  SERVICE_PLAN_REMINDER_QUEUE,
} from "./queues.constants";
import { InvoiceFollowUpProcessor } from "./invoice-follow-up.processor";
import { InvoiceFollowUpScheduler } from "./invoice-follow-up.scheduler";
import { ServicePlanJobGeneratorProcessor } from "./service-plan-job-generator.processor";
import { ServicePlanBillingProcessor } from "./service-plan-billing.processor";
import { ServicePlanReminderProcessor } from "./service-plan-reminder.processor";
import { ServicePlanExpiryProcessor } from "./service-plan-expiry.processor";
import { ServicePlanSchedulersService } from "./service-plan-schedulers.service";
import { EquipmentAlertsProcessor } from "./equipment-alerts.processor";
import { EquipmentAlertsScheduler } from "./equipment-alerts.scheduler";
import { MorningBriefingProcessor } from "./morning-briefing.processor";
import { MorningBriefingScheduler } from "./morning-briefing.scheduler";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("REDIS_URL")!;
        const tls = url.startsWith("rediss://") ? {} : undefined;
        // Bull's bclient/subscriber connections are blocking commands and
        // MUST NOT set maxRetriesPerRequest/enableReadyCheck at all — Bull
        // throws MISSING_REDIS_OPTS if they're anything but null/false.
        const createClient = (type: "client" | "subscriber" | "bclient") => {
          if (type === "client") {
            return new Redis(url, { maxRetriesPerRequest: 3, tls });
          }
          return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false, tls });
        };
        return { createClient };
      },
    }),
    BullModule.registerQueue(
      { name: INVOICE_FOLLOW_UP_QUEUE },
      { name: SERVICE_PLAN_JOB_GENERATOR_QUEUE },
      { name: SERVICE_PLAN_BILLING_QUEUE },
      { name: SERVICE_PLAN_REMINDER_QUEUE },
      { name: SERVICE_PLAN_EXPIRY_QUEUE },
      { name: EQUIPMENT_ALERTS_QUEUE },
      { name: MORNING_BRIEFING_QUEUE },
    ),
  ],
  providers: [
    InvoiceFollowUpProcessor,
    InvoiceFollowUpScheduler,
    ServicePlanJobGeneratorProcessor,
    ServicePlanBillingProcessor,
    ServicePlanReminderProcessor,
    ServicePlanExpiryProcessor,
    ServicePlanSchedulersService,
    EquipmentAlertsProcessor,
    EquipmentAlertsScheduler,
    MorningBriefingProcessor,
    MorningBriefingScheduler,
  ],
  exports: [BullModule],
})
export class QueuesModule {}
