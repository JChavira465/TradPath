import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import { INVOICE_FOLLOW_UP_QUEUE } from "./queues.constants";

@Injectable()
export class InvoiceFollowUpScheduler implements OnModuleInit {
  constructor(@InjectQueue(INVOICE_FOLLOW_UP_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Idempotent: Bull dedupes repeatable jobs with the same jobId, so
    // re-registering on every boot doesn't create duplicates.
    await this.queue.add(
      "scan",
      {},
      {
        repeat: { cron: "0 9 * * *" },
        jobId: "invoice-follow-up-daily-scan",
      },
    );
  }
}
