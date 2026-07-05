import { useEffect } from "react";
import { Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useAuthStore } from "@/store/auth-store";
import { apiClient } from "@/lib/api-client";
import { loadRefreshToken, setRefreshToken } from "@/lib/secure-token-storage";

export default function RootLayout() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    (async () => {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) {
        setHydrated(true);
        return;
      }
      try {
        const res = await apiClient.post("/auth/refresh", { refreshToken });
        setAccessToken(res.data.accessToken);
        if (res.data.refreshToken) {
          await setRefreshToken(res.data.refreshToken);
        }
        const me = await apiClient.get("/auth/me");
        setUser(me.data);
      } catch {
        setAccessToken(null);
        await setRefreshToken(null);
      } finally {
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isHydrated) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashText}>TradPath</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: "#1B2A4A", alignItems: "center", justifyContent: "center" },
  splashText: { color: "white", fontSize: 24, fontWeight: "600" },
});
