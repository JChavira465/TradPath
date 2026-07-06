import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { OnboardingService } from "./onboarding.service";

@UseGuards(JwtAuthGuard)
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get("checklist")
  checklist(@CurrentOrg() orgId: string) {
    return this.onboarding.checklist(orgId);
  }

  @Post("dismiss")
  dismiss(@CurrentOrg() orgId: string) {
    return this.onboarding.dismiss(orgId);
  }
}
