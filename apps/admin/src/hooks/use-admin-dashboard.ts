"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface ExecutiveDashboardSummary {
  companyCount: number;
  userCount: number;
  platformMrr: number;
  platformArr: number;
  planGrowthChurn: { byStatus: Record<string, number>; churnedLast30Days: number };
  trialsEndingSoon: number;
  bookingsByStatus: Record<string, number>;
  orgsByTier: Record<string, number>;
  aiUsage: { plan: string; orgCount: number; creditsUsed: number; creditsLimit: number | null }[];
  failedPaymentsLast30Days: number;
  storageUsedBytes: number;
  openTicketCount: number;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => (await apiClient.get<ExecutiveDashboardSummary>("/admin/dashboard")).data,
  });
}
