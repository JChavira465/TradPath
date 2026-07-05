import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { nanoid } from "nanoid";
import { PrismaService } from "../prisma/prisma.service";
import { ServicePlansService } from "../service-plans/service-plans.service";
import { EmailService } from "../email/email.service";
import { CreateBookingRequestDto } from "./dto/create-booking-request.dto";
import { SubscribeDto } from "./dto/subscribe.dto";

const DEFAULT_SLOT_MINUTES = 60;

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicePlans: ServicePlansService,
    private readonly email: EmailService,
  ) {}

  private async getOrgBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({ where: { bookingSlug: slug } });
    if (!org || !org.bookingEnabled || org.isSuspended) {
      throw new NotFoundException("Booking page not found");
    }
    return org;
  }

  async getPage(slug: string) {
    const org = await this.getOrgBySlug(slug);
    return {
      name: org.name,
      bookingPageTitle: org.bookingPageTitle,
      bookingPageDescription: org.bookingPageDescription,
      bookingPageLogo: org.bookingPageLogo,
      bookingPageColor: org.bookingPageColor,
      timezone: org.timezone,
    };
  }

  async getServices(slug: string) {
    const org = await this.getOrgBySlug(slug);
    return this.prisma.serviceOffering.findMany({
      where: { organizationId: org.id, isBookable: true, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getPlans(slug: string) {
    const org = await this.getOrgBySlug(slug);
    const plans = await this.prisma.servicePlan.findMany({
      where: { organizationId: org.id, isPublic: true },
      select: { id: true, publicName: true, publicDescription: true, price: true, billingCycle: true, serviceFrequency: true },
    });
    return plans;
  }

  async getAvailability(slug: string, dateStr: string) {
    const org = await this.getOrgBySlug(slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const dayOfWeek = date.getUTCDay();

    const blackout = await this.prisma.bookingBlackout.findFirst({
      where: { organizationId: org.id, date },
    });
    if (blackout) {
      return { date: dateStr, slots: [] };
    }

    const windows = await this.prisma.bookingAvailability.findMany({
      where: { organizationId: org.id, dayOfWeek, isActive: true },
    });
    if (windows.length === 0) {
      return { date: dateStr, slots: [] };
    }

    const dayStart = date;
    const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const existingJobs = await this.prisma.job.findMany({
      where: {
        organizationId: org.id,
        scheduledStart: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["CANCELLED"] },
      },
      select: { scheduledStart: true, estimatedDuration: true },
    });

    const busyRanges = existingJobs
      .filter((j) => j.scheduledStart)
      .map((j) => ({
        start: j.scheduledStart!.getTime(),
        end: j.scheduledStart!.getTime() + (j.estimatedDuration ?? DEFAULT_SLOT_MINUTES) * 60_000,
      }));

    const slots: string[] = [];
    for (const window of windows) {
      const [startH, startM] = window.startTime.split(":").map(Number);
      const [endH, endM] = window.endTime.split(":").map(Number);
      let cursor = new Date(date.getTime() + (startH * 60 + startM) * 60_000);
      const windowEnd = new Date(date.getTime() + (endH * 60 + endM) * 60_000);

      while (cursor.getTime() + DEFAULT_SLOT_MINUTES * 60_000 <= windowEnd.getTime()) {
        const slotStart = cursor.getTime();
        const slotEnd = slotStart + DEFAULT_SLOT_MINUTES * 60_000;
        const overlaps = busyRanges.some((b) => slotStart < b.end && slotEnd > b.start);
        if (!overlaps) {
          slots.push(cursor.toISOString().slice(11, 16));
        }
        cursor = new Date(cursor.getTime() + DEFAULT_SLOT_MINUTES * 60_000);
      }
    }

    return { date: dateStr, slots };
  }

  async createRequest(slug: string, dto: CreateBookingRequestDto, ipAddress: string) {
    const org = await this.getOrgBySlug(slug);

    if (dto.serviceOfferingId) {
      const offering = await this.prisma.serviceOffering.findFirst({
        where: { id: dto.serviceOfferingId, organizationId: org.id, isBookable: true },
      });
      if (!offering) {
        throw new BadRequestException("Selected service is not available");
      }
    }

    const confirmationCode = nanoid(8).toUpperCase();

    const request = await this.prisma.bookingRequest.create({
      data: {
        organizationId: org.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        serviceAddress: dto.serviceAddress,
        city: dto.city,
        state: dto.state,
        zip: dto.zip,
        propertyType: dto.propertyType,
        serviceOfferingId: dto.serviceOfferingId,
        requestedDate: dto.requestedDate ? new Date(dto.requestedDate) : undefined,
        requestedTimeSlot: dto.requestedTimeSlot,
        notes: dto.notes,
        confirmationCode,
        ipAddress,
      },
    });

    // Confirmation email to the customer + notification to the owner.
    // SMS versions of both wire in once a per-org Twilio number exists
    // (Sprint 4E business texting).
    await this.email.send({
      to: dto.email,
      subject: `Booking request received — ${org.name}`,
      html: `<p>Hi ${dto.firstName},</p><p>We've received your booking request. Your confirmation code is <strong>${confirmationCode}</strong>. We'll be in touch shortly to confirm.</p>`,
    });
    if (org.email) {
      await this.email.send({
        to: org.email,
        subject: `New booking request from ${dto.firstName} ${dto.lastName}`,
        html: `<p>New booking request via your booking page.</p><p>${dto.firstName} ${dto.lastName} — ${dto.phone} — ${dto.email}</p><p>${dto.serviceAddress}</p>${dto.notes ? `<p>"${dto.notes}"</p>` : ""}`,
      });
    }

    return { id: request.id, confirmationCode };
  }

  async subscribe(slug: string, dto: SubscribeDto, ipAddress: string) {
    const org = await this.getOrgBySlug(slug);

    const template = await this.prisma.servicePlan.findFirst({
      where: { id: dto.planTemplateId, organizationId: org.id, isPublic: true },
    });
    if (!template) {
      throw new BadRequestException("Selected plan is not available");
    }

    let customer = await this.prisma.customer.findFirst({
      where: { organizationId: org.id, email: dto.email },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          organizationId: org.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          source: "BOOKING_PAGE",
        },
      });
    }

    const plan = await this.servicePlans.create(org.id, "system", {
      customerId: customer.id,
      name: template.publicName ?? template.name,
      description: template.publicDescription ?? undefined,
      billingCycle: template.billingCycle,
      price: Number(template.price),
      serviceFrequency: template.serviceFrequency,
    });

    // clientSecret is present only when Stripe is actually configured —
    // the public page falls back to "we'll bill you" messaging without it.
    return {
      servicePlanId: plan.id,
      customerId: customer.id,
      clientSecret: (plan as any).stripeClientSecret as string | undefined,
    };
  }
}
