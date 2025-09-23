import { useState } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import styles from "../styles/about";

export default function About() {
  const router = useRouter();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/dashboard")}>
          <Image source={require("../assets/logo.png")} style={styles.logo} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={() => setDropdownVisible(!dropdownVisible)}>
          <FontAwesome5 name="bars" size={24} color="#046a38" />
        </TouchableOpacity>

        {dropdownVisible && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { router.push("/profile"); setDropdownVisible(false); }}>
              <FontAwesome5 name="user" size={18} color="#046a38" />
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { router.push("/about"); setDropdownVisible(false); }}>
              <FontAwesome5 name="info-circle" size={18} color="#046a38" />
              <Text style={styles.menuText}>About Us</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => {router.push("/login"); setDropdownVisible(false); }}>
              <FontAwesome5 name="sign-out-alt" size={18} color="red" />
              <Text style={[styles.menuText, { color: "red" }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

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
          Interface Computer College then known as Interface Computer Learning Center was established in 1982 at the 2nd floor of Cartimar building along Claro M. Recto Avenue in Quiapo Manila. It then became a college in 1994 when IT-related programs were added to its already existing wide-range portfolio of short-term courses. Proud to say that all the programs and courses offered are duly recognized and authorized by Commission on Higher Education (CHED) and Technical Skills and Development Authority (TESDA) and accredited by Overseas Workers Welfare Administration (OWWA) , Civil Service Commission (CSC), and the Department of Science and Technology (DOST).{"\n"}
        Responding to the clamor and growing demands of the public to be more accessible, ICC opened its door to reach out to more people thereby opening branches in Caloocan, Cebu, Davao, Iloilo and in Cabanatuan. Since then, ICC has grown and pioneered to become one of the largest private non-sectarian institutions in the Philippines. It boasts of its status as a non-franchised institution with the end view of sustaining its standard of quality education.{"\n"}
        Committed to improve the curricula offering, Interface Computer College has taken a big leap in offering virtual classroom through e-learning where students can interact with the instructions through internet, e.g., download course topics, submit assignments, know their standing grades, and even takes examination, all through the use of internet.{"\n"}
        Today, with thousand and more students added to the alumni every year, ICC takes pride in pursuit of academic and technical excellence in consistently participating and contributing to the technological progress locally and globally. Across the myriad socioeconomic and political landscape of the country, one thing remain constant with ICC - the vision of committing itself in enhancing the potential skills of the students through the delivery of quality, equitable, accessible and yet affordable education to all.
          </Text>

          <Text style={styles.sectionTitle}>MISSION</Text>
          <Text style={styles.text}>
            To produce graduates equipped with the competence, excellence, and character necessary to achieve a
            transformative impact on society.
          </Text>

          <Text style={styles.sectionTitle}>VISION</Text>
          <Text style={styles.text}>
          We are the premier learning institution providing holistic and innovative education that empowers our students to be globally competitive and responsible members of society.
          </Text>
          
          <Text style={styles.sectionTitle}>CORE VALUES</Text>
          <Text style={styles.text}><Text style={styles.highlight1}>Employees and students are expected to uphold the Organization's  core values at all times:</Text>
            -- Live with integrity and discipline {"\n"}
            -- Relentlessly pursue excellence{"\n"}
            -- Respect each person's uniqueness{"\n"}
            -- Serve the institution and community with loyalty.
          </Text>
          
          <Text style={styles.sectionTitle}>GOALS</Text>
          <Text style={styles.text}>
          The Institution shall produce scientifically and technologically oriented human capital equipped with appropriate knowledge, skills and attitudes. It should likewise pursue relevant research strengthen linkages with the industry, community and other institutions and maintain sustainable technology.
          </Text>

          <Text style={styles.sectionTitle}>Branches</Text>
          <View style={styles.branchContainer}>
            {["MANILA", "ILO-ILO", "DAVAO", "CALOOCAN"].map((branch) => (
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
