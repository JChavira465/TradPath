"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  type: string;
  targetPlans: string[];
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: async () => (await apiClient.get<AnnouncementRow[]>("/admin/announcements")).data,
  });
}

function useInvalidateAnnouncements() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
}

export function useCreateAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: async (input: { title: string; message: string; type?: string }) =>
      (await apiClient.post("/admin/announcements", input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/admin/announcements/${id}`)).data,
    onSuccess: invalidate,
  });
}
