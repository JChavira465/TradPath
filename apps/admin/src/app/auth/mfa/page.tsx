"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export default function AdminMfaPage() {
  const router = useRouter();
  const mfaChallengeToken = useAdminAuthStore((s) => s.mfaChallengeToken);
  const setAuth = useAdminAuthStore((s) => s.setAuth);
  const setMfaChallengeToken = useAdminAuthStore((s) => s.setMfaChallengeToken);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mfaChallengeToken) router.replace("/auth/login");
  }, [mfaChallengeToken, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallengeToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post("/admin/auth/mfa/verify", { mfaChallengeToken, code });
      setAuth(res.data.accessToken);
      setMfaChallengeToken(null);
      router.push("/dashboard");
    } catch {
      setError("Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 p-8">
        <h1 className="mb-1 text-2xl font-semibold text-purple">Two-factor verification</h1>
        <p className="mb-6 text-sm text-white/60">Required for all super admin accounts</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-center text-lg tracking-widest text-white"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full rounded-md bg-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple/90 disabled:opacity-50"
          >
            {submitting ? "Verifying…" : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
}
