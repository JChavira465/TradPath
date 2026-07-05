"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface MorningBriefingSettings {
  morningBriefingEnabled: boolean;
  morningBriefingTime: string;
  morningBriefingChannel: string;
  timezone: string;
}

export function useMorningBriefingSettings() {
  return useQuery({
    queryKey: ["organization", "morning-briefing"],
    queryFn: async () => (await apiClient.get<MorningBriefingSettings>("/organization/morning-briefing")).data,
  });
}

export function useUpdateMorningBriefingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<MorningBriefingSettings>) =>
      (await apiClient.patch<MorningBriefingSettings>("/organization/morning-briefing", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization", "morning-briefing"] }),
  });
}
