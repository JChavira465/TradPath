"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ArSummary, Invoice } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useInvoices(params: { customerId?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: async () => (await apiClient.get<Invoice[]>("/invoices", { params })).data,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => (await apiClient.get<Invoice>(`/invoices/${id}`)).data,
    enabled: !!id,
  });
}

export function useArSummary() {
  return useQuery({
    queryKey: ["invoices", "ar-summary"],
    queryFn: async () => (await apiClient.get<ArSummary>("/invoices/ar-summary")).data,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await apiClient.post<Invoice>("/invoices", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useSendInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<Invoice>(`/invoices/${id}/send`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices", id] }),
  });
}

export function useRecordPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { amount: number; method: string; reference?: string; notes?: string }) =>
      (await apiClient.post(`/invoices/${id}/record-payment`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", "ar-summary"] });
    },
  });
}
