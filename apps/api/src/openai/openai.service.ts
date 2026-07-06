import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type OpenAI from "openai";
import { toFile } from "openai/uploads";
import { OPENAI_CLIENT } from "./openai.constants";

export interface PriceBookContextItem {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
}

export interface RawInvoiceDraftLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  priceBookId: string | null;
  confidence: number;
}

export interface RawInvoiceDraft {
  lineItems: RawInvoiceDraftLineItem[];
  laborHours: number;
  jobNotes: string;
  unmatchedItems: string[];
}

const INVOICE_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
          priceBookId: { type: ["string", "null"] },
          confidence: { type: "number" },
        },
        required: ["description", "quantity", "unitPrice", "priceBookId", "confidence"],
        additionalProperties: false,
      },
    },
    laborHours: { type: "number" },
    jobNotes: { type: "string" },
    unmatchedItems: { type: "array", items: { type: "string" } },
  },
  required: ["lineItems", "laborHours", "jobNotes", "unmatchedItems"],
  additionalProperties: false,
};

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  constructor(@Optional() @Inject(OPENAI_CLIENT) private readonly client: OpenAI | null) {}

  get isConfigured() {
    return !!this.client;
  }

  // Best-effort, same graceful-degradation pattern as Twilio/SendGrid:
  // never throws, returns null if not configured or the call fails —
  // callers fall back to the always-available manual entry path.
  async transcribe(buffer: Buffer, filename: string): Promise<string | null> {
    if (!this.client) {
      this.logger.warn({ event: "openai.transcribe_not_configured" });
      return null;
    }
    try {
      const file = await toFile(buffer, filename);
      const result = await this.client.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });
      return result.text;
    } catch (err: any) {
      this.logger.warn({ event: "openai.transcribe_failed", message: err.message });
      return null;
    }
  }

  async generateInvoiceDraft(input: {
    transcript: string;
    priceBook: PriceBookContextItem[];
  }): Promise<RawInvoiceDraft | null> {
    if (!this.client) {
      this.logger.warn({ event: "openai.invoice_draft_not_configured" });
      return null;
    }
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content:
              "You turn a field-service technician's spoken job summary into an invoice draft. " +
              "Match mentioned parts/labor against the provided price book by name/description where " +
              "possible, using the price book's exact id and unitPrice for any match — do not invent " +
              "prices. Anything you can't confidently match against the price book should be left out " +
              "of lineItems and instead listed as a short string in unmatchedItems. Estimate laborHours " +
              "from context if the tech mentions time worked, otherwise 0. jobNotes is a brief summary " +
              "of the work performed, written for the customer.",
          },
          {
            role: "user",
            content: JSON.stringify({ transcript: input.transcript, priceBook: input.priceBook }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "invoice_draft", schema: INVOICE_DRAFT_SCHEMA, strict: true },
        },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content) as RawInvoiceDraft;
    } catch (err: any) {
      this.logger.warn({ event: "openai.invoice_draft_failed", message: err.message });
      return null;
    }
  }
}
