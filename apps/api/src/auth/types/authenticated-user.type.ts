import { UserRole } from "@tradpath/database";

export interface ImpersonationContext {
  adminUserId: string;
  readOnly: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  orgId: string;
  email: string;
  role: UserRole;
  isSuperAdmin: boolean;
  impersonation?: ImpersonationContext;
}
