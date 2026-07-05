import { SetMetadata } from "@nestjs/common";

export const BYPASS_IMPERSONATION_READ_ONLY = "bypassImpersonationReadOnly";

/**
 * Explicit, narrow escape hatch from the impersonation read-only check
 * (JwtAuthGuard). The only legitimate use is ending an impersonation
 * session itself (POST /admin/impersonate/stop) — that call is
 * write-shaped over HTTP but doesn't touch any tenant data, so it must
 * work even though the session is read-only. Do not reach for this
 * elsewhere; it defeats the S11 read-only guarantee.
 */
export const BypassImpersonationReadOnly = () => SetMetadata(BYPASS_IMPERSONATION_READ_ONLY, true);
