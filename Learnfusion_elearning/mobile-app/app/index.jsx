import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import * as SecureStore from "expo-secure-store";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await SecureStore.getItemAsync("user");

        if (userData) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      } catch (error) {
        console.error("Error reading user data:", error);
        router.replace("/login");
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Loading...</Text>
    </View>
  );
}
