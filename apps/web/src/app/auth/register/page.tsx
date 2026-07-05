"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const schema = z.object({
  organizationName: z.string().min(1, "Company name is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email(),
  password: z.string().min(10, "At least 10 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const res = await apiClient.post("/auth/register", values);
      setAuth(res.data.accessToken, res.data.user);
      router.push("/dashboard");
    } catch {
      setError("Unable to complete registration");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-navy">Start your free trial</h1>
        <p className="mb-6 text-sm text-gray-500">14 days free, no card required</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input placeholder="Company name" {...register("organizationName")} />
          {errors.organizationName && <p className="text-xs text-red-600">{errors.organizationName.message}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="First name" {...register("firstName")} />
            <Input placeholder="Last name" {...register("lastName")} />
          </div>

          <Input type="email" placeholder="Email" {...register("email")} />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}

          <Input type="password" placeholder="Password" {...register("password")} />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
