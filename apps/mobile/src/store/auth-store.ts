import { create } from "zustand";
import type { AuthUser } from "@tradpath/types";

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  setAccessToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setHydrated: (hydrated: boolean) => void;
  clear: () => void;
}

// S2 — access token in memory only, same as web. The refresh token is the
// one thing that's persisted, and only in expo-secure-store (never
// AsyncStorage) — see lib/secure-token-storage.ts.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isHydrated: false,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  setHydrated: (hydrated) => set({ isHydrated: hydrated }),
  clear: () => set({ accessToken: null, user: null }),
}));
