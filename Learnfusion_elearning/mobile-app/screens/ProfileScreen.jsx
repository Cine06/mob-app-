import { View, Text, TouchableOpacity, Image, Modal, TextInput, ScrollView, Alert } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../utils/supabaseClient";
import BottomNav from "../components/BottomNav";
import { Ionicons } from "@expo/vector-icons";
import styles from "../styles/profile";
import * as SecureStore from "expo-secure-store";

export default function ProfileScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [fname, setfName] = useState("");
  const [mname, setmName] = useState("");
  const [lname, setlName] = useState("");
  const [email, setEmail] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [section, setSection] = useState("");
  const [profilePic, setProfilePic] = useState(require("../assets/default_profile.png"));

  const fetchUserData = useCallback(async () => {
    try {
      const userJson = await SecureStore.getItemAsync("user");
      if (!userJson) {
        router.replace("/login");
        return;
      }
      
      const user = JSON.parse(userJson);
      const { data, error } = await supabase
        .from("users")
        .select(`id, school_id, first_name, middle_name, last_name, email, contact_number, 
          section_id, sections:section_id(section_name), profile_picture`)
        .eq("role", "Student")
        .eq("id", user.id) 
        .single();

      if (error) {
        console.error("Error fetching user data:", error.message);
        Alert.alert("Error", "Could not fetch your profile data.");
        return;
      }

      setfName(data.first_name);
      setmName(data.middle_name || "");
      setlName(data.last_name);
      setEmail(data.email);
      setSchoolId(data.school_id);
      setContactNumber(data.contact_number || "");
      setSection(data.sections ? data.sections.section_name : "N/A");

      if (data.profile_picture) {
        setProfilePic({ uri: data.profile_picture });
      } else {
        setProfilePic(require("../assets/default_profile.png"));
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "An unexpected error occurred while fetching your data.");
    }
  }, [router]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const updateContactNumber = async () => {
    const phoneRegex = /^(09|\+639)\d{9}$/;
    if (contactNumber && !phoneRegex.test(contactNumber)) {
      Alert.alert("Invalid Format", "Please enter a valid Philippine mobile number (e.g., 09xxxxxxxxx or +639xxxxxxxxx).");
      return;
    }

    setIsUpdating(true);
    const userJson = await SecureStore.getItemAsync("user");
    if (userJson) {
      const user = JSON.parse(userJson);

      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({ contact_number: contactNumber })
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating contact number:", error.message);
        Alert.alert("Update Failed", "Could not update your contact number. It might already be in use.");
      } else {
        Alert.alert("Success", "Contact number updated successfully.");
        await SecureStore.setItemAsync("user", JSON.stringify(updatedUser));
        setIsEditing(false);
      }
    } else {
      Alert.alert("Error", "User session not found. Please log in again.");
    }
    setIsUpdating(false);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const selectedImage = result.assets[0];
      const base64Image = await uriToBase64(selectedImage.uri);
      setProfilePic({ uri: selectedImage.uri });
      
      const userJson = await SecureStore.getItemAsync("user");
      if (userJson) {
        const user = JSON.parse(userJson);
        const { error: updateError } = await supabase
          .from("users")
          .update({ profile_picture: base64Image })
          .eq("id", user.id);

        if (updateError) {
          console.error(updateError.message);
        } else {
          // Note: Storing large base64 images in SecureStore might not be ideal.
        }
      }
    }
  };

  const uriToBase64 = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={pickImage}>
            <Image source={profilePic} style={styles.profilePic} />
          </TouchableOpacity>
          <Text style={styles.profileName}>{fname} {mname} {lname}</Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.schoolId}>{schoolId}</Text>
        </View>

        <View style={styles.menuContainer}>
          {[ 
            { title: "Information", action: () => setModalVisible(true) },
            { title: "Change Password", route: "/changepassword" },
            { title: "Logout", action: () => {
                Alert.alert("Logout", "Are you sure you want to logout?", [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  { text: "OK", onPress: async () => {
                      await SecureStore.deleteItemAsync("user");
                      router.replace("/login");
                    } 
                  },
                ]);
              } 
            },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.action || (() => router.push(item.route))}
            >
              <Text style={styles.menuText}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={20} color="black" />
            </TouchableOpacity>
          ))}
        </View>

        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Information</Text>
              
              <TouchableOpacity 
                onPress={() => {
                  if (isEditing && !isUpdating) {
                    updateContactNumber(); 
                  } else {
                    setIsEditing(!isEditing);
                  }
                }} 
                style={styles.editIcon}
                disabled={isUpdating}
              >
                <Ionicons name={isEditing ? "save" : "create"} size={24} color={isUpdating ? "#aaa" : "#046a38"} />
              </TouchableOpacity>
              
              <ScrollView style={styles.scrollContainer}>
                <Text style={styles.label}>Fullname: {fname} {mname} {lname}</Text>
                <Text style={styles.label}>Email: {email}</Text>
                <Text style={styles.label}>School ID: {schoolId}</Text>
                <Text style={styles.label}>Section: {section}</Text>

                {isEditing ? ( 
                  <TextInput 
                    style={styles.input}
                    value= {contactNumber}
                    onChangeText={setContactNumber}
                    placeholder="Enter contact number"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.label}>Contact Number: {contactNumber || "Not set"}</Text>
                )}
              </ScrollView>

              <TouchableOpacity style={styles.closeButton} onPress={() => {
                setModalVisible(false);
                setIsEditing(false); // Reset editing state on close
              }}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
      <BottomNav />
    </>
  );
}