"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServicePlan, ServicePlanDashboard } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useServicePlans(customerId?: string) {
  return useQuery({
    queryKey: ["service-plans", customerId],
    queryFn: async () => (await apiClient.get<ServicePlan[]>("/service-plans", { params: { customerId } })).data,
  });
}

export function useServicePlanDashboard() {
  return useQuery({
    queryKey: ["service-plans", "dashboard"],
    queryFn: async () => (await apiClient.get<ServicePlanDashboard>("/service-plans/dashboard")).data,
  });
}

export function useServicePlan(id: string) {
  return useQuery({
    queryKey: ["service-plans", id],
    queryFn: async () => (await apiClient.get<ServicePlan>(`/service-plans/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateServicePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await apiClient.post<ServicePlan>("/service-plans", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-plans"] }),
  });
}

export function useServicePlanAction(id: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["service-plans"] });
  };
  return {
    pause: useMutation({ mutationFn: async () => (await apiClient.post(`/service-plans/${id}/pause`)).data, onSuccess: invalidate }),
    resume: useMutation({ mutationFn: async () => (await apiClient.post(`/service-plans/${id}/resume`)).data, onSuccess: invalidate }),
    cancel: useMutation({
      mutationFn: async (reason?: string) => (await apiClient.post(`/service-plans/${id}/cancel`, { reason })).data,
      onSuccess: invalidate,
    }),
    generateJob: useMutation({ mutationFn: async () => (await apiClient.post(`/service-plans/${id}/generate-job`)).data, onSuccess: invalidate }),
  };
}
