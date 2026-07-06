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

    // Impersonation handoff (Sprint 9): the super admin portal opens this
    // app in a new tab with a one-shot access token in the URL. Read it
    // via window.location (not useSearchParams()) so this root-level
    // Providers component — rendered on every route, including public
    // pages — never needs a Suspense boundary. The token itself has no
    // refresh cookie by design (S11: hard 1-hour expiry, no renewal), so
    // the normal silent-refresh call is skipped entirely for this session.
    const params = new URLSearchParams(window.location.search);
    const impersonateToken = params.get("impersonate_token");
    if (impersonateToken) {
      setAuth(impersonateToken);
      setHydrated(true);
      params.delete("impersonate_token");
      const rest = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
      return;
    }

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
