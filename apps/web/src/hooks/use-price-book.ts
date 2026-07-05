"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PriceBookImportResult, PriceBookItem } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function usePriceBook(search?: string) {
  return useQuery({
    queryKey: ["price-book", search],
    queryFn: async () => (await apiClient.get<PriceBookItem[]>("/price-book", { params: { search } })).data,
  });
}

export function useCreatePriceBookItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await apiClient.post<PriceBookItem>("/price-book", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-book"] }),
  });
}

export function useDeletePriceBookItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/price-book/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-book"] }),
  });
}

export function useImportPriceBookCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await apiClient.post<PriceBookImportResult>("/price-book/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-book"] }),
  });
}
