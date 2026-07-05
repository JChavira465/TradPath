import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "tradpath.refreshToken";

// Mirrors the persisted value in memory so the axios interceptor (which
// must be synchronous) can read it without awaiting SecureStore on every
// request. SecureStore remains the source of truth across app restarts.
let cachedRefreshToken: string | null = null;

export async function loadRefreshToken(): Promise<string | null> {
  cachedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return cachedRefreshToken;
}

export function getCachedRefreshToken(): string | null {
  return cachedRefreshToken;
}

export async function setRefreshToken(token: string | null): Promise<void> {
  cachedRefreshToken = token;
  if (token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}
