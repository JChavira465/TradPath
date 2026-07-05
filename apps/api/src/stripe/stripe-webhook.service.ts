import { Inject, Injectable, Logger } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { STRIPE_CLIENT } from "./stripe.constants";

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // S6 — idempotent: Stripe redelivers events, so every event ID is
  // recorded and duplicates are skipped rather than double-processed
  // (e.g. double-crediting a payment).
  async handleEvent(event: Stripe.Event): Promise<{ skipped: boolean }> {
    const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing) {
      this.logger.log({ event: "stripe.webhook.duplicate_skipped", eventId: event.id, type: event.type });
      return { skipped: true };
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        await this.onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "invoice.payment_succeeded":
        await this.onStripeInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        this.logger.warn({ event: "stripe.invoice.payment_failed", stripeInvoiceId: (event.data.object as Stripe.Invoice).id });
        break;
      case "customer.subscription.updated":
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        this.logger.debug({ event: "stripe.webhook.unhandled_type", type: event.type });
    }

    await this.prisma.webhookEvent.create({ data: { eventId: event.id, type: event.type } });
    return { skipped: false };
  }

  private async onPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });
    if (!invoice) {
      this.logger.warn({ event: "stripe.payment_intent.no_matching_invoice", paymentIntentId: paymentIntent.id });
      return;
    }
    if (invoice.status === "PAID") {
      return;
    }

    const amountPaidThisTransaction = paymentIntent.amount_received / 100;
    const newAmountPaid = Number(invoice.amountPaid) + amountPaidThisTransaction;
    const newAmountDue = Math.max(0, Number(invoice.total) - newAmountPaid);
    const newStatus = newAmountDue <= 0 ? "PAID" : "PARTIAL";

    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          amount: amountPaidThisTransaction,
          method: "STRIPE",
          stripePaymentId: paymentIntent.id,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newStatus,
          paidAt: newStatus === "PAID" ? new Date() : undefined,
        },
      }),
    ]);

    if (newStatus === "PAID") {
      const customer = await this.prisma.customer.findUnique({ where: { id: invoice.customerId } });
      if (customer?.email) {
        await this.email.send({
          to: customer.email,
          subject: `Receipt for invoice #${invoice.invoiceNumber}`,
          html: `<p>Hi ${customer.firstName},</p><p>Thank you! We've received your payment of $${Number(invoice.total).toFixed(2)} for invoice #${invoice.invoiceNumber}.</p>`,
        });
      }
    }
  }

  private async onStripeInvoicePaymentSucceeded(stripeInvoice: Stripe.Invoice) {
    // Subscription-billing invoices (Sprint 4B ServicePlanInvoice) are
    // matched by stripeInvoiceId once that flow exists; nothing to do yet
    // for one-time invoices, which use payment_intent.succeeded instead.
    this.logger.debug({ event: "stripe.invoice.payment_succeeded", stripeInvoiceId: stripeInvoice.id });
  }

  // S6 — Sprint 4B webhook-driven ServicePlan <-> Stripe subscription
  // status sync. Stripe is the source of truth for the subscription's own
  // lifecycle; we just mirror it onto the matching ServicePlan.
  private async onSubscriptionUpdated(subscription: Stripe.Subscription) {
    const plan = await this.prisma.servicePlan.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!plan) return;

    const status = ["active", "trialing", "past_due", "unpaid"].includes(subscription.status)
      ? "ACTIVE"
      : subscription.status === "paused"
        ? "PAUSED"
        : "CANCELLED";

    if (status !== plan.status) {
      await this.prisma.servicePlan.update({
        where: { id: plan.id },
        data: { status, cancelledAt: status === "CANCELLED" ? new Date() : undefined },
      });
      this.logger.log({ event: "service_plan.stripe_status_synced", servicePlanId: plan.id, status });
    }
  }

  private async onSubscriptionDeleted(subscription: Stripe.Subscription) {
    const plan = await this.prisma.servicePlan.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!plan || plan.status === "CANCELLED") return;

    await this.prisma.servicePlan.update({
      where: { id: plan.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Stripe subscription deleted" },
    });
    this.logger.log({ event: "service_plan.stripe_subscription_deleted", servicePlanId: plan.id });
  }
}
