import { UnauthorizedException } from "@nestjs/common";

/**
 * Thrown for locked accounts. Message is intentionally identical to a
 * plain bad-password failure (S12) — only the Retry-After header
 * (added by AccountLockedFilter) differs, and only server logs know why.
 */
export class AccountLockedException extends UnauthorizedException {
  constructor(public readonly retryAfterSeconds: number) {
    super("Invalid credentials");
  }
}
