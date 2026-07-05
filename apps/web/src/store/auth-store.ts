import { create } from "zustand";
import type { AuthUser } from "@tradpath/types";

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  /** True once the initial silent-refresh attempt (on app mount) has resolved. */
  isHydrated: boolean;
  /** Short-lived (5 min) challenge token between /auth/login and /auth/mfa. */
  mfaChallengeToken: string | null;
  setAuth: (accessToken: string | null, user?: AuthUser | null) => void;
  setHydrated: (hydrated: boolean) => void;
  setMfaChallengeToken: (token: string | null) => void;
  clear: () => void;
}

// S2 — access token lives in memory ONLY (this store), never persisted to
// localStorage/sessionStorage. Do not add `persist` middleware here.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isHydrated: false,
  mfaChallengeToken: null,
  setAuth: (accessToken, user) =>
    set((state) => ({ accessToken, user: user !== undefined ? user : state.user })),
  setHydrated: (hydrated) => set({ isHydrated: hydrated }),
  setMfaChallengeToken: (token) => set({ mfaChallengeToken: token }),
  clear: () => set({ accessToken: null, user: null, mfaChallengeToken: null }),
}));
