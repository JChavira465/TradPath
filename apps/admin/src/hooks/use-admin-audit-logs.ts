"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface AuditLogRow {
  id: string;
  organizationId: string | null;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: unknown;
  newValue: unknown;
  isSuperAdminAction: boolean;
  platform: string;
  createdAt: string;
  organization: { id: string; name: string; slug: string } | null;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export function useAuditLogs(filters: { action?: string; isSuperAdminAction?: string }) {
  return useQuery({
    queryKey: ["admin", "audit-logs", filters],
    queryFn: async () =>
      (await apiClient.get<{ logs: AuditLogRow[]; total: number }>("/admin/audit-logs", { params: { ...filters, pageSize: 50 } })).data,
  });
}

export function downloadAuditLogsCsv(filters: { action?: string; isSuperAdminAction?: string }) {
  apiClient.get("/admin/audit-logs/export.csv", { params: filters, responseType: "blob" }).then((res) => {
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-logs.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  });
}
