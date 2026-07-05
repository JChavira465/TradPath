"use client";

import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { RequireAuth } from "@/components/layout/require-auth";
import { apiClient } from "@/lib/api-client";
import { useAdminAuthStore } from "@/store/admin-auth-store";

function AdminHeader() {
  const router = useRouter();
  const clear = useAdminAuthStore((s) => s.clear);

  const onLogout = async () => {
    await apiClient.post("/admin/auth/logout").catch(() => {});
    clear();
    router.push("/auth/login");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/10 px-6">
      <div className="text-sm text-white/60">Super Admin</div>
      <button onClick={onLogout} className="text-sm text-white/60 hover:text-white">
        Sign out
      </button>
    </header>
  );
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <AdminHeader />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
