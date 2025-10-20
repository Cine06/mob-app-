import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import FloatingChatbot from "../components/FloatingChatbot";
import * as SecureStore from "expo-secure-store";
import { supabase } from "../utils/supabaseClient";
import styles from "../styles/dashboard"; 

export default function Dashboard() {
  const router = useRouter();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [currentUserRankInfo, setCurrentUserRankInfo] = useState(null);

  const fetchReminders = useCallback(async (sectionId) => {
    if (!sectionId) {
      setReminders([]);
      setLoadingReminders(false);
      return;
    }
    setLoadingReminders(true);
    try {
      const { data, error } = await supabase.rpc("get_section_reminders", { p_section_id: sectionId });
      if (error) {
        console.error("Error fetching reminders:", error);
        setReminders([]);
      } else {
        const now = new Date();
        const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        const filteredData = (data || []).filter((item) => {
          if ((item.item_type === "Quiz" || item.item_type === "Assignment") && item.due_date) {
            const dueDate = new Date(item.due_date);
            const createdAt = new Date(item.created_at);
            return dueDate >= now && (dueDate <= oneDayFromNow || createdAt >= twoDaysAgo);
          }
          if (item.item_type === "Handout") {
            const createdAt = new Date(item.created_at);
            return createdAt >= twoDaysAgo;
          }
          return false;
        });
        setReminders(filteredData);
      }
    } catch (e) {
      console.error("RPC Error:", e);
    } finally {
      setLoadingReminders(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async (sectionId, currentUserId) => {
    if (!sectionId) {
      setLeaderboardData([]);
      setLoadingLeaderboard(false);
      return;
    }
    setLoadingLeaderboard(true);
    try {
      const { data: sectionData, error: sectionError } = await supabase
        .from("sections")
        .select("section_name")
        .eq("id", sectionId)
        .single();
      if (sectionError) throw sectionError;

      const { data: students, error: studentsError } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .eq("section_id", sectionId)
        .eq("role", "Student");
      if (studentsError) throw studentsError;

      const { data: assignedAssessments, error: assignedError } = await supabase
        .from("assigned_assessments")
        .select("id, assessment:assessments!inner(id, questions, type)")
        .eq("section_id", sectionId);
      if (assignedError) throw assignedError;

      const assignedAssessmentIds = assignedAssessments.map((a) => a.id);
      if (!assignedAssessmentIds || assignedAssessmentIds.length === 0) {
        setLeaderboardData([]);
        setCurrentUserRankInfo(null);
        setLoadingLeaderboard(false);
        return;
      }

      const { data: allAnswersData, error: answersError } = await supabase
        .from("student_assessments_answer")
        .select("users_id, answer, student_assessments_take:student_assessments_take_id(assigned_assessments_id)")
        .in("student_assessments_take.assigned_assessments_id", assignedAssessmentIds);
      if (answersError) throw answersError;

      // Ensure allAnswers is an array to prevent errors on filter.
      const allAnswers = allAnswersData || [];

      const totalPossiblePoints = assignedAssessments.reduce((sum, a) => {
        const questions = a.assessment?.questions;
        return sum + (Array.isArray(questions) ? questions.length : 0);
      }, 0);

      if (totalPossiblePoints === 0) {
        setLeaderboardData([]);
        setCurrentUserRankInfo(null);
        setLoadingLeaderboard(false);
        return;
      }

      const studentScores = students.map((student) => {
        let totalScore = 0;
        const studentAnswers = allAnswers.filter((ans) => ans.users_id === student.id);

        assignedAssessments.forEach((assigned) => {
          const assessment = assigned.assessment;
          if (assessment && assessment.questions && Array.isArray(assessment.questions)) {
            const answersForThisAssessment = studentAnswers.filter(
              (ans) => ans.student_assessments_take.assigned_assessments_id === assigned.id
            );

            answersForThisAssessment.forEach((answer, answerIndex) => {
              try {
                const answerData = JSON.parse(answer.answer);
                const questionIndex = answerData.questionIndex;
                const studentAnswer = answerData.answer;

                if (
                  questionIndex !== undefined &&
                  assessment.questions[questionIndex]?.correctAnswer === studentAnswer
                ) {
                  totalScore++;
                }
              } catch (e) {
                if (assessment.questions[answerIndex]?.correctAnswer === answer.answer) {
                  totalScore++;
                }
              }
            });
          }
        });

        const percentage =
          totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
        return {
          user_id: student.id,
          name: `${student.first_name} ${student.last_name}`.trim(),
          percentage: isNaN(percentage) ? 0 : percentage,
        };
      });

      const qualifiedStudents = studentScores.filter((s) => s.percentage >= 75);

      const sortedData = qualifiedStudents.sort((a, b) => {
        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage;
        }
        return a.name.localeCompare(b.name);
      });

      const processedLeaderboard = sortedData.slice(0, 10).map((student, index) => {
        const rank = index + 1;
        let award;
        if (student.percentage >= 100) award = { color: "gold" };
        else if (student.percentage >= 90) award = { color: "silver" };
        else if (student.percentage >= 80) award = { color: "#cd7f32" };

        return { ...student, rank, award, section_name: sectionData.section_name };
      });

      const userIndex = sortedData.findIndex((s) => s.user_id === currentUserId);
      const currentUserRankInfo =
        userIndex !== -1
          ? { ...sortedData[userIndex], rank: userIndex + 1 }
          : null;

      setCurrentUserRankInfo(currentUserRankInfo);
      setLeaderboardData(processedLeaderboard);
    } catch (e) {
      console.error("Error processing leaderboard:", e);
      setLeaderboardData([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let sectionId = null;

      const setup = async () => {
        const storedUser = await SecureStore.getItemAsync("user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);

          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("section_id")
            .eq("id", parsedUser.id)
            .single();

          if (userError) {
            console.error("Error fetching user section:", userError);
          } else if (userData?.section_id) {
            sectionId = userData.section_id;
            fetchReminders(sectionId);
            fetchLeaderboard(sectionId, parsedUser.id);
          } else {
            fetchReminders(null);
            fetchLeaderboard(null, parsedUser.id);
          }
        } else {
          console.warn("No user found in SecureStore, redirecting to login...");
          router.replace("/login");
        }
      };

      setup();

      const remindersChannel = supabase
        .channel("public:reminders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assigned_assessments" },
          (payload) => {
            if (sectionId && payload.new.section_id === sectionId) {
              fetchReminders(sectionId);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "handouts_tag_section" },
          (payload) => {
            if (sectionId && payload.new.section_id === sectionId) {
              fetchReminders(sectionId);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(remindersChannel);
      };
    }, [fetchReminders, fetchLeaderboard])
  );

  const handleReminderPress = (reminder) => {
    let tab = "";
    switch (reminder.item_type) {
      case "Quiz":
        tab = "quizzes";
        break;
      case "Assignment":
        tab = "assignments";
        break;
      case "Handout":
        tab = "lessons";
        break;
      default:
        return;
    }
    router.push({
      pathname: "lessons",
      params: { initialTab: tab, itemId: reminder.id },
    });
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "OK",
        onPress: async () => {
          await SecureStore.deleteItemAsync("user");
          router.replace("/login");
        },
      },
    ]);
  };

  const renderReminderText = (item) => {
    const now = new Date();

    switch (item.item_type) {
      case "Quiz":
      case "Assignment":
        const dueDate = new Date(item.due_date);
        const diffHours = (dueDate - now) / (1000 * 60 * 60);

        let dueDateString;
        if (diffHours < 1) {
          dueDateString = "due in less than an hour";
        } else if (diffHours < 24) {
          dueDateString = `due in ${Math.floor(diffHours)} hours`;
        } else if (diffHours < 48) {
          dueDateString = "due in 1 day";
        } else {
          dueDateString = `due ${dueDate.toLocaleDateString()}`;
        }

        if (diffHours < 48) {
          return `Deadline: ${item.title} (${dueDateString})`;
        }
        return `New ${item.item_type}: ${item.title} (due ${dueDateString})`;

      case "Handout":
        return `New lesson posted: ${item.title}`;

      default:
        return item.title;
    }
  };
  console.log("Supabase URL:", process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  // console.log("Supabase URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setDropdownVisible(!dropdownVisible)}
          >
            <FontAwesome5 name="bars" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Image source={require("../assets/logo.png")} style={styles.logo} />
          </View>

          {dropdownVisible && (
            <View style={styles.dropdownMenu}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  router.push("/profile");
                  setDropdownVisible(false);
                }}
              >
                <FontAwesome5 name="user" size={18} color="#046a38" />
                <Text style={styles.menuText}>Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  router.push("/about");
                  setDropdownVisible(false);
                }}
              >
                <FontAwesome5 name="info-circle" size={18} color="#046a38" />
                <Text style={styles.menuText}>About Us</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={async () => {
                  await handleLogout();
                  setDropdownVisible(false);
                }}
              >
                <FontAwesome5 name="sign-out-alt" size={18} color="red" />
                <Text style={[styles.menuText, { color: "red" }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.welcomeText}>
            Welcome to <Text style={styles.boldText}>LearnFusion</Text>
          </Text>

          {/* === About Section === */}
          <View style={styles.infoContainer}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About ICC</Text>
              <TouchableOpacity onPress={() => router.push("/about")}>
                <Image source={require("../assets/about.png")} style={styles.aboutImage} />
              </TouchableOpacity>
            </View>

            {/* === Reminders === */}
            <View className="section">
              <Text style={styles.sectionTitle}>Reminders</Text>
              <View style={styles.remindersContainer}>
                {loadingReminders ? (
                  <ActivityIndicator color="#046a38" />
                ) : reminders.length > 0 ? (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                      <FontAwesome5 name="bell" size={20} color="#046a38" />
                      <Text style={styles.reminderText}>Upcoming Deadlines & Activities</Text>
                    </View>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                      {reminders.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.reminderItem,
                            {
                              backgroundColor: "#F0FDF4",
                              borderRadius: 8,
                              padding: 12,
                              marginBottom: 8,
                            },
                          ]}
                          onPress={() => handleReminderPress(item)}
                        >
                          <View
                            style={[
                              styles.reminderContent,
                              { flexDirection: "row", alignItems: "center" },
                            ]}
                          >
                            <FontAwesome5
                              name={item.item_type === "Handout" ? "file-alt" : "clipboard-list"}
                              size={16}
                              color="#046a38"
                              style={{ marginRight: 10 }}
                            />
                            <Text style={styles.reminderTitle} numberOfLines={2}>
                              {renderReminderText(item)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                ) : (
                  <View style={[styles.reminderItem, { flexDirection: "row", alignItems: "center" }]}>
                    <FontAwesome5 name="bell-slash" size={16} color="#aaa" />
                    <View style={styles.reminderContent}>
                      <Text style={styles.reminderSubtitle}>No new reminders.</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* === Leaderboard === */}
            <Text style={styles.sectionTitle}>Leaderboard</Text>
            <View style={styles.leaderboardContainer}>
              {loadingLeaderboard ? (
                <ActivityIndicator color="#046a38" />
              ) : leaderboardData.length > 0 ? (
                <>
                  {leaderboardData.map((student) => (
                    <View
                      key={student.user_id}
                      style={[styles.leaderboardRow, { flexDirection: "row", alignItems: "center" }]}
                    >
                      {student.award && (
                        <FontAwesome5
                          name="medal"
                          size={16}
                          color={student.award.color}
                          style={{ marginRight: 8 }}
                        />
                      )}
                      <Text style={styles.leaderboardText}>
                        {`${student.rank}. ${student.name} — ${student.percentage.toFixed(0)}%`}
                      </Text>
                    </View>
                  ))}
                  {currentUserRankInfo && (
                    <View style={styles.currentUserRankInfo}>
                      <Text style={styles.rankText}>
                        Your Rank: #{currentUserRankInfo.rank} -{" "}
                        {currentUserRankInfo.percentage.toFixed(0)}%
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.leaderboardRow}>
                  <FontAwesome5 name="info-circle" size={16} color="#666" />
                  <Text style={styles.leaderboardText}>Leaderboard is not available yet.</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <BottomNav />
        <FloatingChatbot />
      </View>
    </>
  );
}
