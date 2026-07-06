"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

interface ImpersonationClaim {
  adminUserId: string;
  readOnly: boolean;
}

// Decodes the access token's payload purely for display purposes (whether
// to show the banner, and its read-only state) — this is NOT a security
// check. The server independently enforces read-only via JwtAuthGuard on
// every request regardless of what the client renders.
function decodeImpersonation(token: string | null): ImpersonationClaim | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.impersonation ?? null;
  } catch {
    return null;
  }
}

export function ImpersonationBanner() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clear = useAuthStore((s) => s.clear);
  const impersonation = useMemo(() => decodeImpersonation(accessToken), [accessToken]);

  if (!impersonation) return null;

  const stopImpersonating = async () => {
    await apiClient.post("/admin/impersonate/stop").catch(() => {});
    clear();
    router.push("/auth/login");
  };

  return (
    <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        You're viewing this account as a super admin{impersonation.readOnly ? " — read-only" : ""}.
      </span>
      <button
        onClick={stopImpersonating}
        className="rounded-md bg-amber-950/10 px-3 py-1 font-semibold hover:bg-amber-950/20"
      >
        Stop impersonating
      </button>
    </div>
  );
}
