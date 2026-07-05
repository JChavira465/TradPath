"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export default function AdminLoginPage() {
  const router = useRouter();
  const setMfaChallengeToken = useAdminAuthStore((s) => s.setMfaChallengeToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post("/admin/auth/login", { email, password });
      setMfaChallengeToken(res.data.mfaChallengeToken);
      router.push("/auth/mfa");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 p-8">
        <h1 className="mb-1 text-2xl font-semibold text-purple">TradPath Admin</h1>
        <p className="mb-6 text-sm text-white/60">Super admin sign-in (MFA required)</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple/90 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
