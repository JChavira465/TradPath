import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Twilio from "twilio";
import { validateRequest } from "twilio";
import { TWILIO_CLIENT } from "./twilio.constants";

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly authToken?: string;

  constructor(
    @Optional() @Inject(TWILIO_CLIENT) private readonly client: Twilio.Twilio | null,
    private readonly config: ConfigService,
  ) {
    this.authToken = this.config.get<string>("TWILIO_AUTH_TOKEN");
  }

  get isConfigured() {
    return !!this.client;
  }

  // S6-style webhook verification for Twilio inbound SMS, mirroring the
  // Stripe signature check: never trust an inbound payload without this
  // passing first. Refuses (returns false) if not configured — there is
  // no safe "soft-fail-open" for an unauthenticated inbound webhook.
  validateSignature(signature: string | undefined, url: string, params: Record<string, unknown>): boolean {
    if (!this.authToken || !signature) return false;
    try {
      return validateRequest(this.authToken, signature, url, params as Record<string, string>);
    } catch {
      return false;
    }
  }

  // Best-effort, same graceful-degradation pattern as Email/Stripe: never
  // throws, returns null if not configured or the send fails.
  async sendSms(from: string, to: string, body: string): Promise<string | null> {
    if (!this.client) {
      this.logger.warn({ event: "sms.not_configured", to });
      return null;
    }
    try {
      const message = await this.client.messages.create({ from, to, body });
      this.logger.log({ event: "sms.sent", to, sid: message.sid });
      return message.sid;
    } catch (err: any) {
      this.logger.warn({ event: "sms.send_failed", to, message: err.message });
      return null;
    }
  }

  // Best-effort per-org number provisioning. Twilio trial/paid accounts
  // both require a funded account to actually purchase a number, so this
  // degrades to null (caller keeps org.twilioPhoneNumber unset) rather than
  // throwing when it's not configured or the account can't purchase one.
  async provisionNumber(areaCode?: string): Promise<string | null> {
    if (!this.client) {
      this.logger.warn({ event: "twilio.provision_not_configured" });
      return null;
    }
    try {
      const available = await this.client
        .availablePhoneNumbers("US")
        .local.list({ areaCode: areaCode ? Number(areaCode) : undefined, smsEnabled: true, limit: 1 });
      const candidate = available[0]?.phoneNumber;
      if (!candidate) {
        this.logger.warn({ event: "twilio.provision_no_numbers_available" });
        return null;
      }
      const purchased = await this.client.incomingPhoneNumbers.create({ phoneNumber: candidate });
      this.logger.log({ event: "twilio.provisioned", phoneNumber: purchased.phoneNumber });
      return purchased.phoneNumber;
    } catch (err: any) {
      this.logger.warn({ event: "twilio.provision_failed", message: err.message });
      return null;
    }
  }
}
