"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(8, "At least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    if (!token) {
      setError("This invite link is missing its token.");
      return;
    }
    try {
      const res = await apiClient.post("/auth/accept-invite", { token, ...values });
      setAuth(res.data.accessToken, res.data.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "This invite link is invalid or has expired.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-navy">Join your team</h1>
        <p className="mb-6 text-sm text-gray-500">Set up your account to accept the invite.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="First name" {...register("firstName")} />
            <Input placeholder="Last name" {...register("lastName")} />
          </div>
          {(errors.firstName || errors.lastName) && (
            <p className="text-xs text-red-600">{errors.firstName?.message ?? errors.lastName?.message}</p>
          )}

          <Input type="password" placeholder="Choose a password" {...register("password")} />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Joining…" : "Join team"}
          </Button>
        </form>
      </div>
    </div>
  );
}
