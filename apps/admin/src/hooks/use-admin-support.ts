"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface TicketRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
  user: { id: string; firstName: string; lastName: string; email: string };
}

export function useSupportTickets(status: string) {
  return useQuery({
    queryKey: ["admin", "support-tickets", status],
    queryFn: async () =>
      (await apiClient.get<{ tickets: TicketRow[]; total: number }>("/admin/support-tickets", { params: { status: status || undefined, pageSize: 50 } })).data,
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, priority }: { id: string; status?: string; priority?: string }) =>
      (await apiClient.patch(`/admin/support-tickets/${id}`, { status, priority })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "support-tickets"] }),
  });
}
