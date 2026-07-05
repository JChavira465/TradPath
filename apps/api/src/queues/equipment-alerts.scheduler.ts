import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import { EQUIPMENT_ALERTS_QUEUE } from "./queues.constants";

@Injectable()
export class EquipmentAlertsScheduler implements OnModuleInit {
  constructor(@InjectQueue(EQUIPMENT_ALERTS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      "scan",
      {},
      { repeat: { cron: "0 * * * *" }, jobId: "equipment-alerts-hourly" },
    );
  }
}
