import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { nanoid } from "nanoid";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { EmailService } from "../../email/email.service";
import { sha256 } from "../../common/utils/crypto.util";
import { ListUsersQueryDto } from "./dto/list-users.query.dto";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isSuspended: true,
  isSuperAdmin: true,
  mfaEnabled: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
  organization: { select: { id: true, name: true, slug: true } },
} as const;

interface ActorMeta {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));

    const where: any = {};
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.role) where.role = query.role;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total, page, pageSize };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private async assertExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, organizationId: true } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  // Every login issues a fresh RefreshToken row, so its creation history
  // doubles as a login history without needing a dedicated audit action —
  // logins themselves were never separately recorded in AuditLog.
  async loginHistory(id: string) {
    await this.assertExists(id);
    return this.prisma.refreshToken.findMany({
      where: { userId: id },
      select: { id: true, ipAddress: true, userAgent: true, platform: true, createdAt: true, revokedAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async sessions(id: string) {
    await this.assertExists(id);
    return this.prisma.refreshToken.findMany({
      where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, ipAddress: true, userAgent: true, platform: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async forcePasswordReset(id: string, meta: ActorMeta) {
    const user = await this.assertExists(id);

    const rawToken = nanoid(48);
    const tokenHash = sha256(rawToken);
    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
    });

    const resetUrl = `${this.config.get<string>("FRONTEND_URL")}/auth/reset-password?token=${rawToken}`;
    await this.email.send({
      to: user.email,
      subject: "Reset your TradPath password",
      html: `<p>A TradPath administrator has triggered a password reset for your account. This link expires in 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p>`,
    });

    await this.audit.log({
      organizationId: user.organizationId,
      userId: meta.actorUserId,
      action: "USER_FORCE_PASSWORD_RESET",
      resource: "User",
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return { success: true };
  }

  async unlock(id: string, meta: ActorMeta) {
    const user = await this.assertExists(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { lockedUntil: null, failedLoginCount: 0, mfaLockedUntil: null, mfaFailedAttempts: 0 },
      select: USER_SELECT,
    });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: meta.actorUserId,
      action: "USER_UNLOCKED",
      resource: "User",
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  async disable(id: string, meta: ActorMeta) {
    const user = await this.assertExists(id);
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isSuspended: true }, select: USER_SELECT }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({
      organizationId: user.organizationId,
      userId: meta.actorUserId,
      action: "USER_DISABLED",
      resource: "User",
      resourceId: id,
      newValue: { isSuspended: true },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  async enable(id: string, meta: ActorMeta) {
    const user = await this.assertExists(id);
    const updated = await this.prisma.user.update({ where: { id }, data: { isSuspended: false }, select: USER_SELECT });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: meta.actorUserId,
      action: "USER_ENABLED",
      resource: "User",
      resourceId: id,
      newValue: { isSuspended: false },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  async revokeSessions(id: string, meta: ActorMeta) {
    const user = await this.assertExists(id);
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: meta.actorUserId,
      action: "USER_SESSIONS_REVOKED",
      resource: "User",
      resourceId: id,
      newValue: { revokedCount: count },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return { revokedCount: count };
  }
}
