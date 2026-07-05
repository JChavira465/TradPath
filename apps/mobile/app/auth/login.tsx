import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth-store";
import { apiClient } from "@/lib/api-client";
import { setRefreshToken } from "@/lib/secure-token-storage";

export default function LoginScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (accessToken) {
    return <Redirect href="/(tabs)" />;
  }

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post("/auth/login", { email, password });
      if (res.data.mfaRequired) {
        setError("MFA is not yet supported in the mobile app preview.");
        return;
      }
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      if (res.data.refreshToken) {
        await setRefreshToken(res.data.refreshToken);
      }
      router.replace("/(tabs)");
    } catch {
      setError("Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TradPath</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "white" },
  title: { fontSize: 28, fontWeight: "700", color: "#1B2A4A" },
  subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  error: { color: "#DC2626", marginBottom: 12, fontSize: 13 },
  button: { backgroundColor: "#2563EB", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "600" },
});
