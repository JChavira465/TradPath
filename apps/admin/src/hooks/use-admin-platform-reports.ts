"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface PlatformReportsSummary {
  signupsTrend: { month: string; signups: number }[];
  revenueTrend: { month: string; revenue: number }[];
  planDistribution: Record<string, number>;
}

export interface AtRiskOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  healthScore: number | null;
  lastLoginAt: string | null;
  failedPaymentCount: number;
  jobCount: number;
  invoiceCount: number;
  signals: string[];
}

export function usePlatformReportsSummary() {
  return useQuery({
    queryKey: ["admin", "platform-reports", "summary"],
    queryFn: async () => (await apiClient.get<PlatformReportsSummary>("/admin/reports/summary")).data,
  });
}

export function useAtRiskOrgs() {
  return useQuery({
    queryKey: ["admin", "platform-reports", "at-risk"],
    queryFn: async () => (await apiClient.get<AtRiskOrg[]>("/admin/reports/at-risk")).data,
  });
}
