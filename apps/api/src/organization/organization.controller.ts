import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { OrganizationService } from "./organization.service";
import { UpdateMorningBriefingDto } from "./dto/update-morning-briefing.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@UseGuards(JwtAuthGuard)
@Controller("organization")
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get("profile")
  getProfile(@CurrentOrg() orgId: string) {
    return this.organization.getProfile(orgId);
  }

  @Patch("profile")
  updateProfile(@CurrentOrg() orgId: string, @Body() dto: UpdateProfileDto) {
    return this.organization.updateProfile(orgId, dto);
  }

  @Post("billing-portal")
  createBillingPortalSession(@CurrentOrg() orgId: string) {
    return this.organization.createBillingPortalSession(orgId);
  }

  @Get("morning-briefing")
  getMorningBriefingSettings(@CurrentOrg() orgId: string) {
    return this.organization.getMorningBriefingSettings(orgId);
  }

  @Patch("morning-briefing")
  updateMorningBriefingSettings(@CurrentOrg() orgId: string, @Body() dto: UpdateMorningBriefingDto) {
    return this.organization.updateMorningBriefingSettings(orgId, dto);
  }
}
