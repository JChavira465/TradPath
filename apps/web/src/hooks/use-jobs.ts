"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Job, JobsListResult, JobStatus } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useJobs(params: { status?: JobStatus; search?: string } = {}) {
  return useQuery({
    queryKey: ["jobs", params],
    queryFn: async () => (await apiClient.get<JobsListResult>("/jobs", { params })).data,
  });
}

export function useTodayJobs() {
  return useQuery({
    queryKey: ["jobs", "today"],
    queryFn: async () => (await apiClient.get<Job[]>("/jobs/today")).data,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: async () => (await apiClient.get<Job>(`/jobs/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await apiClient.post<Job>("/jobs", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJob(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await apiClient.patch<Job>(`/jobs/${id}`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJobStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: JobStatus) =>
      (await apiClient.patch<Job>(`/jobs/${id}/status`, { status })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useOnMyWay(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) =>
      (await apiClient.post(`/jobs/${id}/on-my-way`, coords)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs", id] }),
  });
}

export function useCompleteJob(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (completionNotes?: string) =>
      (await apiClient.post<Job>(`/jobs/${id}/complete`, { completionNotes })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
