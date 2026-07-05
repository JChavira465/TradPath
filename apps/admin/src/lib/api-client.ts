import { createApiClient } from "@tradpath/api-client";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export const apiClient = createApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : "http://localhost:3001/api",
  refreshPath: "/admin/auth/refresh",
  getAccessToken: () => useAdminAuthStore.getState().accessToken,
  setAccessToken: (token) => useAdminAuthStore.getState().setAuth(token),
  onAuthFailure: () => {
    useAdminAuthStore.getState().clear();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
      window.location.href = "/auth/login";
    }
  },
});
