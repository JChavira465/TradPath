import { View, Text, StyleSheet } from "react-native";
import { useAuthStore } from "@/store/auth-store";

export default function TodayScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {user ? `Good morning, ${user.firstName}` : "Good morning"}
      </Text>
      <Text style={styles.subtitle}>Today's jobs and quick clock-in — built in Sprint 12.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "white" },
  greeting: { fontSize: 22, fontWeight: "700", color: "#1B2A4A" },
  subtitle: { marginTop: 8, fontSize: 14, color: "#6B7280" },
});
