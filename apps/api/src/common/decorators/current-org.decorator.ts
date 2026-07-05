import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";

/**
 * S1 — the ONLY way a controller may obtain organizationId.
 * Always sourced from the authenticated JWT (req.user.orgId),
 * NEVER from req.body / req.query / req.params. Do not add an
 * alternate path to organizationId anywhere else in the codebase.
 */
export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const orgId = request.user?.orgId;
    if (!orgId) {
      throw new UnauthorizedException("Missing organization context");
    }
    return orgId;
  },
);
