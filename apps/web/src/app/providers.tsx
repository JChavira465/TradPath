"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const setAuth = useAuthStore((s) => s.setAuth);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    let cancelled = false;

    // Silent refresh on mount: the httpOnly refresh cookie (if present)
    // exchanges for a fresh in-memory access token. This is the ONLY way
    // the client regains a session after a page reload (S2).
    apiClient
      .post("/auth/refresh")
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
