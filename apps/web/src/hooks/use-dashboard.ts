"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => (await apiClient.get<DashboardSummary>("/dashboard/summary")).data,
    refetchInterval: 60000,
  });
}
