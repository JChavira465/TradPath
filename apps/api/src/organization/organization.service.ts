import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { STRIPE_CLIENT } from "../stripe/stripe.constants";
import { UpdateMorningBriefingDto } from "./dto/update-morning-briefing.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

const PROFILE_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  website: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  logo: true,
  timezone: true,
  currency: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  defaultTaxRate: true,
  defaultInvoiceTerms: true,
  defaultInvoiceDueDays: true,
} as const;

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly config: ConfigService,
  ) {}

  async getProfile(orgId: string) {
    return this.prisma.organization.findUnique({ where: { id: orgId }, select: PROFILE_SELECT });
  }

  async updateProfile(orgId: string, dto: UpdateProfileDto) {
    return this.prisma.organization.update({ where: { id: orgId }, data: dto, select: PROFILE_SELECT });
  }

  // Lazily creates the org's own Stripe Customer (for the SaaS subscription
  // itself, distinct from the per-end-customer Stripe Customers created for
  // service-plan billing) the first time a portal session is requested.
  // Same graceful-degradation shape as the rest of the app's Stripe calls:
  // no configured key just means no portal link, not a 500.
  async createBillingPortalSession(orgId: string): Promise<{ url: string | null }> {
    try {
      const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

      let stripeCustomerId = org.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await this.stripe.customers.create({
          name: org.name,
          email: org.email ?? undefined,
          metadata: { organizationId: orgId },
        });
        stripeCustomerId = customer.id;
        await this.prisma.organization.update({ where: { id: orgId }, data: { stripeCustomerId } });
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${this.config.get<string>("FRONTEND_URL")}/dashboard/settings`,
      });

      return { url: session.url };
    } catch (err: any) {
      this.logger.warn({ event: "billing_portal.create_failed", organizationId: orgId, message: err.message });
      return { url: null };
    }
  }

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
