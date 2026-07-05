import { createApiClient } from "@tradpath/api-client";
import { useAuthStore } from "@/store/auth-store";
import { getCachedRefreshToken, setRefreshToken } from "@/lib/secure-token-storage";

export const apiClient = createApiClient({
  baseURL: `${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001"}/api`,
  defaultHeaders: { "x-client-platform": "mobile" },
  getAccessToken: () => useAuthStore.getState().accessToken,
  setAccessToken: (token) => useAuthStore.getState().setAccessToken(token),
  getRefreshRequestBody: () => ({ refreshToken: getCachedRefreshToken() ?? undefined }),
  onRefreshSuccess: (data) => {
    if (data?.refreshToken) {
      setRefreshToken(data.refreshToken).catch(() => {});
    }
  },
  onAuthFailure: () => {
    useAuthStore.getState().clear();
    setRefreshToken(null).catch(() => {});
  },
});
