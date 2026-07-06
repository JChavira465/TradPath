import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

/**
 * Requires OWNER or MANAGER role. Stack after JwtAuthGuard (relies on
 * request.user already being populated).
 */
@Injectable()
export class ManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role;
    if (role !== "OWNER" && role !== "MANAGER") {
      throw new ForbiddenException("Manager access required");
    }
    return true;
  }
}
