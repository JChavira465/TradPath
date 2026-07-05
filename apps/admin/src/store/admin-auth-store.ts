import { create } from "zustand";

interface AdminAuthState {
  accessToken: string | null;
  isHydrated: boolean;
  mfaChallengeToken: string | null;
  setAuth: (accessToken: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
  setMfaChallengeToken: (token: string | null) => void;
  clear: () => void;
}

// S2 — in-memory only, same rule as the owner dashboard app.
export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  accessToken: null,
  isHydrated: false,
  mfaChallengeToken: null,
  setAuth: (accessToken) => set({ accessToken }),
  setHydrated: (hydrated) => set({ isHydrated: hydrated }),
  setMfaChallengeToken: (token) => set({ mfaChallengeToken: token }),
  clear: () => set({ accessToken: null, mfaChallengeToken: null }),
}));
