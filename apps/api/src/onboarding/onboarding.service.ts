import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface OnboardingChecklistItem {
  key: string;
  label: string;
  done: boolean;
  actionHref: string;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  // Every item is derived from live data rather than a separately-tracked
  // flag — a step already done before onboarding even started (e.g. an org
  // that imported customers first) shows as complete immediately, and
  // nothing can drift out of sync with reality.
  async checklist(orgId: string) {
    const [org, customerCount, priceBookCount, jobCount, sentInvoiceCount, teamCount] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, phone: true, address: true, bookingEnabled: true, onboardingDismissedAt: true },
      }),
      this.prisma.customer.count({ where: { organizationId: orgId } }),
      this.prisma.priceBook.count({ where: { organizationId: orgId } }),
      this.prisma.job.count({ where: { organizationId: orgId } }),
      this.prisma.invoice.count({ where: { organizationId: orgId, sentAt: { not: null } } }),
      this.prisma.user.count({ where: { organizationId: orgId } }),
    ]);

    const items: OnboardingChecklistItem[] = [
      {
        key: "company_profile",
        label: "Complete your company profile",
        done: !!(org?.name && (org.phone || org.address)),
        actionHref: "/dashboard/settings",
      },
      {
        key: "add_customer",
        label: "Add your first customer",
        done: customerCount > 0,
        actionHref: "/dashboard/customers/new",
      },
      {
        key: "add_price_book_item",
        label: "Add a price book item",
        done: priceBookCount > 0,
        actionHref: "/dashboard/price-book",
      },
      {
        key: "create_job",
        label: "Create your first job",
        done: jobCount > 0,
        actionHref: "/dashboard/jobs/new",
      },
      {
        key: "send_invoice",
        label: "Send your first invoice",
        done: sentInvoiceCount > 0,
        actionHref: "/dashboard/invoices/new",
      },
      {
        key: "enable_booking",
        label: "Enable online booking",
        done: !!org?.bookingEnabled,
        actionHref: "/dashboard/booking/settings",
      },
      {
        key: "invite_team",
        label: "Invite a teammate",
        done: teamCount > 1,
        actionHref: "/dashboard/settings",
      },
    ];

    const completedCount = items.filter((i) => i.done).length;

    return {
      items,
      completedCount,
      totalCount: items.length,
      allDone: completedCount === items.length,
      dismissed: !!org?.onboardingDismissedAt,
    };
  }

  async dismiss(orgId: string) {
    await this.prisma.organization.update({ where: { id: orgId }, data: { onboardingDismissedAt: new Date() } });
    return { success: true };
  }
}
