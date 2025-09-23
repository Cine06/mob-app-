import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import styles from "../styles/bottomnav";

export default function BottomNav() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.icon} onPress={() => router.push("/dashboard")}>
        <FontAwesome5 name="home" size={24} color="white" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => router.push("/lessons")}>
        <FontAwesome5 name="book" size={24} color="white" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => router.push("/codesnippets")}>
        <FontAwesome5 name="code" size={24} color="white" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => router.push("/notifications")}>
        <FontAwesome5 name="bell" size={24} color="white" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => router.push("/messages")}>
        <FontAwesome5 name="envelope" size={24} color="white" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => router.push("/profile")}>
        <FontAwesome5 name="user" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

