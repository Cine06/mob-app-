import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import styles from "../styles/notif";
import * as SecureStore from "expo-secure-store";
import { supabase } from "../utils/supabaseClient";
import dayjs from "dayjs";

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState(new Set());
  const userRef = React.useRef(null); // Use ref to hold user data

  // 🔐 Secure user fetch
  const getUser = async () => {
    const userStr = await SecureStore.getItemAsync("user");
    return userStr ? JSON.parse(userStr) : null;
  };

  // 🔄 Fetch notifications
  const fetchNotifications = async () => {
  try {
    if (!refreshing) setLoading(true);
    const user = await getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("user_notifications")
      .select(`
        id,
        user_id,
        read_at,
        dismissed_at,
        created_at,
        notifications (
          id,
          type,
          title,
          description,
          event_date,
          route,
          take_id
        )
      `)
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = data.map((item) => {
      const notif = item.notifications;
      const isMessageType = notif.type === "message";
      const isGradedType = notif.type === "graded_assignment";
      const isNewAssessment = notif.type === "assignment" || notif.type === "quiz";

      return {
        id: notif.id,
        userNotifId: item.id,
        title: notif.title,
        message: notif.description || notif.title,
        type: notif.type,
        eventDate: notif.event_date,
        route: notif.route,
        takeId: notif.take_id,
        isRead: !!item.read_at,
      };
    });

    setNotifications(formatted);

    // Store unread count
    const unreadCount = formatted.filter(n => !n.isRead).length;
    await SecureStore.setItemAsync("unreadCount", unreadCount.toString());

  } catch (err) {
    console.error("Error fetching notifications:", err);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};


  // ✅ Mark as read
  const markAsRead = async (notifId) => {
    try {
      const user = await getUser();
      if (!user) return;

      await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("notification_id", notifId);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  // 🖱️ Handle notification tap
  const handleNotificationPress = async (item) => {
    await markAsRead(item.id);

    if (item.type === "handout") {
      router.push({
        pathname: "/lessons",
        params: {
          initialTab: "lessons",
          itemId: item.id,
        },
      });
    } else if (item.type === "graded_assignment" && item.route) {
      router.push({
        pathname: item.route.pathname,
        params: {
          ...item.route.params,
          assessmentId: item.route.params.assessmentId,
          assignedAssessmentId: item.route.params.assignedAssessmentId,
          takeId: item.takeId, // Pass the takeId to the destination screen
        },
      });
    } else if (item.route && item.route.pathname) {
      try {
        router.push({
          pathname: item.route.pathname,
          params: item.route.params || {},
        });
      } catch (e) {
        console.warn("Invalid route:", item.route);
      }
    }
  };

  // 🔁 Pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // ⚡ Realtime listener (INSERT + UPDATE)
 useEffect(() => {
  let subscription;

  const initRealtime = async () => {
    const user = await getUser();
    if (!user) return;
    userRef.current = user;

    subscription = supabase
      .channel("realtime_user_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const { data: notifDetails, error } = await supabase
            .from("notifications")
            .select("id, type, title, description, event_date, route, take_id")
            .eq("id", payload.new.notification_id)
            .single();

          if (error || !notifDetails) return;

          const newNotif = {
            id: notifDetails.id,
            userNotifId: payload.new.id,
            title: notifDetails.title,
            message: notifDetails.description || notifDetails.title,
            type: notifDetails.type,
            eventDate: notifDetails.event_date,
            route: notifDetails.route,
            takeId: notifDetails.take_id,
            isRead: !!payload.new.read_at,
          };

          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();
  };

  initRealtime();

  return () => {
    if (subscription) supabase.removeChannel(subscription);
  };
}, []);


  // 🧭 Refresh on screen refocus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  // 🗑️ Multi-select handlers
  const toggleSelection = (notificationId) => {
    setSelectedNotifications((prev) => {
      const newSelection = new Set(prev);
      newSelection.has(notificationId)
        ? newSelection.delete(notificationId)
        : newSelection.add(notificationId);
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    if (selectedNotifications.size === notifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(notifications.map((n) => n.id)));
    }
  };

  const dismissNotifications = async (idsToDismiss) => {
    if (idsToDismiss.size === 0) return;
    const user = await getUser();
    await supabase
      .from("user_notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .in("notification_id", Array.from(idsToDismiss))
      .eq("user_id", user.id);

    setNotifications((curr) => curr.filter((n) => !idsToDismiss.has(n.id)));
  };

  const handleDeleteSelected = () => {
    if (selectedNotifications.size === 0) {
      Alert.alert("No Selection", "Please select notifications to delete.");
      return;
    }
    Alert.alert(
      "Confirm Deletion",
      `Delete ${selectedNotifications.size} notification(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await dismissNotifications(selectedNotifications);
            setSelectionMode(false);
            setSelectedNotifications(new Set());
          },
        },
      ]
    );
  };

  const isAllSelected = useMemo(
    () =>
      notifications.length > 0 &&
      selectedNotifications.size === notifications.length,
    [notifications, selectedNotifications]
  );

  // 🎨 Render single notification
  const renderItem = ({ item }) => {
    const isSelected = selectedNotifications.has(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.isRead && styles.unreadItem,
          isSelected && styles.selectedItem,
        ]}
        onPress={() =>
          selectionMode
            ? toggleSelection(item.id)
            : handleNotificationPress(item)
        }
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            toggleSelection(item.id);
          }
        }}
      >
        {selectionMode && (
          <MaterialIcons
            name={isSelected ? "check-box" : "check-box-outline-blank"}
            size={24}
            color="#046a38"
            style={{ marginRight: 15 }}
          />
        )}
        <FontAwesome5
          name={
            item.type === "message"
              ? "envelope"
              : item.type === "assignment"
              ? "clipboard-list"
              : item.type === "quiz"
              ? "question-circle"
              : item.type === "handout"
              ? "file-alt"
              : item.type === "deadline"
              ? "clock"
              : item.type === "graded_assignment"
              ? "clipboard-check" // Using a clipboard-check icon for graded assignments
              : "bell"
          }
          size={20}
          color="#046a38"
          style={styles.icon}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.message}</Text>
          <Text style={styles.time}>
            {dayjs(item.eventDate).format("MMM D, YYYY h:mm A")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // 🧱 Header components
  const SelectionHeader = ({
    onCancel,
    selectedCount,
    onSelectAll,
    isAllSelected,
    onDelete,
  }) => (
    <View style={styles.selectionHeader}>
      <TouchableOpacity onPress={onCancel}>
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>

      <Text style={styles.headerText}>{selectedCount} Selected</Text>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity onPress={onSelectAll} style={{ marginRight: 20 }}>
          <MaterialIcons
            name={isAllSelected ? "deselect" : "select-all"}
            size={24}
            color="#333"
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={onDelete}>
          <FontAwesome5 name="trash" size={20} color="red" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const DefaultHeader = ({ onEnableSelection }) => (
    <View style={styles.defaultHeader}>
      <Text style={styles.header}>Notifications</Text>
      <TouchableOpacity onPress={onEnableSelection}>
        <FontAwesome5 name="trash-alt" size={20} color="red" />
      </TouchableOpacity>
    </View>  
  );

  // 🧱 Render main
  return (
    <>
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1 }}>
          <View style={styles.headerContainer}>
            {selectionMode ? (
              <SelectionHeader
                selectedCount={selectedNotifications.size}
                isAllSelected={isAllSelected}
                onCancel={() => {
                  setSelectionMode(false);
                  setSelectedNotifications(new Set());
                }}
                onSelectAll={handleSelectAll}
                onDelete={handleDeleteSelected}
              />
            ) : (
              <DefaultHeader onEnableSelection={() => setSelectionMode(true)} />
            )}
          </View>

          {loading ? (
            <ActivityIndicator style={{ flex: 1 }} size="large" color="#046a38" />
          ) : notifications.length === 0 ? (
            <FlatList
  data={[]}
  ListEmptyComponent={
    <Text style={styles.noNotifications}>No new notifications</Text>
  }
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
/>

          ) : (
            <FlatList
              data={notifications}
              renderItem={renderItem}
              keyExtractor={(item) => item.userNotifId.toString()}
              contentContainerStyle={{ paddingBottom: 80 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}
        </View>
      </SafeAreaView>
      
        <BottomNav />
    </>
  );
}
