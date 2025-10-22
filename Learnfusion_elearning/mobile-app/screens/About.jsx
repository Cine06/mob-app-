// File: app/about.jsx
import { useState } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import * as SecureStore from "expo-secure-store";
import styles from "../styles/about";

export default function About() {
  const router = useRouter();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const navigateTo = (route) => {
    router.push(route);
    setDropdownVisible(false);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "OK",
        onPress: async () => {
          // Securely log out by deleting user data and replacing the route
          await SecureStore.deleteItemAsync("user");
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/dashboard")}>
          <Image source={require("../assets/logo.png")} style={styles.logo} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setDropdownVisible(!dropdownVisible)}
        >
          <FontAwesome5 name="bars" size={24} color="#046a38" />
        </TouchableOpacity>

        {dropdownVisible && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/profile")}>
              <FontAwesome5 name="user" size={18} color="#046a38" />
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/about")}>
              <FontAwesome5 name="info-circle" size={18} color="#046a38" />
              <Text style={styles.menuText}>About Us</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <FontAwesome5 name="sign-out-alt" size={18} color="red" />
              <Text style={[styles.menuText, { color: "red" }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header1}>
          <Image source={require("../assets/oldlogo.png")} style={styles.logo1} />
        </View>

        <Text style={styles.aboutTitle}>
          About <Text style={styles.highlight}>Interface</Text>
        </Text>

        <View style={styles.container}>
          <Text style={styles.sectionTitle}>A BRIEF HISTORY</Text>
          <Text style={styles.text}>
            Interface Computer College, then known as Interface Computer Learning Center, was established in 1982 at the 2nd floor of Cartimar building along Claro M. Recto Avenue in Quiapo, Manila.
            {"\n\n"}
            It became a college in 1994 when IT-related programs were added to its already existing wide-range portfolio of short-term courses. All the programs offered are recognized by CHED, TESDA, OWWA, CSC, and DOST.
            {"\n\n"}
            ICC has expanded to branches in Caloocan, Cebu, Davao, Iloilo, and Cabanatuan, making it one of the largest private non-sectarian institutions in the Philippines.
            {"\n\n"}
            ICC also offers virtual classrooms through e-learning where students can download course topics, submit assignments, and take exams online.
          </Text>

          <Text style={styles.sectionTitle}>MISSION</Text>
          <Text style={styles.text}>
            To produce graduates equipped with competence, excellence, and character necessary to achieve a transformative impact on society.
          </Text>

          <Text style={styles.sectionTitle}>VISION</Text>
          <Text style={styles.text}>
            We are the premier learning institution providing holistic and innovative education that empowers our students to be globally competitive and responsible members of society.
          </Text>

          <Text style={styles.sectionTitle}>CORE VALUES</Text>
          <Text style={styles.text}>
            <Text style={styles.highlight1}>
              Employees and students are expected to uphold the organization’s core values at all times:
            </Text>
            {"\n"}• Live with integrity and discipline
            {"\n"}• Relentlessly pursue excellence
            {"\n"}• Respect each person’s uniqueness
            {"\n"}• Serve the institution and community with loyalty
          </Text>

          <Text style={styles.sectionTitle}>GOALS</Text>
          <Text style={styles.text}>
            The institution aims to produce scientifically and technologically oriented human capital equipped with appropriate knowledge, skills, and attitudes, while strengthening research and partnerships.
          </Text>

          <Text style={styles.sectionTitle}>Branches</Text>
          <View style={styles.branchContainer}>
            {["MANILA", "ILOILO", "DAVAO", "CALOOCAN"].map((branch) => (
              <TouchableOpacity key={branch} onPress={() => console.log(`Clicked on ${branch}`)}>
                <Text style={styles.branchText}>{branch}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomNav />
    </>
  );
}
