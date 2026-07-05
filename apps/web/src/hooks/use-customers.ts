"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Customer, CustomerEquipment, Job } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ["customers", search],
    queryFn: async () => (await apiClient.get<Customer[]>("/customers", { params: { search } })).data,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: async () => (await apiClient.get<Customer>(`/customers/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await apiClient.post<Customer>("/customers", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      (await apiClient.patch<Customer>(`/customers/${id}`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/customers/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useCustomerJobs(id: string) {
  return useQuery({
    queryKey: ["customers", id, "jobs"],
    queryFn: async () => (await apiClient.get<Job[]>(`/customers/${id}/jobs`)).data,
    enabled: !!id,
  });
}

export function useCustomerInvoices(id: string) {
  return useQuery({
    queryKey: ["customers", id, "invoices"],
    queryFn: async () => (await apiClient.get<any[]>(`/customers/${id}/invoices`)).data,
    enabled: !!id,
  });
}

export function useCustomerEstimates(id: string) {
  return useQuery({
    queryKey: ["customers", id, "estimates"],
    queryFn: async () => (await apiClient.get<any[]>(`/customers/${id}/estimates`)).data,
    enabled: !!id,
  });
}

export function useCustomerServicePlans(id: string) {
  return useQuery({
    queryKey: ["customers", id, "service-plans"],
    queryFn: async () => (await apiClient.get<any[]>(`/customers/${id}/service-plans`)).data,
    enabled: !!id,
  });
}

export function useCustomerEquipment(id: string) {
  return useQuery({
    queryKey: ["customers", id, "equipment"],
    queryFn: async () => (await apiClient.get<CustomerEquipment[]>(`/customers/${id}/equipment`)).data,
    enabled: !!id,
  });
}

export function useAddEquipment(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      (await apiClient.post<CustomerEquipment>(`/customers/${customerId}/equipment`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers", customerId, "equipment"] }),
  });
}

export function useDeleteEquipment(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (equipmentId: string) =>
      (await apiClient.delete(`/customers/${customerId}/equipment/${equipmentId}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers", customerId, "equipment"] }),
  });
}
