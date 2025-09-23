import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const user = await AsyncStorage.getItem("user");
      if (user) {
        router.replace("/dashboard");
      } else {
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
