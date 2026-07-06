import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@tradpath/database";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { InvoicesService } from "../invoices/invoices.service";
import { OpenAiService } from "../openai/openai.service";
import { GenerateInvoiceDraftDto } from "./dto/generate-invoice-draft.dto";
import { ConfirmInvoiceDraftDto } from "./dto/confirm-invoice-draft.dto";
import { AI_CREDIT_LIMITS } from "./ai-credit-limits.constant";

const MAX_INVOICE_TOTAL = 50_000;
const MAX_QUANTITY = 999;
const PRICE_MATCH_EPSILON = 0.01;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly openai: OpenAiService,
    private readonly invoices: InvoicesService,
  ) {}

  private async assertJobBelongsToOrg(orgId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, organizationId: orgId } });
    if (!job) {
      throw new NotFoundException("Job not found in this organization");
    }
    return job;
  }

  async transcribe(orgId: string, jobId: string, buffer: Buffer, filename: string) {
    const job = await this.assertJobBelongsToOrg(orgId, jobId);

    const upload = await this.storage.uploadVoiceMemo(orgId, buffer);
    const transcript = await this.openai.transcribe(buffer, filename);

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        voiceMemoUrl: upload.path,
        voiceMemoTranscript: transcript ?? job.voiceMemoTranscript,
      },
    });

    return {
      voiceMemoPath: upload.path,
      transcript,
      transcribed: transcript !== null,
    };
  }

  // Resets the monthly counter if we've rolled into a new billing month,
  // then checks (but does not yet consume) the org's plan allowance —
  // credits are only actually spent once OpenAI returns a real draft (see
  // consumeCredit below), so a misconfigured/unreachable OpenAI never
  // burns the org's monthly allowance for nothing.
  private async assertUnderCreditLimit(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionPlan: true, aiCreditsUsed: true, aiCreditsResetAt: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    const limit = AI_CREDIT_LIMITS[org.subscriptionPlan] ?? 0;
    const { creditsUsed } = this.currentWindow(org);

    if (limit !== Infinity && creditsUsed >= limit) {
      throw new ForbiddenException(
        `AI voice-to-invoice limit reached for this plan (${limit}/month). Upgrade your plan or enter the invoice manually.`,
      );
    }
  }

  private currentWindow(org: { aiCreditsUsed: number; aiCreditsResetAt: Date | null }) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!org.aiCreditsResetAt || org.aiCreditsResetAt < monthStart) {
      return { creditsUsed: 0, resetAt: now };
    }
    return { creditsUsed: org.aiCreditsUsed, resetAt: org.aiCreditsResetAt };
  }

  private async consumeCredit(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { aiCreditsUsed: true, aiCreditsResetAt: true },
    });
    const { creditsUsed, resetAt } = this.currentWindow(org!);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { aiCreditsUsed: creditsUsed + 1, aiCreditsResetAt: resetAt },
    });
  }

  async generateInvoiceDraft(orgId: string, dto: GenerateInvoiceDraftDto) {
    const job = await this.assertJobBelongsToOrg(orgId, dto.jobId);
    const transcript = dto.transcript ?? job.voiceMemoTranscript;
    if (!transcript) {
      throw new BadRequestException("No transcript available — record a voice memo first or enter the invoice manually");
    }

    await this.assertUnderCreditLimit(orgId);

    const priceBookItems = await this.prisma.priceBook.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, category: true, unitPrice: true },
    });

    const raw = await this.openai.generateInvoiceDraft({
      transcript,
      priceBook: priceBookItems.map((p) => ({ id: p.id, name: p.name, category: p.category, unitPrice: Number(p.unitPrice) })),
    });

    if (!raw) {
      return { configured: false, lineItems: [], unmatchedItems: [], laborHours: 0, jobNotes: "" };
    }

    const priceBookById = new Map(priceBookItems.map((p) => [p.id, p]));
    const matched: typeof raw.lineItems = [];
    const unmatched = [...raw.unmatchedItems];

    for (const item of raw.lineItems) {
      const quantity = Math.min(Math.max(item.quantity, 0.01), MAX_QUANTITY);

      // S10 — never trust the model's claimed price book match: re-verify
      // against the actual row. A mismatched or missing match gets stripped
      // out to unmatchedItems rather than silently billed at an AI-invented
      // price.
      if (item.priceBookId) {
        const priceBookItem = priceBookById.get(item.priceBookId);
        if (priceBookItem && Math.abs(Number(priceBookItem.unitPrice) - item.unitPrice) <= PRICE_MATCH_EPSILON) {
          matched.push({ ...item, quantity, unitPrice: Number(priceBookItem.unitPrice) });
          continue;
        }
        unmatched.push(item.description);
        continue;
      }
      unmatched.push(item.description);
    }

    const total = matched.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    if (total > MAX_INVOICE_TOTAL) {
      throw new BadRequestException(
        `AI-drafted total ($${total.toFixed(2)}) exceeds the $${MAX_INVOICE_TOTAL.toLocaleString()} safety limit for voice-to-invoice — split this into multiple invoices or enter it manually.`,
      );
    }

    await this.consumeCredit(orgId);

    const draft = {
      lineItems: matched,
      unmatchedItems: unmatched,
      laborHours: raw.laborHours,
      jobNotes: raw.jobNotes,
    };

    await this.prisma.job.update({
      where: { id: job.id },
      data: { aiInvoiceDraft: draft as unknown as Prisma.InputJsonValue },
    });

    return { configured: true, ...draft };
  }

  async confirmInvoiceDraft(orgId: string, userId: string, dto: ConfirmInvoiceDraftDto) {
    const job = await this.assertJobBelongsToOrg(orgId, dto.jobId);

    const invoice = await this.invoices.create(orgId, userId, {
      customerId: job.customerId,
      jobId: job.id,
      lineItems: dto.lineItems,
      notes: dto.notes,
    });

    await this.prisma.job.update({ where: { id: job.id }, data: { aiInvoiceDraft: Prisma.DbNull } });

    return invoice;
  }
}
