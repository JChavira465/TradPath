import { Module } from "@nestjs/common";
import { ServicePlansModule } from "../service-plans/service-plans.module";
import { PublicBookingController } from "./public-booking.controller";
import { BookingManagementController } from "./booking-management.controller";
import { BookingService } from "./booking.service";
import { BookingManagementService } from "./booking-management.service";
import { SlugRateLimitService } from "../common/utils/slug-rate-limit.service";

@Module({
  imports: [ServicePlansModule],
  controllers: [PublicBookingController, BookingManagementController],
  providers: [BookingService, BookingManagementService, SlugRateLimitService],
})
export class BookingModule {}
