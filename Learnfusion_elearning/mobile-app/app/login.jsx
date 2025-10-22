import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { supabase } from "../utils/supabaseClient";
import Icon from "react-native-vector-icons/Feather";
import bcrypt from "react-native-bcrypt";
import { getRandomValues } from "react-native-get-random-values";
import * as SecureStore from "expo-secure-store"; 
import styles from "../styles/login";

bcrypt.setRandomFallback(getRandomValues);

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {      
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !user) {
        throw new Error("Invalid email or password.");
      }

      if (user.status === "Inactive") {
        throw new Error("Your account has been deactivated. Please contact the administrator.");
      }

      const passwordMatch = bcrypt.compareSync(password, user.password);

      if (!passwordMatch) {
        throw new Error("Invalid email or password.");
      }

      if (user.role !== "Student") {
        throw new Error("Only students can access the mobile app.");
      }

      await SecureStore.setItemAsync("user", JSON.stringify(user));

      router.push("/dashboard");
    } catch (err) {
      Alert.alert("Login Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Stack.Screen
        options={{ headerShown: false }}
      />
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Image source={require("../assets/logo.png")} style={styles.logo} />
          <Text style={styles.tagline}>Elevate Your Skills with LearnFusion</Text>
          <Text style={styles.loginTitle}>LOGIN</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry={!isPasswordVisible}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
              <Icon
                name={isPasswordVisible ? "eye-off" : "eye"}
                size={24}
                color="#666"
                style={{ marginRight: 15 }}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>LOGIN</Text>
            )}
          </TouchableOpacity>
          
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </>
  );
}
