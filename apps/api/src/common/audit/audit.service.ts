import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuditLogInput {
  organizationId?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  isSuperAdminAction?: boolean;
  platform?: "WEB" | "MOBILE" | "ADMIN";
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        oldValue: input.oldValue as any,
        newValue: input.newValue as any,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        isSuperAdminAction: input.isSuperAdminAction ?? false,
        platform: input.platform ?? "WEB",
      },
    });
  }
}
