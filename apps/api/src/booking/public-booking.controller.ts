import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { FastifyRequest } from "fastify";
import { BookingService } from "./booking.service";
import { TurnstileService } from "../common/turnstile/turnstile.service";
import { SlugRateLimitService } from "../common/utils/slug-rate-limit.service";
import { CreateBookingRequestDto } from "./dto/create-booking-request.dto";
import { SubscribeDto } from "./dto/subscribe.dto";

const PER_SLUG_LIMIT = 30;
const PER_SLUG_WINDOW_SECONDS = 60 * 60;

// S8 — per-IP: 10/min (Throttle below). Per-slug: 30/hour (SlugRateLimitService).
@Throttle({ default: { limit: 10, ttl: 60 } })
@Controller("book/:slug")
export class PublicBookingController {
  constructor(
    private readonly booking: BookingService,
    private readonly turnstile: TurnstileService,
    private readonly slugRateLimit: SlugRateLimitService,
  ) {}

  @Get()
  getPage(@Param("slug") slug: string) {
    return this.booking.getPage(slug);
  }

  @Get("services")
  getServices(@Param("slug") slug: string) {
    return this.booking.getServices(slug);
  }

  @Get("plans")
  getPlans(@Param("slug") slug: string) {
    return this.booking.getPlans(slug);
  }

  @Get("availability")
  getAvailability(@Param("slug") slug: string, @Query("date") date: string) {
    return this.booking.getAvailability(slug, date);
  }

  @Post("request")
  async createRequest(
    @Param("slug") slug: string,
    @Body() dto: CreateBookingRequestDto,
    @Req() req: FastifyRequest,
  ) {
    await this.slugRateLimit.assertWithinLimit(`request:${slug}`, PER_SLUG_LIMIT, PER_SLUG_WINDOW_SECONDS);
    const verified = await this.turnstile.verify(dto.turnstileToken, req.ip);
    if (!verified) {
      throw new ForbiddenException("Verification failed");
    }
    return this.booking.createRequest(slug, dto, req.ip);
  }

  @Post("subscribe")
  async subscribe(@Param("slug") slug: string, @Body() dto: SubscribeDto, @Req() req: FastifyRequest) {
    await this.slugRateLimit.assertWithinLimit(`subscribe:${slug}`, PER_SLUG_LIMIT, PER_SLUG_WINDOW_SECONDS);
    const verified = await this.turnstile.verify(dto.turnstileToken, req.ip);
    if (!verified) {
      throw new ForbiddenException("Verification failed");
    }
    return this.booking.subscribe(slug, dto, req.ip);
  }
}
