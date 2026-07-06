"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrganizationProfile } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useOrganizationProfile() {
  return useQuery({
    queryKey: ["organization", "profile"],
    queryFn: async () => (await apiClient.get<OrganizationProfile>("/organization/profile")).data,
  });
}

export interface UpdateOrganizationProfileInput {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  logo?: string;
  defaultTaxRate?: number;
  defaultInvoiceTerms?: string;
  defaultInvoiceDueDays?: number;
}

export function useUpdateOrganizationProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateOrganizationProfileInput) =>
      (await apiClient.patch<OrganizationProfile>("/organization/profile", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization", "profile"] }),
  });
}

export function useCreateBillingPortalSession() {
  return useMutation({
    mutationFn: async () => (await apiClient.post<{ url: string | null }>("/organization/billing-portal")).data,
  });
}

export async function downloadAccountingCsv() {
  const response = await apiClient.get("/invoices/export/accounting-csv", { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "invoices.csv";
  link.click();
  URL.revokeObjectURL(url);
}
