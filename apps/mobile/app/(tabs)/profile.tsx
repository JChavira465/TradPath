import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth-store";
import { apiClient } from "@/lib/api-client";
import { getCachedRefreshToken, setRefreshToken } from "@/lib/secure-token-storage";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const onSignOut = async () => {
    await apiClient.post("/auth/logout", { refreshToken: getCachedRefreshToken() }).catch(() => {});
    await setRefreshToken(null);
    clear();
    router.replace("/auth/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{user ? `${user.firstName} ${user.email}` : "Profile"}</Text>
      <Text style={styles.subtitle}>Biometric unlock, notifications — built in Sprint 12.</Text>
      <Pressable style={styles.button} onPress={onSignOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "white" },
  title: { fontSize: 22, fontWeight: "700", color: "#1B2A4A" },
  subtitle: { marginTop: 8, fontSize: 14, color: "#6B7280" },
  button: { marginTop: 24, backgroundColor: "#DC2626", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "600" },
});
