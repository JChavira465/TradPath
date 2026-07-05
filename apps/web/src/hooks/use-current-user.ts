"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await apiClient.get("/auth/me")).data,
    enabled: isHydrated && !!accessToken,
    retry: false,
    staleTime: 60_000,
  });
}
