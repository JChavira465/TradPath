import { Logger } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { INVOICE_FOLLOW_UP_QUEUE } from "./queues.constants";

const FOLLOW_UP_STATUSES = ["SENT", "VIEWED", "PARTIAL", "OVERDUE"];
const DAY_MS = 24 * 60 * 60 * 1000;

@Processor(INVOICE_FOLLOW_UP_QUEUE)
export class InvoiceFollowUpProcessor {
  private readonly logger = new Logger(InvoiceFollowUpProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process("scan")
  async scan(_job: Job) {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: FOLLOW_UP_STATUSES as any }, sentAt: { not: null } },
      include: { customer: true },
    });

    const now = Date.now();

    for (const invoice of invoices) {
      const daysSinceSent = Math.floor((now - invoice.sentAt!.getTime()) / DAY_MS);
      const isPastDue = invoice.dueDate ? invoice.dueDate.getTime() < now : false;

      const updates: Record<string, unknown> = {};

      if (isPastDue && invoice.status !== "OVERDUE") {
        updates.status = "OVERDUE";
      }

      if (daysSinceSent >= 3 && !invoice.followUp1SentAt) {
        this.sendReminder(invoice, 1);
        updates.followUp1SentAt = new Date();
      } else if (daysSinceSent >= 7 && !invoice.followUp2SentAt) {
        this.sendReminder(invoice, 2);
        updates.followUp2SentAt = new Date();
      } else if (daysSinceSent >= 14 && !invoice.followUp3SentAt) {
        this.sendReminder(invoice, 3);
        updates.followUp3SentAt = new Date();
      }

      if (Object.keys(updates).length > 0) {
        await this.prisma.invoice.update({ where: { id: invoice.id }, data: updates });
      }
    }

    return { scanned: invoices.length };
  }

  // SendGrid/Twilio aren't provisioned yet — this logs the intent so the
  // idempotency bookkeeping (followUpXSentAt) is exercised and verifiable
  // even before real credentials exist. Wires straight in once they do.
  private sendReminder(invoice: { id: string; invoiceNumber: string; customer: { email: string | null; phone: string | null } }, step: 1 | 2 | 3) {
    this.logger.log({
      event: "invoice.follow_up.sent",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      step,
      channel: invoice.customer.email ? "email" : invoice.customer.phone ? "sms" : "none",
    });
  }
}
