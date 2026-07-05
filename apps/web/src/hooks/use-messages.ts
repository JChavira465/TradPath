"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobTextMessage, MessageTemplate, ProvisionNumberResult } from "@tradpath/types";
import { apiClient } from "@/lib/api-client";

export function useMessages(customerId?: string) {
  return useQuery({
    queryKey: ["messages", customerId],
    queryFn: async () => (await apiClient.get<JobTextMessage[]>("/messages", { params: { customerId } })).data,
    enabled: !!customerId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { customerId: string; jobId?: string; body: string }) =>
      (await apiClient.post<JobTextMessage>("/messages", data)).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", variables.customerId] });
    },
  });
}

export function useProvisionNumber() {
  return useMutation({
    mutationFn: async () => (await apiClient.post<ProvisionNumberResult>("/messages/provision-number")).data,
  });
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => (await apiClient.get<MessageTemplate[]>("/messages/templates")).data,
  });
}

export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; body: string }) =>
      (await apiClient.post<MessageTemplate>("/messages/templates", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}

export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/messages/templates/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}
