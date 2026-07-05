import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import { MORNING_BRIEFING_QUEUE } from "./queues.constants";

@Injectable()
export class MorningBriefingScheduler implements OnModuleInit {
  constructor(@InjectQueue(MORNING_BRIEFING_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      "scan",
      {},
      { repeat: { cron: "0 * * * *" }, jobId: "morning-briefing-hourly" },
    );
  }
}
