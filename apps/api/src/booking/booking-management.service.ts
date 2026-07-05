import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { withRetryOnCollision } from "../common/utils/sequential-number.util";
import { BookingSettingsDto } from "./dto/booking-settings.dto";
import { CreateBookingAvailabilityDto } from "./dto/booking-availability.dto";
import { CreateBookingBlackoutDto } from "./dto/booking-blackout.dto";
import { RescheduleBookingRequestDto } from "./dto/reschedule-booking-request.dto";

@Injectable()
export class BookingManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async listRequests(orgId: string, status?: string) {
    return this.prisma.bookingRequest.findMany({
      where: { organizationId: orgId, ...(status && { status: status as any }) },
      orderBy: { createdAt: "desc" },
    });
  }

  private async assertRequestExists(orgId: string, id: string) {
    const request = await this.prisma.bookingRequest.findFirst({ where: { id, organizationId: orgId } });
    if (!request) {
      throw new NotFoundException("Booking request not found");
    }
    return request;
  }

  async confirm(orgId: string, id: string, userId: string) {
    const request = await this.assertRequestExists(orgId, id);
    if (request.status !== "PENDING") {
      throw new BadRequestException(`Cannot confirm a request in ${request.status} status`);
    }

    let customer = await this.prisma.customer.findFirst({
      where: { organizationId: orgId, email: request.email },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          organizationId: orgId,
          firstName: request.firstName,
          lastName: request.lastName,
          email: request.email,
          phone: request.phone,
          serviceAddress: request.serviceAddress,
          city: request.city,
          state: request.state,
          zip: request.zip,
          propertyType: request.propertyType,
          source: "BOOKING_PAGE",
        },
      });
    }

    const offering = request.serviceOfferingId
      ? await this.prisma.serviceOffering.findUnique({ where: { id: request.serviceOfferingId } })
      : null;

    return withRetryOnCollision(async () => {
      const lastJob = await this.prisma.job.findFirst({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        select: { jobNumber: true },
      });
      const jobNumber = String(lastJob ? (parseInt(lastJob.jobNumber, 10) || 1000) + 1 : 1001);

      return this.prisma.$transaction(async (tx) => {
        const job = await tx.job.create({
          data: {
            organizationId: orgId,
            customerId: customer!.id,
            bookingRequestId: request.id,
            jobNumber,
            title: offering?.name ?? "Booking request",
            serviceAddress: request.serviceAddress,
            city: request.city,
            state: request.state,
            zip: request.zip,
            scheduledStart: request.requestedDate ?? undefined,
            createdBy: userId,
          },
        });
        await tx.bookingRequest.update({
          where: { id },
          data: { status: "CONFIRMED", convertedToJobId: job.id, convertedAt: new Date() },
        });
        return job;
      });
    });
  }

  async decline(orgId: string, id: string) {
    const request = await this.assertRequestExists(orgId, id);
    if (request.status !== "PENDING") {
      throw new BadRequestException(`Cannot decline a request in ${request.status} status`);
    }
    return this.prisma.bookingRequest.update({ where: { id }, data: { status: "DECLINED" } });
  }

  async reschedule(orgId: string, id: string, dto: RescheduleBookingRequestDto) {
    const request = await this.assertRequestExists(orgId, id);
    if (request.status !== "PENDING") {
      throw new BadRequestException(`Cannot reschedule a request in ${request.status} status`);
    }
    return this.prisma.bookingRequest.update({
      where: { id },
      data: { requestedDate: new Date(dto.requestedDate), requestedTimeSlot: dto.requestedTimeSlot },
    });
  }

  // ── Bookable services & plans ────────────────────────────────────────
  // Full ServiceOffering/ServicePlan CRUD (categories, pricing, photos) is
  // separate scope — this is just the on/off toggle for what's already
  // shown on the public booking page.
  async listServiceOfferings(orgId: string) {
    return this.prisma.serviceOffering.findMany({
      where: { organizationId: orgId },
      orderBy: { sortOrder: "asc" },
    });
  }

  async setServiceOfferingBookable(orgId: string, id: string, isBookable: boolean) {
    const offering = await this.prisma.serviceOffering.findFirst({ where: { id, organizationId: orgId } });
    if (!offering) throw new NotFoundException("Service offering not found");
    return this.prisma.serviceOffering.update({ where: { id }, data: { isBookable } });
  }

  async listServicePlanTemplates(orgId: string) {
    return this.prisma.servicePlan.findMany({
      where: { organizationId: orgId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async setServicePlanPublic(orgId: string, id: string, isPublic: boolean) {
    const plan = await this.prisma.servicePlan.findFirst({ where: { id, organizationId: orgId } });
    if (!plan) throw new NotFoundException("Service plan not found");
    if (isPublic && !plan.publicName) {
      throw new BadRequestException("Set a public name for this plan before making it public");
    }
    return this.prisma.servicePlan.update({ where: { id }, data: { isPublic } });
  }

  // ── Availability & blackouts ─────────────────────────────────────────
  async listAvailability(orgId: string) {
    return this.prisma.bookingAvailability.findMany({ where: { organizationId: orgId }, orderBy: { dayOfWeek: "asc" } });
  }

  async addAvailability(orgId: string, dto: CreateBookingAvailabilityDto) {
    return this.prisma.bookingAvailability.create({ data: { ...dto, organizationId: orgId } });
  }

  async removeAvailability(orgId: string, id: string) {
    const row = await this.prisma.bookingAvailability.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException("Availability window not found");
    await this.prisma.bookingAvailability.delete({ where: { id } });
    return { success: true };
  }

  async listBlackouts(orgId: string) {
    return this.prisma.bookingBlackout.findMany({ where: { organizationId: orgId }, orderBy: { date: "asc" } });
  }

  async addBlackout(orgId: string, dto: CreateBookingBlackoutDto) {
    return this.prisma.bookingBlackout.create({
      data: { organizationId: orgId, date: new Date(dto.date), reason: dto.reason },
    });
  }

  async removeBlackout(orgId: string, id: string) {
    const row = await this.prisma.bookingBlackout.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException("Blackout date not found");
    await this.prisma.bookingBlackout.delete({ where: { id } });
    return { success: true };
  }

  // ── Settings ──────────────────────────────────────────────────────
  async getSettings(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        bookingEnabled: true,
        bookingSlug: true,
        bookingPageTitle: true,
        bookingPageDescription: true,
        bookingPageLogo: true,
        bookingPageColor: true,
      },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async updateSettings(orgId: string, dto: BookingSettingsDto) {
    if (dto.bookingSlug) {
      const existing = await this.prisma.organization.findUnique({ where: { bookingSlug: dto.bookingSlug } });
      if (existing && existing.id !== orgId) {
        throw new BadRequestException("That booking link is already taken");
      }
    }
    return this.prisma.organization.update({ where: { id: orgId }, data: dto });
  }
}
