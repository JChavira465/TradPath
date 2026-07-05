import { Logger } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { advanceByFrequency } from "../common/utils/service-frequency.util";
import { localHourIn, startOfLocalDay } from "../common/utils/timezone.util";
import { withRetryOnCollision } from "../common/utils/sequential-number.util";
import { SERVICE_PLAN_JOB_GENERATOR_QUEUE } from "./queues.constants";

const TARGET_HOUR = 6;

@Processor(SERVICE_PLAN_JOB_GENERATOR_QUEUE)
export class ServicePlanJobGeneratorProcessor {
  private readonly logger = new Logger(ServicePlanJobGeneratorProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process("scan")
  async scan(job: Job<{ force?: boolean }>) {
    const orgs = await this.prisma.organization.findMany({ select: { id: true, timezone: true } });
    let generated = 0;

    for (const org of orgs) {
      if (!job.data?.force && localHourIn(org.timezone) !== TARGET_HOUR) continue;

      const today = startOfLocalDay(org.timezone);
      const duePlans = await this.prisma.servicePlan.findMany({
        where: {
          organizationId: org.id,
          status: "ACTIVE",
          autoGenerateJobs: true,
          nextServiceDate: { lte: today },
        },
      });

      for (const plan of duePlans) {
        generated += await this.generateForPlan(org.id, plan);
      }
    }

    return { generated };
  }

  private async generateForPlan(orgId: string, plan: { id: string; nextServiceDate: Date | null; customerId: string; name: string; serviceDescription: string | null; assignedUserIds: string[]; createdBy: string; serviceFrequency: any }) {
    const scheduledFor = plan.nextServiceDate ?? new Date();

    // Idempotent — never generate a second job for the same due date.
    const existing = await this.prisma.servicePlanJob.findFirst({
      where: { servicePlanId: plan.id, scheduledFor },
    });
    if (existing) {
      return 0;
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: plan.customerId } });

    const jobNumber = await withRetryOnCollision(() =>
      this.prisma.$transaction(async (tx) => {
        const lastJob = await tx.job.findFirst({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          select: { jobNumber: true },
        });
        const jobNumber = String(lastJob ? (parseInt(lastJob.jobNumber, 10) || 1000) + 1 : 1001);

        const created = await tx.job.create({
          data: {
            organizationId: orgId,
            customerId: plan.customerId,
            jobNumber,
            title: plan.name,
            description: plan.serviceDescription,
            type: "RECURRING",
            serviceAddress: customer?.serviceAddress,
            city: customer?.city,
            state: customer?.state,
            zip: customer?.zip,
            scheduledStart: scheduledFor,
            assignedUserIds: plan.assignedUserIds,
            createdBy: plan.createdBy,
          },
        });
        await tx.servicePlanJob.create({
          data: { servicePlanId: plan.id, jobId: created.id, scheduledFor },
        });
        await tx.servicePlan.update({
          where: { id: plan.id },
          data: { nextServiceDate: advanceByFrequency(scheduledFor, plan.serviceFrequency) },
        });
        return jobNumber;
      }),
    );

    this.logger.log({ event: "service_plan.job_generated", servicePlanId: plan.id, jobNumber });
    return 1;
  }
}
