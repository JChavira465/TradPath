import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import sgMail from "@sendgrid/mail";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private configured = false;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("SENDGRID_API_KEY");
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.configured = true;
    }
  }

  // Best-effort, same graceful-degradation pattern as Stripe/Twilio calls
  // elsewhere: never throws, never blocks the caller's real work on an
  // email provider being down or (as today) not configured yet.
  async send(input: SendEmailInput): Promise<boolean> {
    if (!this.configured) {
      this.logger.warn({ event: "email.not_configured", to: input.to, subject: input.subject });
      return false;
    }

    try {
      await sgMail.send({
        to: input.to,
        from: {
          email: this.config.get<string>("SENDGRID_FROM_EMAIL") ?? "hello@tradpath.com",
          name: this.config.get<string>("SENDGRID_FROM_NAME") ?? "TradPath",
        },
        subject: input.subject,
        html: input.html,
        text: input.text ?? input.html.replace(/<[^>]+>/g, " "),
      });
      this.logger.log({ event: "email.sent", to: input.to, subject: input.subject });
      return true;
    } catch (err: any) {
      this.logger.warn({ event: "email.send_failed", to: input.to, message: err.message });
      return false;
    }
  }
}
