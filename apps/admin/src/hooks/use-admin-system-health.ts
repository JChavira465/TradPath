"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface SystemHealthSummary {
  api: { status: string; uptimeSeconds: number };
  db: { status: string; latencyMs?: number; message?: string };
  redis: { status: string; latencyMs?: number; message?: string };
  queues: { name: string; waiting?: number; active?: number; completed?: number; failed?: number; delayed?: number; status?: string }[];
  externalServices: Record<string, boolean>;
  errorRate: { failedLast24h: number; completedLast24h: number; errorRatePercent: number };
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: async () => (await apiClient.get<SystemHealthSummary>("/admin/system-health")).data,
    refetchInterval: 30000,
  });
}

export function useRetryFailedJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (queueName: string) =>
      (await apiClient.post<{ attempted: number; retried: number }>(`/admin/system-health/queues/${queueName}/retry-failed`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "system-health"] }),
  });
}
