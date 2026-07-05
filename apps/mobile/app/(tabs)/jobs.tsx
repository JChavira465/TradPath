import { View, Text, StyleSheet } from "react-native";

export default function JobsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Jobs</Text>
      <Text style={styles.subtitle}>Job search, filters, and list — built in Sprint 12.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "white" },
  title: { fontSize: 22, fontWeight: "700", color: "#1B2A4A" },
  subtitle: { marginTop: 8, fontSize: 14, color: "#6B7280" },
});
