"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isHydrated = useAdminAuthStore((s) => s.isHydrated);
  const accessToken = useAdminAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (isHydrated && !accessToken) router.replace("/auth/login");
  }, [isHydrated, accessToken, router]);

  if (!isHydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-white/60">Loading…</div>;
  }
  if (!accessToken) return null;
  return <>{children}</>;
}
