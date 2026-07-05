import { Logger } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { billingPeriodFor } from "../common/utils/service-frequency.util";
import { localHourIn, startOfLocalDay } from "../common/utils/timezone.util";
import { withRetryOnCollision } from "../common/utils/sequential-number.util";
import { SERVICE_PLAN_BILLING_QUEUE } from "./queues.constants";

const TARGET_HOUR = 7;

@Processor(SERVICE_PLAN_BILLING_QUEUE)
export class ServicePlanBillingProcessor {
  private readonly logger = new Logger(ServicePlanBillingProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process("scan")
  async scan(job: Job<{ force?: boolean }>) {
    const orgs = await this.prisma.organization.findMany({ select: { id: true, timezone: true, defaultInvoiceDueDays: true } });
    let billed = 0;

    for (const org of orgs) {
      if (!job.data?.force && localHourIn(org.timezone) !== TARGET_HOUR) continue;

      const today = startOfLocalDay(org.timezone);
      const duePlans = await this.prisma.servicePlan.findMany({
        where: {
          organizationId: org.id,
          status: "ACTIVE",
          autoSendInvoice: true,
          nextBillingDate: { lte: today },
        },
      });

      for (const plan of duePlans) {
        billed += await this.billPlan(org.id, org.defaultInvoiceDueDays, plan);
      }
    }

    return { billed };
  }

  private async billPlan(
    orgId: string,
    defaultDueDays: number,
    plan: { id: string; nextBillingDate: Date | null; billingCycle: "MONTHLY" | "ANNUAL"; customerId: string; name: string; price: any; discountPercent: any },
  ) {
    const cycleStart = plan.nextBillingDate ?? new Date();
    const { start, end } = billingPeriodFor(cycleStart, plan.billingCycle);

    // Idempotent — never double-bill the same period, even if the scan
    // somehow runs twice for the same org/hour.
    const existing = await this.prisma.servicePlanInvoice.findUnique({
      where: {
        servicePlanId_billingPeriodStart_billingPeriodEnd: {
          servicePlanId: plan.id,
          billingPeriodStart: start,
          billingPeriodEnd: end,
        },
      },
    });
    if (existing) {
      return 0;
    }

    const price = Number(plan.price);
    const discount = (Number(plan.discountPercent) / 100) * price;
    const total = Math.round((price - discount) * 100) / 100;

    const invoiceNumber = await withRetryOnCollision(() =>
      this.prisma.$transaction(async (tx) => {
        const lastInvoice = await tx.invoice.findFirst({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          select: { invoiceNumber: true },
        });
        const invoiceNumber = String(lastInvoice ? (parseInt(lastInvoice.invoiceNumber, 10) || 1000) + 1 : 1001);

        const invoice = await tx.invoice.create({
          data: {
            organizationId: orgId,
            customerId: plan.customerId,
            servicePlanId: plan.id,
            invoiceNumber,
            type: "SUBSCRIPTION",
            dueDate: new Date(Date.now() + defaultDueDays * 24 * 60 * 60 * 1000),
            lineItems: [{ description: plan.name, quantity: 1, unitPrice: price, taxable: false }],
            subtotal: price,
            taxRate: 0,
            taxAmount: 0,
            discountAmount: discount,
            total,
            amountPaid: 0,
            amountDue: total,
            createdBy: "system",
          },
        });
        await tx.servicePlanInvoice.create({
          data: { servicePlanId: plan.id, invoiceId: invoice.id, billingPeriodStart: start, billingPeriodEnd: end },
        });
        await tx.servicePlan.update({ where: { id: plan.id }, data: { nextBillingDate: end } });
        return invoiceNumber;
      }),
    );

    this.logger.log({ event: "service_plan.billed", servicePlanId: plan.id, invoiceNumber, total });
    return 1;
  }
}
