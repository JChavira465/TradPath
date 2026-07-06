"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TeamListResult } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async () => (await apiClient.get<TeamListResult>("/team")).data,
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; role?: string }) => (await apiClient.post("/team/invite", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) =>
      (await apiClient.patch(`/team/${userId}/role`, { role })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => (await apiClient.delete(`/team/${userId}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}
