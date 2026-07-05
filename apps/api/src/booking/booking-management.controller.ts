import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { BookingManagementService } from "./booking-management.service";
import { BookingSettingsDto } from "./dto/booking-settings.dto";
import { CreateBookingAvailabilityDto } from "./dto/booking-availability.dto";
import { CreateBookingBlackoutDto } from "./dto/booking-blackout.dto";
import { RescheduleBookingRequestDto } from "./dto/reschedule-booking-request.dto";
import { SetBookableDto } from "./dto/set-bookable.dto";
import { SetPublicDto } from "./dto/set-public.dto";

@UseGuards(JwtAuthGuard)
@Controller("booking")
export class BookingManagementController {
  constructor(private readonly bookingManagement: BookingManagementService) {}

  @Get("requests")
  listRequests(@CurrentOrg() orgId: string, @Query("status") status?: string) {
    return this.bookingManagement.listRequests(orgId, status);
  }

  @Post("requests/:id/confirm")
  @HttpCode(200)
  confirm(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.bookingManagement.confirm(orgId, id, user.userId);
  }

  @Post("requests/:id/decline")
  @HttpCode(200)
  decline(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.bookingManagement.decline(orgId, id);
  }

  @Post("requests/:id/reschedule")
  @HttpCode(200)
  reschedule(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: RescheduleBookingRequestDto) {
    return this.bookingManagement.reschedule(orgId, id, dto);
  }

  @Get("services")
  listServiceOfferings(@CurrentOrg() orgId: string) {
    return this.bookingManagement.listServiceOfferings(orgId);
  }

  @Patch("services/:id/bookable")
  setServiceOfferingBookable(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: SetBookableDto) {
    return this.bookingManagement.setServiceOfferingBookable(orgId, id, dto.isBookable);
  }

  @Get("plan-templates")
  listServicePlanTemplates(@CurrentOrg() orgId: string) {
    return this.bookingManagement.listServicePlanTemplates(orgId);
  }

  @Patch("plan-templates/:id/public")
  setServicePlanPublic(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: SetPublicDto) {
    return this.bookingManagement.setServicePlanPublic(orgId, id, dto.isPublic);
  }

  @Get("availability")
  listAvailability(@CurrentOrg() orgId: string) {
    return this.bookingManagement.listAvailability(orgId);
  }

  @Post("availability")
  addAvailability(@CurrentOrg() orgId: string, @Body() dto: CreateBookingAvailabilityDto) {
    return this.bookingManagement.addAvailability(orgId, dto);
  }

  @Delete("availability/:id")
  removeAvailability(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.bookingManagement.removeAvailability(orgId, id);
  }

  @Get("blackouts")
  listBlackouts(@CurrentOrg() orgId: string) {
    return this.bookingManagement.listBlackouts(orgId);
  }

  @Post("blackouts")
  addBlackout(@CurrentOrg() orgId: string, @Body() dto: CreateBookingBlackoutDto) {
    return this.bookingManagement.addBlackout(orgId, dto);
  }

  @Delete("blackouts/:id")
  removeBlackout(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.bookingManagement.removeBlackout(orgId, id);
  }

  @Get("settings")
  getSettings(@CurrentOrg() orgId: string) {
    return this.bookingManagement.getSettings(orgId);
  }

  @Patch("settings")
  updateSettings(@CurrentOrg() orgId: string, @Body() dto: BookingSettingsDto) {
    return this.bookingManagement.updateSettings(orgId, dto);
  }
}
