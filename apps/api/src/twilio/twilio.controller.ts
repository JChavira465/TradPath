import { BadRequestException, Controller, HttpCode, Logger, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "./twilio.service";

interface InboundSmsBody {
  From?: string;
  To?: string;
  Body?: string;
  MessageSid?: string;
}

// Public, unauthenticated surface — matches the Stripe webhook pattern:
// deliberately self-contained (talks to PrismaService directly rather than
// MessagesService) to avoid cross-module import ordering risk.
@Throttle({ default: { limit: 60, ttl: 60 } })
@Controller("twilio")
export class TwilioController {
  private readonly logger = new Logger(TwilioController.name);

  constructor(
    private readonly twilio: TwilioService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post("inbound")
  @HttpCode(200)
  async inbound(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const signature = req.headers["x-twilio-signature"] as string | undefined;
    const body = (req.body ?? {}) as InboundSmsBody;

    const publicApiUrl = this.config.get<string>("API_URL");
    const url = `${publicApiUrl ?? ""}/api/twilio/inbound`;

    if (!this.twilio.validateSignature(signature, url, body as Record<string, unknown>)) {
      throw new BadRequestException("Invalid Twilio signature");
    }

    // Content type only set on the actual TwiML response below — the
    // signature-rejection path above must fall through to Nest's normal
    // JSON error body, not this XML header (Fastify warns on a mismatch).
    res.header("Content-Type", "text/xml");

    const { From: from, To: to, Body: text, MessageSid: sid } = body;
    if (!from || !to || !text) {
      return "<Response></Response>";
    }

    const organization = await this.prisma.organization.findFirst({ where: { twilioPhoneNumber: to } });
    if (!organization) {
      this.logger.warn({ event: "sms.inbound_unknown_number", to });
      return "<Response></Response>";
    }

    const customer = await this.prisma.customer.findFirst({
      where: { organizationId: organization.id, phone: from },
    });

    await this.prisma.jobTextMessage.create({
      data: {
        organizationId: organization.id,
        customerId: customer?.id,
        direction: "INBOUND",
        body: text,
        twilioSid: sid,
      },
    });

    this.logger.log({ event: "sms.inbound_received", organizationId: organization.id, customerId: customer?.id });
    return "<Response></Response>";
  }
}
