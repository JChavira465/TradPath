import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { FastifyRequest } from "fastify";
import { InvoicesService } from "./invoices.service";
import { TurnstileService } from "../common/turnstile/turnstile.service";
import { SlugRateLimitService } from "../common/utils/slug-rate-limit.service";
import { PublicPaymentIntentDto } from "./dto/public-payment-intent.dto";

const PER_INVOICE_LIMIT = 30;
const PER_INVOICE_WINDOW_SECONDS = 60 * 60;

// S8 — public, unauthenticated surface for the /pay/[invoiceId] page.
// Per-IP: 10/min (Throttle below). Per-invoice: 30/hour, mirroring the
// per-slug limit on /book/* — invoice IDs are cuids rather than guessable
// slugs, but the spec groups /book/* and /pay/* under identical S8
// requirements, so this closes that gap rather than relying only on
// unguessability.
@Throttle({ default: { limit: 10, ttl: 60 } })
@Controller("public/invoices")
export class PublicInvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly turnstile: TurnstileService,
    private readonly rateLimit: SlugRateLimitService,
  ) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.invoices.findPublic(id);
  }

  @Post(":id/payment-intent")
  @HttpCode(200)
  async createPaymentIntent(
    @Param("id") id: string,
    @Body() dto: PublicPaymentIntentDto,
    @Req() req: FastifyRequest,
  ) {
    await this.rateLimit.assertWithinLimit(`pay:${id}`, PER_INVOICE_LIMIT, PER_INVOICE_WINDOW_SECONDS);
    const verified = await this.turnstile.verify(dto.turnstileToken, req.ip);
    if (!verified) {
      throw new ForbiddenException("Verification failed");
    }
    return this.invoices.createPaymentIntent(id);
  }
}
