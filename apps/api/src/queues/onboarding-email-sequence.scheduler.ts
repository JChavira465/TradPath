import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import { ONBOARDING_EMAIL_SEQUENCE_QUEUE } from "./queues.constants";

@Injectable()
export class OnboardingEmailSequenceScheduler implements OnModuleInit {
  constructor(@InjectQueue(ONBOARDING_EMAIL_SEQUENCE_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      "scan",
      {},
      { repeat: { cron: "0 9 * * *" }, jobId: "onboarding-email-sequence-daily" },
    );
  }
}
