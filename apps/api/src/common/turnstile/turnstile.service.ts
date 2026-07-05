import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  // S8 — Cloudflare Turnstile verification on public POST endpoints
  // (/book/*, /pay/*). Fails OPEN (allows the request) when no secret is
  // configured yet, same pattern as the other not-yet-provisioned
  // integrations in this codebase — real enforcement turns on the moment
  // TURNSTILE_SECRET_KEY is set, with no code change needed.
  async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
    const secretKey = this.config.get<string>("TURNSTILE_SECRET_KEY");
    if (!secretKey) {
      this.logger.warn({ event: "turnstile.not_configured", note: "allowing request through" });
      return true;
    }
    if (!token) {
      return false;
    }

    const params = new URLSearchParams({ secret: secretKey, response: token });
    if (remoteIp) params.set("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = (await res.json()) as { success: boolean };
    return data.success;
  }
}
