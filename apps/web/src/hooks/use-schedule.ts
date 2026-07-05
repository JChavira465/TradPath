"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Job, ScheduleEvent } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useCalendarJobs(from: string, to: string, assignedUserId?: string) {
  return useQuery({
    queryKey: ["jobs", "calendar", from, to, assignedUserId],
    queryFn: async () =>
      (await apiClient.get<Job[]>("/jobs/calendar", { params: { from, to, assignedUserId } })).data,
    enabled: !!from && !!to,
  });
}

export function useUnscheduledJobs() {
  return useQuery({
    queryKey: ["jobs", "unscheduled"],
    queryFn: async () => (await apiClient.get<Job[]>("/jobs/unscheduled")).data,
  });
}

export function useScheduleEvents(from: string, to: string) {
  return useQuery({
    queryKey: ["schedule-events", from, to],
    queryFn: async () =>
      (await apiClient.get<ScheduleEvent[]>("/schedule/events", { params: { from, to } })).data,
    enabled: !!from && !!to,
  });
}

function invalidateCalendar(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["schedule-events"] });
  queryClient.invalidateQueries({ queryKey: ["jobs"] });
}

export function useRescheduleJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      (await apiClient.patch<Job>(`/jobs/${id}`, data)).data,
    onSuccess: () => invalidateCalendar(queryClient),
  });
}

export function useCreateScheduleEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      (await apiClient.post<ScheduleEvent>("/schedule/events", data)).data,
    onSuccess: () => invalidateCalendar(queryClient),
  });
}

export function useUpdateScheduleEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      (await apiClient.patch<ScheduleEvent>(`/schedule/events/${id}`, data)).data,
    onSuccess: () => invalidateCalendar(queryClient),
  });
}

export function useDeleteScheduleEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/schedule/events/${id}`)).data,
    onSuccess: () => invalidateCalendar(queryClient),
  });
}
