"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OnboardingChecklist } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useOnboardingChecklist() {
  return useQuery({
    queryKey: ["onboarding", "checklist"],
    queryFn: async () => (await apiClient.get<OnboardingChecklist>("/onboarding/checklist")).data,
  });
}

export function useDismissOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post("/onboarding/dismiss")).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding", "checklist"] }),
  });
}
