"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface AdminUserListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isSuspended: boolean;
  isSuperAdmin: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
}

export interface SessionRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  platform: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string | null;
}

export function useAdminUsersList(search: string) {
  return useQuery({
    queryKey: ["admin", "users", search],
    queryFn: async () =>
      (await apiClient.get<{ users: AdminUserListItem[]; total: number }>("/admin/users", { params: { search: search || undefined, pageSize: 50 } })).data,
  });
}

export function useAdminUserLoginHistory(id: string | null) {
  return useQuery({
    queryKey: ["admin", "users", "login-history", id],
    queryFn: async () => (await apiClient.get<SessionRow[]>(`/admin/users/${id}/login-history`)).data,
    enabled: !!id,
  });
}

export function useAdminUserSessions(id: string | null) {
  return useQuery({
    queryKey: ["admin", "users", "sessions", id],
    queryFn: async () => (await apiClient.get<SessionRow[]>(`/admin/users/${id}/sessions`)).data,
    enabled: !!id,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
}

export function useForceResetPassword() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/admin/users/${id}/force-reset`)).data,
    onSuccess: invalidate,
  });
}

export function useUnlockUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/admin/users/${id}/unlock`)).data,
    onSuccess: invalidate,
  });
}

export function useDisableUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/admin/users/${id}/disable`)).data,
    onSuccess: invalidate,
  });
}

export function useEnableUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/admin/users/${id}/enable`)).data,
    onSuccess: invalidate,
  });
}

export function useRevokeUserSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/admin/users/${id}/revoke-sessions`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users", "sessions"] }),
  });
}
