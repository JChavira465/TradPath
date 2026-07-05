import { Logger } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { localHourIn, startOfLocalDay } from "../common/utils/timezone.util";
import { SERVICE_PLAN_EXPIRY_QUEUE } from "./queues.constants";

const TARGET_HOUR = 9;

@Processor(SERVICE_PLAN_EXPIRY_QUEUE)
export class ServicePlanExpiryProcessor {
  private readonly logger = new Logger(ServicePlanExpiryProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process("scan")
  async scan(job: Job<{ force?: boolean }>) {
    const orgs = await this.prisma.organization.findMany({ select: { id: true, timezone: true } });
    let expired = 0;

    for (const org of orgs) {
      if (!job.data?.force && localHourIn(org.timezone) !== TARGET_HOUR) continue;

      const today = startOfLocalDay(org.timezone);
      const result = await this.prisma.servicePlan.updateMany({
        where: {
          organizationId: org.id,
          status: { in: ["ACTIVE", "PAUSED"] },
          endDate: { lte: today },
        },
        data: { status: "EXPIRED" },
      });
      expired += result.count;
    }

    if (expired > 0) {
      this.logger.log({ event: "service_plan.expired_batch", count: expired });
    }
    return { expired };
  }
}
