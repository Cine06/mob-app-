import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../utils/supabaseClient";
import bcrypt from "react-native-bcrypt";
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from "../styles/cpass";

const ChangePasswordScreen = () => {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async () => {
    try {
      setIsLoading(true);
      if (!currentPassword || !newPassword || !confirmPassword) {
        Alert.alert("Error", "Please fill in all fields.");
        setIsLoading(false);
        return;
      }

      const user = JSON.parse(await AsyncStorage.getItem("user"));

      if (!user) {
        Alert.alert("Error", "No user data found. Please log in again.");
        setIsLoading(false);
        return;
      }

      const { data: currentUser, error: fetchError } = await supabase
        .from("users")
        .select("password")
        .eq("id", user.id)
        .single();

      if (fetchError || !currentUser) {
        Alert.alert("Error", "Could not fetch your user data. Please try again.");
        setIsLoading(false);
        return;
      }

      const passwordMatch = bcrypt.compareSync(currentPassword, currentUser.password);
      
      if (!passwordMatch) {
        Alert.alert("Error", "The current password you entered is incorrect.");
        setIsLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert("Error", "New passwords do not match.");
        setIsLoading(false);
        return;
      }

      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{7,}$/;
      if (!passwordRegex.test(newPassword)) {
        Alert.alert("Invalid Password", "Password must be at least 7 characters long and contain both letters and numbers.");
        setIsLoading(false);
        return;
      }

      const hashedNewPassword = bcrypt.hashSync(newPassword, 10);

      const { error: updateError } = await supabase
        .from("users")
        .update({ password: hashedNewPassword })
        .eq("id", user.id);

      if (updateError) {
        Alert.alert("Error", "There was an error updating your password.");
        setIsLoading(false);
        return;
      }

      Alert.alert("Success", "Password changed successfully!");
      router.push("/profile");
    } catch (err) {
      console.error("Error changing password:", err);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Change Password</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Current Password</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            secureTextEntry={!showCurrentPassword}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <TouchableOpacity onPress={() => setShowCurrentPassword(prev => !prev)} style={styles.eyeIcon}>
            <Ionicons name={showCurrentPassword ? "eye-off" : "eye"} size={24} color="gray" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            secureTextEntry={!showNewPassword}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity onPress={() => setShowNewPassword(prev => !prev)} style={styles.eyeIcon}>
            <Ionicons name={showNewPassword ? "eye-off" : "eye"} size={24} color="gray" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirm New Password</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(prev => !prev)} style={styles.eyeIcon}>
            <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={24} color="gray" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleChangePassword}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Updating..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChangePasswordScreen;
