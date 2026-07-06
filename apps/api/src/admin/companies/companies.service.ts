import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { ListCompaniesQueryDto } from "./dto/list-companies.query.dto";

const COMPANY_SELECT = {
  id: true,
  name: true,
  slug: true,
  email: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  healthScore: true,
  isSuspended: true,
  isArchived: true,
  suspendedAt: true,
  archivedAt: true,
  deletedAt: true,
  createdAt: true,
  _count: { select: { users: true, jobs: true, invoices: true } },
} as const;

interface ActorMeta {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCompaniesQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.plan) where.subscriptionPlan = query.plan;
    if (query.status) where.subscriptionStatus = query.status;
    if (query.lifecycle === "active") Object.assign(where, { isSuspended: false, isArchived: false, deletedAt: null });
    if (query.lifecycle === "suspended") where.isSuspended = true;
    if (query.lifecycle === "archived") where.isArchived = true;
    if (query.lifecycle === "deleted") where.deletedAt = { not: null };

    const [companies, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        select: COMPANY_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { companies, total, page, pageSize };
  }

  async detail(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        ...COMPANY_SELECT,
        phone: true,
        website: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        internalNotes: true,
        internalTags: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        storageUsedBytes: true,
        aiCreditsUsed: true,
        users: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true, isSuspended: true, lastLoginAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!org) {
      throw new NotFoundException("Company not found");
    }
    // storageUsedBytes is a Prisma BigInt — JSON.stringify (and Fastify's
    // response serializer) can't handle that type natively.
    return { ...org, storageUsedBytes: Number(org.storageUsedBytes) };
  }

  private async assertExists(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
    if (!org) {
      throw new NotFoundException("Company not found");
    }
    return org;
  }

  private assertTypedConfirmation(org: { slug: string }, confirmSlug: string) {
    if (confirmSlug !== org.slug) {
      throw new BadRequestException("Confirmation text does not match this company's slug");
    }
  }

  async suspend(id: string, meta: ActorMeta) {
    const org = await this.assertExists(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { isSuspended: true, suspendedAt: new Date() },
      select: COMPANY_SELECT,
    });
    await this.audit.log({
      organizationId: id,
      userId: meta.actorUserId,
      action: "COMPANY_SUSPENDED",
      resource: "Organization",
      resourceId: id,
      oldValue: { isSuspended: false },
      newValue: { isSuspended: true },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  async reactivate(id: string, meta: ActorMeta) {
    await this.assertExists(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { isSuspended: false, suspendedAt: null },
      select: COMPANY_SELECT,
    });
    await this.audit.log({
      organizationId: id,
      userId: meta.actorUserId,
      action: "COMPANY_REACTIVATED",
      resource: "Organization",
      resourceId: id,
      oldValue: { isSuspended: true },
      newValue: { isSuspended: false },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  async archive(id: string, confirmSlug: string, meta: ActorMeta) {
    const org = await this.assertExists(id);
    this.assertTypedConfirmation(org, confirmSlug);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { isArchived: true, archivedAt: new Date() },
      select: COMPANY_SELECT,
    });
    await this.audit.log({
      organizationId: id,
      userId: meta.actorUserId,
      action: "COMPANY_ARCHIVED",
      resource: "Organization",
      resourceId: id,
      newValue: { isArchived: true },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  // Soft delete only — `deletedAt` is a marker the rest of the app already
  // filters on (see ExecutiveDashboardService), not a cascading hard
  // delete. Also revokes every session so no user of the org stays logged in.
  async remove(id: string, confirmSlug: string, meta: ActorMeta) {
    const org = await this.assertExists(id);
    this.assertTypedConfirmation(org, confirmSlug);

    await this.prisma.$transaction([
      this.prisma.organization.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { organizationId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      organizationId: id,
      userId: meta.actorUserId,
      action: "COMPANY_DELETED",
      resource: "Organization",
      resourceId: id,
      newValue: { deletedAt: new Date().toISOString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return { success: true };
  }

  async resetTrial(id: string, days: number, meta: ActorMeta) {
    await this.assertExists(id);
    const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { subscriptionStatus: "TRIALING", trialEndsAt },
      select: COMPANY_SELECT,
    });
    await this.audit.log({
      organizationId: id,
      userId: meta.actorUserId,
      action: "COMPANY_TRIAL_RESET",
      resource: "Organization",
      resourceId: id,
      newValue: { trialEndsAt: trialEndsAt.toISOString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  // Demotes every existing OWNER in the org to MANAGER, then promotes the
  // target user to OWNER — a super-admin-only escape hatch for when an org
  // is locked out of its own owner account. Regular OWNER-only role
  // changes (TeamService) can't do this since they require an acting OWNER.
  async transferOwnership(id: string, newOwnerUserId: string, meta: ActorMeta) {
    await this.assertExists(id);
    const target = await this.prisma.user.findFirst({ where: { id: newOwnerUserId, organizationId: id } });
    if (!target) {
      throw new ForbiddenException("Target user does not belong to this company");
    }

    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { organizationId: id, role: "OWNER", id: { not: newOwnerUserId } },
        data: { role: "MANAGER" },
      }),
      this.prisma.user.update({ where: { id: newOwnerUserId }, data: { role: "OWNER" } }),
    ]);

    await this.audit.log({
      organizationId: id,
      userId: meta.actorUserId,
      action: "COMPANY_OWNERSHIP_TRANSFERRED",
      resource: "User",
      resourceId: newOwnerUserId,
      newValue: { role: "OWNER" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return { success: true };
  }

  async exportCsv(query: ListCompaniesQueryDto) {
    const { companies } = await this.list({ ...query, page: "1", pageSize: "10000" });
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Name", "Slug", "Email", "Plan", "Status", "Users", "Jobs", "Invoices", "Suspended", "Archived", "CreatedAt"];
    const rows = [header.join(",")];
    for (const c of companies) {
      rows.push(
        [
          escape(c.name),
          c.slug,
          escape(c.email ?? ""),
          c.subscriptionPlan,
          c.subscriptionStatus,
          String(c._count.users),
          String(c._count.jobs),
          String(c._count.invoices),
          String(c.isSuspended),
          String(c.isArchived),
          c.createdAt.toISOString().slice(0, 10),
        ].join(","),
      );
    }
    return rows.join("\n");
  }
}
