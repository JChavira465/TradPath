"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const setAuth = useAdminAuthStore((s) => s.setAuth);
  const setHydrated = useAdminAuthStore((s) => s.setHydrated);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .post("/admin/auth/refresh")
      .then((res) => {
        if (!cancelled) setAuth(res.data.accessToken);
      })
      .catch(() => {
        if (!cancelled) setAuth(null);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
