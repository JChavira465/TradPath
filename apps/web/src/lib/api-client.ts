import { createApiClient } from "@tradpath/api-client";
import { useAuthStore } from "@/store/auth-store";

export const apiClient = createApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : "http://localhost:3001/api",
  getAccessToken: () => useAuthStore.getState().accessToken,
  setAccessToken: (token) => useAuthStore.getState().setAuth(token),
  onAuthFailure: () => {
    useAuthStore.getState().clear();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
      window.location.href = "/auth/login";
    }
  },
});
