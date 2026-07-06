import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { CreateFlagDto } from "./dto/create-flag.dto";
import { UpdateFlagDto } from "./dto/update-flag.dto";
import { SetOrgOverrideDto } from "./dto/set-org-override.dto";

interface ActorMeta {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  }

  private async assertExists(key: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      throw new NotFoundException("Feature flag not found");
    }
    return flag;
  }

  async create(dto: CreateFlagDto, meta: ActorMeta) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key: dto.key } });
    if (existing) {
      throw new BadRequestException("A feature flag with this key already exists");
    }

    const flag = await this.prisma.featureFlag.create({
      data: {
        key: dto.key,
        label: dto.label,
        description: dto.description,
        defaultEnabled: dto.defaultEnabled ?? false,
        enabledForPlans: (dto.enabledForPlans ?? []) as any,
      },
    });

    await this.audit.log({
      userId: meta.actorUserId,
      action: "FEATURE_FLAG_CREATED",
      resource: "FeatureFlag",
      resourceId: flag.key,
      newValue: dto,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return flag;
  }

  async update(key: string, dto: UpdateFlagDto, meta: ActorMeta) {
    const existing = await this.assertExists(key);
    const updated = await this.prisma.featureFlag.update({
      where: { key },
      data: {
        label: dto.label,
        description: dto.description,
        defaultEnabled: dto.defaultEnabled,
        enabledForPlans: dto.enabledForPlans as any,
      },
    });

    await this.audit.log({
      userId: meta.actorUserId,
      action: "FEATURE_FLAG_UPDATED",
      resource: "FeatureFlag",
      resourceId: key,
      oldValue: existing,
      newValue: dto,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  async remove(key: string, meta: ActorMeta) {
    await this.assertExists(key);
    await this.prisma.featureFlag.delete({ where: { key } });
    await this.audit.log({
      userId: meta.actorUserId,
      action: "FEATURE_FLAG_DELETED",
      resource: "FeatureFlag",
      resourceId: key,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return { success: true };
  }

  async listOverrides(key: string) {
    await this.assertExists(key);
    return this.prisma.organizationFeatureFlag.findMany({
      where: { flagKey: key },
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { overriddenAt: "desc" },
    });
  }

  async setOverride(key: string, dto: SetOrgOverrideDto, meta: ActorMeta) {
    await this.assertExists(key);
    const org = await this.prisma.organization.findUnique({ where: { id: dto.organizationId }, select: { id: true } });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    const override = await this.prisma.organizationFeatureFlag.upsert({
      where: { organizationId_flagKey: { organizationId: dto.organizationId, flagKey: key } },
      create: { organizationId: dto.organizationId, flagKey: key, enabled: dto.enabled, overriddenBy: meta.actorUserId },
      update: { enabled: dto.enabled, overriddenBy: meta.actorUserId, overriddenAt: new Date() },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      userId: meta.actorUserId,
      action: "FEATURE_FLAG_OVERRIDE_SET",
      resource: "OrganizationFeatureFlag",
      resourceId: override.id,
      newValue: { flagKey: key, enabled: dto.enabled },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return override;
  }

  async removeOverride(key: string, organizationId: string, meta: ActorMeta) {
    await this.assertExists(key);
    await this.prisma.organizationFeatureFlag
      .delete({ where: { organizationId_flagKey: { organizationId, flagKey: key } } })
      .catch(() => {
        throw new NotFoundException("Override not found");
      });

    await this.audit.log({
      organizationId,
      userId: meta.actorUserId,
      action: "FEATURE_FLAG_OVERRIDE_REMOVED",
      resource: "OrganizationFeatureFlag",
      resourceId: `${organizationId}:${key}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return { success: true };
  }
}
