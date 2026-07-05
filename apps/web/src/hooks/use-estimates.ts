"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Estimate } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useEstimates(customerId?: string) {
  return useQuery({
    queryKey: ["estimates", customerId],
    queryFn: async () => (await apiClient.get<Estimate[]>("/estimates", { params: { customerId } })).data,
  });
}

export function useEstimate(id: string) {
  return useQuery({
    queryKey: ["estimates", id],
    queryFn: async () => (await apiClient.get<Estimate>(`/estimates/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await apiClient.post<Estimate>("/estimates", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["estimates"] }),
  });
}

export function useSendEstimate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<Estimate>(`/estimates/${id}/send`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["estimates", id] }),
  });
}

export function useConvertEstimateToJob(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post(`/estimates/${id}/convert-to-job`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
