import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { OrganizationService } from "./organization.service";
import { UpdateMorningBriefingDto } from "./dto/update-morning-briefing.dto";

@UseGuards(JwtAuthGuard)
@Controller("organization")
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get("morning-briefing")
  getMorningBriefingSettings(@CurrentOrg() orgId: string) {
    return this.organization.getMorningBriefingSettings(orgId);
  }

  @Patch("morning-briefing")
  updateMorningBriefingSettings(@CurrentOrg() orgId: string, @Body() dto: UpdateMorningBriefingDto) {
    return this.organization.updateMorningBriefingSettings(orgId, dto);
  }
}
