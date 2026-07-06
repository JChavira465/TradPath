"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface FeatureFlagRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  defaultEnabled: boolean;
  enabledForPlans: string[];
}

export interface OrgOverrideRow {
  id: string;
  organizationId: string;
  flagKey: string;
  enabled: boolean;
  overriddenBy: string | null;
  overriddenAt: string;
  organization: { id: string; name: string; slug: string };
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["admin", "feature-flags"],
    queryFn: async () => (await apiClient.get<FeatureFlagRow[]>("/admin/feature-flags")).data,
  });
}

export function useFlagOverrides(key: string | null) {
  return useQuery({
    queryKey: ["admin", "feature-flags", "overrides", key],
    queryFn: async () => (await apiClient.get<OrgOverrideRow[]>(`/admin/feature-flags/${key}/overrides`)).data,
    enabled: !!key,
  });
}

function useInvalidateFlags() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
}

export function useCreateFlag() {
  const invalidate = useInvalidateFlags();
  return useMutation({
    mutationFn: async (input: { key: string; label: string; defaultEnabled?: boolean }) =>
      (await apiClient.post("/admin/feature-flags", input)).data,
    onSuccess: invalidate,
  });
}

export function useToggleFlagDefault() {
  const invalidate = useInvalidateFlags();
  return useMutation({
    mutationFn: async ({ key, defaultEnabled }: { key: string; defaultEnabled: boolean }) =>
      (await apiClient.patch(`/admin/feature-flags/${key}`, { defaultEnabled })).data,
    onSuccess: invalidate,
  });
}

export function useDeleteFlag() {
  const invalidate = useInvalidateFlags();
  return useMutation({
    mutationFn: async (key: string) => (await apiClient.delete(`/admin/feature-flags/${key}`)).data,
    onSuccess: invalidate,
  });
}

export function useSetOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, organizationId, enabled }: { key: string; organizationId: string; enabled: boolean }) =>
      (await apiClient.post(`/admin/feature-flags/${key}/overrides`, { organizationId, enabled })).data,
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags", "overrides", variables.key] }),
  });
}

export function useRemoveOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, organizationId }: { key: string; organizationId: string }) =>
      (await apiClient.delete(`/admin/feature-flags/${key}/overrides/${organizationId}`)).data,
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags", "overrides", variables.key] }),
  });
}
