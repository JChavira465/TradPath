import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "@/store/auth-store";

export default function TabsLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#2563EB" }}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs" }} />
      <Tabs.Screen name="clock" options={{ title: "Clock" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
