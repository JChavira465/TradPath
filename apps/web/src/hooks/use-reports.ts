"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReportsSummary } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useReportsSummary(params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ["reports", "summary", params],
    queryFn: async () => (await apiClient.get<ReportsSummary>("/reports/summary", { params })).data,
  });
}

export async function downloadReportFile(format: "csv" | "pdf", params: { from?: string; to?: string }) {
  const response = await apiClient.get(`/reports/export.${format}`, { params, responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `report.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}
