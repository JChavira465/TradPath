"use client";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { RequireAuth } from "@/components/layout/require-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";

function DashboardHeader() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const { data: user } = useCurrentUser();

  const onLogout = async () => {
    await apiClient.post("/auth/logout").catch(() => {});
    clear();
    router.push("/auth/login");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="text-sm text-gray-500">
        {user ? `${user.firstName} ${user.lastName}` : ""}
      </div>
      <button onClick={onLogout} className="text-sm text-gray-500 hover:text-navy">
        Sign out
      </button>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col">
          <DashboardHeader />
          <main className="flex-1 bg-gray-50 p-6">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
