import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { BYPASS_IMPERSONATION_READ_ONLY } from "../decorators/bypass-impersonation-read-only.decorator";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  // S11 — impersonation read-only enforcement lives HERE, not in a global
  // APP_GUARD. Global guards run before route-level guards, so a global
  // guard would check request.user before Passport ever populates it and
  // silently allow every write through. This guard is what populates
  // request.user (via super.canActivate()), so checking immediately after
  // is the only place that's guaranteed to see the real value.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const bypass = this.reflector.getAllAndOverride<boolean>(BYPASS_IMPERSONATION_READ_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!bypass && user?.impersonation?.readOnly && !SAFE_METHODS.has(request.method)) {
      throw new ForbiddenException("Impersonation session is read-only");
    }

    return true;
  }
}
