"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MfaPage() {
  const router = useRouter();
  const mfaChallengeToken = useAuthStore((s) => s.mfaChallengeToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setMfaChallengeToken = useAuthStore((s) => s.setMfaChallengeToken);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mfaChallengeToken) {
      router.replace("/auth/login");
    }
  }, [mfaChallengeToken, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallengeToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post("/auth/mfa/verify", { mfaChallengeToken, code });
      setAuth(res.data.accessToken, res.data.user);
      setMfaChallengeToken(null);
      router.push("/dashboard");
    } catch {
      setError("Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-navy">Two-factor verification</h1>
        <p className="mb-6 text-sm text-gray-500">Enter the 6-digit code from your authenticator app</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
            {submitting ? "Verifying…" : "Verify"}
          </Button>
        </form>
      </div>
    </div>
  );
}
