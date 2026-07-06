import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { UpdateAnnouncementDto } from "./dto/update-announcement.dto";

interface ActorMeta {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.platformAnnouncement.findMany({ orderBy: { createdAt: "desc" } });
  }

  async create(dto: CreateAnnouncementDto, meta: ActorMeta) {
    const announcement = await this.prisma.platformAnnouncement.create({
      data: {
        title: dto.title,
        message: dto.message,
        type: dto.type ?? "INFO",
        targetPlans: (dto.targetPlans ?? []) as any,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdBy: meta.actorUserId,
      },
    });

    await this.audit.log({
      userId: meta.actorUserId,
      action: "ANNOUNCEMENT_CREATED",
      resource: "PlatformAnnouncement",
      resourceId: announcement.id,
      newValue: dto,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto, meta: ActorMeta) {
    const existing = await this.prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Announcement not found");
    }

    const updated = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: {
        title: dto.title,
        message: dto.message,
        type: dto.type,
        targetPlans: dto.targetPlans as any,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.audit.log({
      userId: meta.actorUserId,
      action: "ANNOUNCEMENT_UPDATED",
      resource: "PlatformAnnouncement",
      resourceId: id,
      oldValue: existing,
      newValue: dto,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return updated;
  }

  async remove(id: string, meta: ActorMeta) {
    const existing = await this.prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Announcement not found");
    }
    await this.prisma.platformAnnouncement.delete({ where: { id } });

    await this.audit.log({
      userId: meta.actorUserId,
      action: "ANNOUNCEMENT_DELETED",
      resource: "PlatformAnnouncement",
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      isSuperAdminAction: true,
      platform: "ADMIN",
    });
    return { success: true };
  }
}
