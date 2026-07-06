"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AiInvoiceDraft, Invoice, TranscribeResult } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useTranscribeVoiceMemo() {
  return useMutation({
    mutationFn: async ({ jobId, blob, filename }: { jobId: string; blob: Blob; filename: string }) => {
      const form = new FormData();
      form.append("file", blob, filename);
      form.append("jobId", jobId);
      return (
        await apiClient.post<TranscribeResult>("/ai/transcribe", form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
  });
}

export function useGenerateInvoiceDraft() {
  return useMutation({
    mutationFn: async (data: { jobId: string; transcript?: string }) =>
      (await apiClient.post<AiInvoiceDraft>("/ai/generate-invoice-draft", data)).data,
  });
}

export function useConfirmInvoiceDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      jobId: string;
      lineItems: { description: string; quantity: number; unitPrice: number; taxable?: boolean }[];
      notes?: string;
    }) => (await apiClient.post<Invoice>("/ai/confirm-invoice-draft", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
}
