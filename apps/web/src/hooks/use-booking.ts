"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingAvailability, BookingBlackout, BookingRequest, BookingSettings, ServiceOffering, ServicePlan } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useBookingRequests(status?: string) {
  return useQuery({
    queryKey: ["booking", "requests", status],
    queryFn: async () => (await apiClient.get<BookingRequest[]>("/booking/requests", { params: { status } })).data,
  });
}

export function useConfirmBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/booking/requests/${id}/confirm`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "requests"] }),
  });
}

export function useDeclineBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/booking/requests/${id}/decline`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "requests"] }),
  });
}

export function useRescheduleBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, requestedDate, requestedTimeSlot }: { id: string; requestedDate: string; requestedTimeSlot?: string }) =>
      (await apiClient.post(`/booking/requests/${id}/reschedule`, { requestedDate, requestedTimeSlot })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "requests"] }),
  });
}

export function useBookingSettings() {
  return useQuery({
    queryKey: ["booking", "settings"],
    queryFn: async () => (await apiClient.get<BookingSettings>("/booking/settings")).data,
  });
}

export function useUpdateBookingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<BookingSettings>) => (await apiClient.patch<BookingSettings>("/booking/settings", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "settings"] }),
  });
}

export function useBookingAvailability() {
  return useQuery({
    queryKey: ["booking", "availability"],
    queryFn: async () => (await apiClient.get<BookingAvailability[]>("/booking/availability")).data,
  });
}

export function useAddAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dayOfWeek: number; startTime: string; endTime: string }) =>
      (await apiClient.post("/booking/availability", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "availability"] }),
  });
}

export function useRemoveAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/booking/availability/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "availability"] }),
  });
}

export function useBookingBlackouts() {
  return useQuery({
    queryKey: ["booking", "blackouts"],
    queryFn: async () => (await apiClient.get<BookingBlackout[]>("/booking/blackouts")).data,
  });
}

export function useAddBlackout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { date: string; reason?: string }) => (await apiClient.post("/booking/blackouts", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "blackouts"] }),
  });
}

export function useRemoveBlackout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/booking/blackouts/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "blackouts"] }),
  });
}

export function useBookableServices() {
  return useQuery({
    queryKey: ["booking", "services"],
    queryFn: async () => (await apiClient.get<ServiceOffering[]>("/booking/services")).data,
  });
}

export function useSetServiceBookable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isBookable }: { id: string; isBookable: boolean }) =>
      (await apiClient.patch(`/booking/services/${id}/bookable`, { isBookable })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "services"] }),
  });
}

export function usePlanTemplates() {
  return useQuery({
    queryKey: ["booking", "plan-templates"],
    queryFn: async () => (await apiClient.get<ServicePlan[]>("/booking/plan-templates")).data,
  });
}

export function useSetPlanPublic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      (await apiClient.patch(`/booking/plan-templates/${id}/public`, { isPublic })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking", "plan-templates"] }),
  });
}
