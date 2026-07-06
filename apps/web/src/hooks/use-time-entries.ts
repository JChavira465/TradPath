"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimeEntry, TimesheetSummary } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["time-entries"] });
}

export function useActiveTimeEntry() {
  return useQuery({
    queryKey: ["time-entries", "active"],
    queryFn: async () => (await apiClient.get<TimeEntry | null>("/time-entries/active")).data,
    refetchInterval: 30000,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { jobId?: string; latitude: number; longitude: number }) =>
      (await apiClient.post<TimeEntry>("/time-entries/clock-in", data)).data,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { latitude: number; longitude: number }) =>
      (await apiClient.post<TimeEntry>("/time-entries/clock-out", data)).data,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useStartBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<TimeEntry>("/time-entries/break/start")).data,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useEndBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<TimeEntry>("/time-entries/break/end")).data,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useTimeEntries(params: { userId?: string; jobId?: string; from?: string; to?: string; status?: string }) {
  return useQuery({
    queryKey: ["time-entries", "list", params],
    queryFn: async () => (await apiClient.get<TimeEntry[]>("/time-entries", { params })).data,
    enabled: !!params.from && !!params.to,
  });
}

export function useTimesheet(params: { from: string; to: string; userId?: string }) {
  return useQuery({
    queryKey: ["time-entries", "timesheet", params],
    queryFn: async () => (await apiClient.get<TimesheetSummary[]>("/time-entries/timesheet", { params })).data,
    enabled: !!params.from && !!params.to,
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      (await apiClient.patch<TimeEntry>(`/time-entries/${id}`, data)).data,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useApproveTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post<TimeEntry>(`/time-entries/${id}/approve`)).data,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useRejectTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post<TimeEntry>(`/time-entries/${id}/reject`)).data,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/time-entries/${id}`)).data,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export async function downloadTimesheetCsv(params: { userId?: string; jobId?: string; from?: string; to?: string }) {
  const response = await apiClient.get("/time-entries/export.csv", { params, responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "timesheets.csv";
  link.click();
  URL.revokeObjectURL(url);
}
