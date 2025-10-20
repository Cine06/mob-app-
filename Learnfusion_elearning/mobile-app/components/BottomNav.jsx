import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { supabase } from "../utils/supabaseClient";
import * as SecureStore from "expo-secure-store";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import styles from "../styles/bottomnav";

export default function BottomNav() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const pulse = useSharedValue(1);

  const getUser = async () => {
    const userStr = await SecureStore.getItemAsync("user");
    return userStr ? JSON.parse(userStr) : null;
  };

  const fetchUnreadCount = async () => {
    const user = await getUser();
    if (!user) return;

    const { count, error } = await supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null)
      .is("dismissed_at", null);

    if (error) {
      console.error("Error fetching unread count:", error);
      return;
    }

    if (count > unreadCount) startPulse();
    setUnreadCount(count || 0);
  };

  const fetchUnreadMessageCount = async () => {
    const user = await getUser();
    if (!user) return;

    // Get notification IDs for messages
    const { data: messageNotifications, error: notifError } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'message');

    if (notifError) throw notifError;
    const notificationIds = messageNotifications.map(n => n.id);

    const { count, error } = await supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("notification_id", notificationIds)
      .is("read_at", null);

    if (error) {
      console.error("Error fetching unread message count:", error);
    }
    setUnreadMessageCount(count || 0);
  };

  const startPulse = () => {
    cancelAnimation(pulse);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 300 }),
        withTiming(1, { duration: 300 })
      ),
      3,
      false
    );
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  useEffect(() => {
    let subscription;

    const initRealtime = async () => {
      const user = await getUser();
      if (!user) return;

      subscription = supabase
        .channel("realtime_unread_count")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadCount();
            fetchUnreadMessageCount();
          }
        )
        .subscribe();
    };

    initRealtime();
    fetchUnreadCount();
    fetchUnreadMessageCount();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount();
      fetchUnreadMessageCount();
    }, [])
  );

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
        <View>
          <FontAwesome5 name="bell" size={24} color="white" />
          {unreadCount > 0 && (
            <Animated.View style={[localStyles.badgeContainer, pulseStyle]}>
              <Text style={localStyles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </Animated.View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.icon} onPress={() => router.push("/messages")}>
        <View>
          <FontAwesome5 name="envelope" size={24} color="white" />
          {unreadMessageCount > 0 && (
            <View style={localStyles.badgeContainer}>
              <Text style={localStyles.badgeText}>{unreadMessageCount > 9 ? "9+" : unreadMessageCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.icon} onPress={() => router.push("/profile")}>
        <FontAwesome5 name="user" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const localStyles = StyleSheet.create({
  badgeContainer: {
    position: "absolute",
    right: -6,
    top: -4,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    shadowColor: "#FF3B30",
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
});
