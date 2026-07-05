import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

/**
 * S11 — applied at CONTROLLER level (@UseGuards on the class) for
 * every /admin controller, never per-endpoint. Requires a valid JWT
 * (stack this after JwtAuthGuard) plus isSuperAdmin === true.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException("Super admin access required");
    }
    return true;
  }
}
