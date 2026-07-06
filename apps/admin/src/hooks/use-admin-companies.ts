"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface CompanyListItem {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  healthScore: number | null;
  isSuspended: boolean;
  isArchived: boolean;
  deletedAt: string | null;
  createdAt: string;
  _count: { users: number; jobs: number; invoices: number };
}

export interface CompanyDetail extends CompanyListItem {
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  internalNotes: string | null;
  internalTags: string[];
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  storageUsedBytes: number;
  aiCreditsUsed: number;
  users: { id: string; firstName: string; lastName: string; email: string; role: string; isSuspended: boolean; lastLoginAt: string | null }[];
}

export function useAdminCompanies(search: string) {
  return useQuery({
    queryKey: ["admin", "companies", search],
    queryFn: async () =>
      (await apiClient.get<{ companies: CompanyListItem[]; total: number }>("/admin/companies", { params: { search: search || undefined, pageSize: 50 } })).data,
  });
}

export function useAdminCompanyDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin", "companies", "detail", id],
    queryFn: async () => (await apiClient.get<CompanyDetail>(`/admin/companies/${id}`)).data,
    enabled: !!id,
  });
}

function useInvalidateCompanies() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin", "companies"] });
}

export function useSuspendCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/admin/companies/${id}/suspend`)).data,
    onSuccess: invalidate,
  });
}

export function useReactivateCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/admin/companies/${id}/reactivate`)).data,
    onSuccess: invalidate,
  });
}

export function useArchiveCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, confirmSlug }: { id: string; confirmSlug: string }) =>
      (await apiClient.post(`/admin/companies/${id}/archive`, { confirmSlug })).data,
    onSuccess: invalidate,
  });
}

export function useDeleteCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, confirmSlug }: { id: string; confirmSlug: string }) =>
      (await apiClient.delete(`/admin/companies/${id}`, { data: { confirmSlug } })).data,
    onSuccess: invalidate,
  });
}

export function useResetTrial() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) =>
      (await apiClient.patch(`/admin/companies/${id}/reset-trial`, { days })).data,
    onSuccess: invalidate,
  });
}

export function useTransferOwnership() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, newOwnerUserId }: { id: string; newOwnerUserId: string }) =>
      (await apiClient.post(`/admin/companies/${id}/transfer-ownership`, { newOwnerUserId })).data,
    onSuccess: invalidate,
  });
}

export function useImpersonate() {
  return useMutation({
    mutationFn: async ({ userId, readOnly }: { userId: string; readOnly: boolean }) =>
      (await apiClient.post<{ accessToken: string; expiresIn: number; readOnly: boolean }>("/admin/impersonate", { userId, readOnly })).data,
  });
}

export function downloadCompaniesCsv(search: string) {
  apiClient
    .get("/admin/companies/export.csv", { params: { search: search || undefined }, responseType: "blob" })
    .then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "companies.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    });
}
