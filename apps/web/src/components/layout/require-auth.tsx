"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

/**
 * Client-side route guard. There is no Next.js edge `middleware.ts` here
 * on purpose: the refresh cookie is set by the NestJS API's origin, not
 * this app's origin, so edge middleware in this app cannot read or verify
 * it. The real session lives in memory (S2) and is established by the
 * silent-refresh call in Providers on mount — this guard just waits for
 * that to resolve before deciding whether to redirect.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (isHydrated && !accessToken) {
      router.replace("/auth/login");
    }
  }, [isHydrated, accessToken, router]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!accessToken) {
    return null;
  }

  return <>{children}</>;
}
