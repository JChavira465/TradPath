import { BadRequestException, Controller, HttpCode, Inject, Post, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";
import Stripe from "stripe";
import { STRIPE_CLIENT } from "./stripe.constants";
import { StripeWebhookService } from "./stripe-webhook.service";

// @nestjs/platform-fastify sets request.rawBody at runtime when the app is
// created with `rawBody: true`, but ships no type augmentation for it.
interface RawBodyRequest extends FastifyRequest {
  rawBody?: Buffer;
}

@Controller("stripe")
export class StripeController {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly config: ConfigService,
    private readonly webhooks: StripeWebhookService,
  ) {}

  // S6 — verifies stripe-signature against the RAW body. rawBody is
  // populated by NestFactory's `rawBody: true` option (main.ts) for every
  // request; this is the one route that actually needs it. Never trust a
  // webhook payload without this check passing first.
  @Post("webhook")
  @HttpCode(200)
  async handleWebhook(@Req() req: RawBodyRequest) {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");

    if (!signature || typeof signature !== "string" || !webhookSecret || !req.rawBody) {
      throw new BadRequestException("Missing signature or raw body");
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    return this.webhooks.handleEvent(event);
  }
}
