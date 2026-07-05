import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateMorningBriefingDto } from "./dto/update-morning-briefing.dto";

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMorningBriefingSettings(orgId: string) {
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        morningBriefingEnabled: true,
        morningBriefingTime: true,
        morningBriefingChannel: true,
        timezone: true,
      },
    });
  }

  async updateMorningBriefingSettings(orgId: string, dto: UpdateMorningBriefingDto) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: dto,
      select: {
        morningBriefingEnabled: true,
        morningBriefingTime: true,
        morningBriefingChannel: true,
        timezone: true,
      },
    });
  }
}
