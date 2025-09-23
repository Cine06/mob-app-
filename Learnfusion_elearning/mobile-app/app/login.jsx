import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../utils/supabaseClient"; 
import Icon from "react-native-vector-icons/Feather";
import bcrypt from "react-native-bcrypt"; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from "../styles/login";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = async () => {
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

      await AsyncStorage.setItem("user", JSON.stringify(user));

      router.push("/dashboard"); 

    } catch (err) {
      Alert.alert("Login Failed", err.message);
    }
  };

  return (
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
          <Icon name={isPasswordVisible ? "eye-off" : "eye"} size={24} color="#666" style={{ marginRight: 15 }} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>LOGIN</Text>
      </TouchableOpacity>
    </View>
  );
}
