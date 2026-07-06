import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { STRIPE_CLIENT } from "../stripe/stripe.constants";
import { EmailService } from "../email/email.service";
import { computeAndVerifyTotals } from "../common/utils/line-items.util";
import { nextSequentialNumber, withRetryOnCollision } from "../common/utils/sequential-number.util";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";

const LOCKED_STATUSES = new Set(["PAID", "VOID"]);

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private payUrl(invoiceId: string): string {
    return `${this.config.get<string>("FRONTEND_URL")}/pay/${invoiceId}`;
  }

  async list(orgId: string, customerId?: string, status?: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId: orgId, ...(customerId && { customerId }), ...(status && { status: status as any }) },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });
  }

  private async assertExists(orgId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, organizationId: orgId } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  async findOne(orgId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: { customer: true, payments: true },
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  // Public/unauthenticated lookup for the /pay/[invoiceId] page — deliberately
  // returns only what's needed to render a payment page, never internal
  // notes or the full payment/audit history.
  async findPublic(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { select: { firstName: true, lastName: true, company: true } },
        organization: { select: { name: true, logo: true, bookingPageColor: true } },
      },
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  private async nextInvoiceNumber(orgId: string): Promise<string> {
    return nextSequentialNumber(() =>
      this.prisma.invoice
        .findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, select: { invoiceNumber: true } })
        .then((i) => (i ? { number: i.invoiceNumber } : null)),
    );
  }

  // Only BEFORE/AFTER photos the org has marked customer-visible ever get
  // embedded on a customer-facing invoice — internal-only shots never leak
  // through this toggle.
  private async resolvePhotoUrls(jobId?: string, includePhotos?: boolean): Promise<string[]> {
    if (!includePhotos || !jobId) return [];
    const photos = await this.prisma.jobPhoto.findMany({
      where: { jobId, isCustomerVisible: true, type: { in: ["BEFORE", "AFTER"] } },
      orderBy: { createdAt: "asc" },
      select: { url: true },
    });
    return photos.map((p) => p.url);
  }

  // Job.totalRevenue/profit are kept in sync with that job's non-void
  // invoices here (the only place invoice totals change) — laborCost and
  // materialCost are left alone since those come from manual entry on the
  // job itself (no cost-basis data exists elsewhere to derive them from).
  private async syncJobFinancials(jobId: string) {
    const [job, invoices] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId }, select: { laborCost: true, materialCost: true } }),
      this.prisma.invoice.findMany({ where: { jobId, status: { not: "VOID" } }, select: { total: true } }),
    ]);
    if (!job) return;

    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const profit = totalRevenue - Number(job.laborCost) - Number(job.materialCost);

    await this.prisma.job.update({ where: { id: jobId }, data: { totalRevenue, profit } });
  }

  async create(orgId: string, userId: string, dto: CreateInvoiceDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, organizationId: orgId } });
    if (!customer) {
      throw new BadRequestException("Customer not found in this organization");
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    const taxRate = dto.taxRate ?? Number(org?.defaultTaxRate ?? 0);
    const discountAmount = dto.discountAmount ?? 0;
    const totals = computeAndVerifyTotals(dto.lineItems, taxRate, discountAmount, dto.subtotal, dto.total);

    const dueDate =
      dto.dueDate != null
        ? new Date(dto.dueDate)
        : new Date(Date.now() + (org?.defaultInvoiceDueDays ?? 30) * 24 * 60 * 60 * 1000);

    const photoUrls = await this.resolvePhotoUrls(dto.jobId, dto.includePhotos);

    try {
      const invoice = await withRetryOnCollision(async () => {
        const invoiceNumber = await this.nextInvoiceNumber(orgId);
        return this.prisma.invoice.create({
          data: {
            organizationId: orgId,
            customerId: dto.customerId,
            jobId: dto.jobId,
            estimateId: dto.estimateId,
            invoiceNumber,
            dueDate,
            lineItems: dto.lineItems as any,
            subtotal: totals.subtotal,
            taxRate,
            taxAmount: totals.taxAmount,
            discountAmount,
            total: totals.total,
            amountPaid: 0,
            amountDue: totals.total,
            notes: dto.notes,
            termsAndConditions: dto.termsAndConditions,
            includePhotos: dto.includePhotos ?? false,
            photoUrls: photoUrls as any,
            createdBy: userId,
          },
        });
      });
      if (dto.jobId) {
        await this.syncJobFinancials(dto.jobId);
      }
      return invoice;
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new BadRequestException("Could not allocate an invoice number, please retry");
      }
      throw err;
    }
  }

  async update(orgId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.assertExists(orgId, id);
    if (LOCKED_STATUSES.has(invoice.status)) {
      throw new BadRequestException(`Cannot edit an invoice in ${invoice.status} status`);
    }

    const lineItems = (dto.lineItems ?? (invoice.lineItems as any)) as any[];
    const taxRate = dto.taxRate ?? Number(invoice.taxRate);
    const discountAmount = dto.discountAmount ?? Number(invoice.discountAmount);
    const totals = computeAndVerifyTotals(lineItems, taxRate, discountAmount, dto.subtotal, dto.total);
    const amountDue = Math.max(0, totals.total - Number(invoice.amountPaid));

    const includePhotos = dto.includePhotos ?? invoice.includePhotos;
    const photoUrls =
      dto.includePhotos !== undefined
        ? await this.resolvePhotoUrls(invoice.jobId ?? undefined, includePhotos)
        : undefined;

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        lineItems: dto.lineItems ? (dto.lineItems as any) : undefined,
        subtotal: totals.subtotal,
        taxRate,
        taxAmount: totals.taxAmount,
        discountAmount,
        total: totals.total,
        amountDue,
        notes: dto.notes,
        termsAndConditions: dto.termsAndConditions,
        includePhotos: dto.includePhotos,
        photoUrls: photoUrls as any,
      },
    });
    if (invoice.jobId) {
      await this.syncJobFinancials(invoice.jobId);
    }
    return updated;
  }

  async remove(orgId: string, id: string) {
    const invoice = await this.assertExists(orgId, id);
    if (Number(invoice.amountPaid) > 0) {
      throw new BadRequestException("Cannot delete an invoice that has payments recorded");
    }
    await this.prisma.invoice.delete({ where: { id } });
    if (invoice.jobId) {
      await this.syncJobFinancials(invoice.jobId);
    }
    return { success: true };
  }

  async send(orgId: string, id: string) {
    const invoice = await this.assertExists(orgId, id);
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      throw new BadRequestException(`Cannot send an invoice in ${invoice.status} status`);
    }

    const [customer, org] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: invoice.customerId } }),
      this.prisma.organization.findUnique({ where: { id: orgId } }),
    ]);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: invoice.status === "DRAFT" ? "SENT" : invoice.status, sentAt: new Date() },
    });

    if (customer?.email) {
      await this.email.send({
        to: customer.email,
        subject: `Invoice #${invoice.invoiceNumber} from ${org?.name ?? "your service provider"}`,
        html: `<p>Hi ${customer.firstName},</p><p>You have a new invoice for $${invoice.total}.</p><p><a href="${this.payUrl(id)}">View and pay your invoice</a></p>`,
      });
    }

    return updated;
  }

  // Creates (or reuses) a Stripe PaymentIntent for the public pay page.
  // The invoice is only ever marked paid by the webhook handler reacting
  // to payment_intent.succeeded — never by this call itself.
  async createPaymentIntent(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      throw new BadRequestException(`This invoice is ${invoice.status.toLowerCase()} and cannot be paid`);
    }

    if (invoice.stripePaymentIntentId) {
      const existing = await this.stripe.paymentIntents.retrieve(invoice.stripePaymentIntentId);
      if (existing.status !== "succeeded" && existing.status !== "canceled") {
        return { clientSecret: existing.client_secret };
      }
    }

    const org = await this.prisma.organization.findUnique({ where: { id: invoice.organizationId } });
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(Number(invoice.amountDue) * 100),
      currency: (org?.currency ?? "USD").toLowerCase(),
      metadata: { invoiceId: invoice.id, organizationId: invoice.organizationId },
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return { clientSecret: paymentIntent.client_secret };
  }

  // S6 — authenticated manual recording (cash/check/bank transfer/other).
  // STRIPE-method payments may ONLY be created by the verified webhook
  // handler — never through this endpoint — so a client can't forge a
  // "paid via Stripe" record without an actual Stripe charge.
  async recordPayment(orgId: string, id: string, userId: string, dto: RecordPaymentDto) {
    if (dto.method === "STRIPE") {
      throw new BadRequestException("Stripe payments are recorded automatically via webhook, not manually");
    }

    const invoice = await this.assertExists(orgId, id);
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      throw new BadRequestException(`Cannot record a payment on an invoice in ${invoice.status} status`);
    }

    const newAmountPaid = Number(invoice.amountPaid) + dto.amount;
    const newAmountDue = Math.max(0, Number(invoice.total) - newAmountPaid);
    const newStatus = newAmountDue <= 0 ? "PAID" : "PARTIAL";

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          invoiceId: id,
          organizationId: orgId,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          createdBy: userId,
        },
      }),
      this.prisma.invoice.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newStatus,
          paidAt: newStatus === "PAID" ? new Date() : undefined,
        },
      }),
    ]);

    if (newStatus === "PAID") {
      await this.sendReceipt(invoice.id, invoice.invoiceNumber, invoice.customerId, Number(invoice.total));
    }

    return payment;
  }

  // Receipt auto-email on full payment — called from both the manual
  // recording path above and the Stripe webhook handler.
  async sendReceipt(invoiceId: string, invoiceNumber: string, customerId: string, total: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer?.email) return;

    await this.email.send({
      to: customer.email,
      subject: `Receipt for invoice #${invoiceNumber}`,
      html: `<p>Hi ${customer.firstName},</p><p>Thank you! We've received your payment of $${total.toFixed(2)} for invoice #${invoiceNumber}.</p>`,
    });
  }

  async arSummary(orgId: string) {
    const outstanding = await this.prisma.invoice.findMany({
      where: { organizationId: orgId, status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] } },
      select: { amountDue: true, dueDate: true },
    });

    const now = Date.now();
    const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 };
    let totalOutstanding = 0;

    for (const inv of outstanding) {
      const amount = Number(inv.amountDue);
      totalOutstanding += amount;
      const daysOverdue = inv.dueDate ? Math.floor((now - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000)) : -1;

      if (daysOverdue <= 0) buckets.current += amount;
      else if (daysOverdue <= 30) buckets.days1to30 += amount;
      else if (daysOverdue <= 60) buckets.days31to60 += amount;
      else if (daysOverdue <= 90) buckets.days61to90 += amount;
      else buckets.days90plus += amount;
    }

    return { totalOutstanding, invoiceCount: outstanding.length, buckets };
  }

  // Generic accounting-import CSV (one row per line item) — the column
  // set is intentionally plain/standard rather than QuickBooks- or
  // Xero-specific, since both products' bulk-import tools let the user
  // map arbitrary CSV columns to their own fields on import.
  async exportAccountingCsv(orgId: string, from?: string, to?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        status: { not: "VOID" },
        ...((from || to) && {
          createdAt: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        }),
      },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = [
      "InvoiceNumber",
      "InvoiceDate",
      "DueDate",
      "CustomerName",
      "CustomerEmail",
      "Description",
      "Quantity",
      "UnitPrice",
      "Amount",
      "TaxAmount",
      "Total",
      "Status",
    ];
    const rows: string[] = [header.join(",")];

    for (const invoice of invoices) {
      const lineItems = invoice.lineItems as any as { description: string; quantity: number; unitPrice: number }[];
      const customerName = invoice.customer.company || `${invoice.customer.firstName} ${invoice.customer.lastName}`;
      for (const li of lineItems) {
        rows.push(
          [
            invoice.invoiceNumber,
            invoice.createdAt.toISOString().slice(0, 10),
            invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "",
            escape(customerName),
            escape(invoice.customer.email ?? ""),
            escape(li.description),
            String(li.quantity),
            li.unitPrice.toFixed(2),
            (li.quantity * li.unitPrice).toFixed(2),
            Number(invoice.taxAmount).toFixed(2),
            Number(invoice.total).toFixed(2),
            invoice.status,
          ].join(","),
        );
      }
    }

    return rows.join("\n");
  }
}
