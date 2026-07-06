import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@tradpath/database";
import { nanoid } from "nanoid";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { AuditService } from "../common/audit/audit.service";
import { sha256 } from "../common/utils/crypto.util";
import { RefreshMeta } from "../auth/token.service";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { InviteTeamMemberDto } from "./dto/invite-team-member.dto";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async list(orgId: string) {
    const [members, pendingInvites] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isSuspended: true,
          lastLoginAt: true,
          mfaEnabled: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.teamInvite.findMany({
        where: { organizationId: orgId, usedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { members, pendingInvites };
  }

  async invite(orgId: string, invitedByUserId: string, dto: InviteTeamMemberDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException("A user with that email already exists");
    }

    const rawToken = nanoid(48);
    const tokenHash = sha256(rawToken);

    await this.prisma.teamInvite.create({
      data: {
        organizationId: orgId,
        email: dto.email,
        role: dto.role ?? "EMPLOYEE",
        invitedBy: invitedByUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    const acceptUrl = `${this.config.get<string>("FRONTEND_URL")}/auth/accept-invite?token=${rawToken}`;
    await this.email.send({
      to: dto.email,
      subject: `You're invited to join ${org?.name ?? "TradPath"}`,
      html: `<p>You've been invited to join ${org?.name ?? "a TradPath team"} on TradPath. This invite link expires in 7 days.</p><p><a href="${acceptUrl}">Accept invite</a></p>`,
    });

    this.logger.log({ event: "team.invite_sent", organizationId: orgId, email: dto.email });
    return { success: true };
  }

  async updateRole(orgId: string, actingUser: AuthenticatedUser, targetUserId: string, role: UserRole, meta: RefreshMeta) {
    if (actingUser.role !== "OWNER") {
      throw new ForbiddenException("Only an owner can change roles");
    }

    const target = await this.prisma.user.findFirst({ where: { id: targetUserId, organizationId: orgId } });
    if (!target) {
      throw new NotFoundException("Team member not found");
    }

    if (target.role === "OWNER" && role !== "OWNER") {
      const ownerCount = await this.prisma.user.count({ where: { organizationId: orgId, role: "OWNER" } });
      if (ownerCount <= 1) {
        throw new BadRequestException("Cannot remove the last owner's role");
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isSuspended: true },
    });

    await this.audit.log({
      organizationId: orgId,
      userId: actingUser.userId,
      action: "TEAM_ROLE_CHANGED",
      resource: "User",
      resourceId: targetUserId,
      oldValue: { role: target.role },
      newValue: { role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      platform: "WEB",
    });

    return updated;
  }

  async remove(orgId: string, actingUser: AuthenticatedUser, targetUserId: string, meta: RefreshMeta) {
    if (actingUser.role !== "OWNER" && actingUser.role !== "MANAGER") {
      throw new ForbiddenException("Manager access required");
    }
    const target = await this.prisma.user.findFirst({ where: { id: targetUserId, organizationId: orgId } });
    if (!target) {
      throw new NotFoundException("Team member not found");
    }
    if (target.role === "OWNER") {
      throw new BadRequestException("Cannot remove an owner");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: targetUserId }, data: { isSuspended: true } }),
      this.prisma.refreshToken.updateMany({ where: { userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await this.audit.log({
      organizationId: orgId,
      userId: actingUser.userId,
      action: "TEAM_MEMBER_REMOVED",
      resource: "User",
      resourceId: targetUserId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      platform: "WEB",
    });

    return { success: true };
  }
}
