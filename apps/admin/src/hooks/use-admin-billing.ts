"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface SubscriptionRow {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface PlanMrrBreakdown {
  byPlan: { plan: string; orgCount: number; mrr: number }[];
  totalMrr: number;
  totalArr: number;
}

export interface TrialRow {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  trialEndsAt: string;
}

export interface FailedPaymentRow {
  id: string;
  organizationId: string | null;
  stripeInvoiceId: string | null;
  stripeCustomerId: string | null;
  customerEmail: string | null;
  amount: number;
  reason: string | null;
  failedAt: string;
  organization: { id: string; name: string; slug: string } | null;
}

export interface CouponRow {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOff: number | null;
  durationInMonths: number | null;
  valid: boolean;
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["admin", "billing", "subscriptions"],
    queryFn: async () => (await apiClient.get<{ organizations: SubscriptionRow[]; total: number }>("/admin/billing/subscriptions", { params: { pageSize: 50 } })).data,
  });
}

export function usePlanMrr() {
  return useQuery({
    queryKey: ["admin", "billing", "plan-mrr"],
    queryFn: async () => (await apiClient.get<PlanMrrBreakdown>("/admin/billing/plan-mrr")).data,
  });
}

export function useTrials() {
  return useQuery({
    queryKey: ["admin", "billing", "trials"],
    queryFn: async () => (await apiClient.get<TrialRow[]>("/admin/billing/trials", { params: { days: 14 } })).data,
  });
}

export function useFailedPayments() {
  return useQuery({
    queryKey: ["admin", "billing", "failed-payments"],
    queryFn: async () => (await apiClient.get<{ payments: FailedPaymentRow[]; total: number }>("/admin/billing/failed-payments", { params: { pageSize: 50 } })).data,
  });
}

export function useCoupons() {
  return useQuery({
    queryKey: ["admin", "billing", "coupons"],
    queryFn: async () => (await apiClient.get<CouponRow[]>("/admin/billing/coupons")).data,
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; type: "percent" | "amount"; value: number; durationInMonths?: number }) =>
      (await apiClient.post("/admin/billing/coupons", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "billing", "coupons"] }),
  });
}

export function useCreateRefund() {
  return useMutation({
    mutationFn: async (input: { stripePaymentIntentId: string; amount?: number; reason?: string }) =>
      (await apiClient.post("/admin/billing/refunds", input)).data,
  });
}
