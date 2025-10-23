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

  // 🔐 Secure user fetch
  const getUser = async () => {
    const userStr = await SecureStore.getItemAsync("user");
    return userStr ? JSON.parse(userStr) : null;
  };

  // 🔄 Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const user = await getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_notifications")
        .select(
          `
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
            route
          )
        `
        )
        .eq("user_id", user.id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Only include notifications for graded FILE SUBMISSIONS, not other graded assignments.
      const filteredData = data.filter(item => {
        const notif = item.notifications;
        const isGradedFileSubmission = notif?.type === "graded_assignment" && notif?.route?.pathname === '/assignmentDetails';
        // If it's a graded_assignment, it MUST be a file submission. Otherwise, include it (e.g., messages).
        return notif?.type !== "graded_assignment" || isGradedFileSubmission;
      });

      // Format the remaining notifications
      const formatted = await Promise.all(
        filteredData.map(async (item) => {
          const notif = item.notifications;
          const isMessageType = notif?.type === "message";
          const isGradedFileType = notif?.type === "graded_assignment" && notif?.route?.pathname === '/assignmentDetails';

          let finalRoute = notif?.route;
          // If it's a message, fetch sender's info to populate route params
          if (isMessageType && notif.route?.params?.receiverId) {
            const senderId = notif.route.params.receiverId; // In this context, receiverId is the sender
            const { data: senderData, error: senderError } = await supabase
              .from("users")
              .select("first_name, last_name, profile_picture")
              .eq("id", senderId)
              .single();

            if (!senderError && senderData) {
              finalRoute = {
                ...notif.route,
                params: {
                  ...notif.route.params,
                  name: `${senderData.first_name} ${senderData.last_name}`.trim(),
                  avatar: senderData.profile_picture,
                },
              };
            }
          }

          return {
            id: notif?.id,
            userNotifId: item.id,
            title: notif?.title,
            message: isMessageType
              ? "You have a new message"
              : isGradedFileType
              ? `${notif?.title}" has been graded.` // This is now the only graded assignment message
              : notif?.description || notif?.title,
            type: notif?.type,
            eventDate: notif?.event_date,
            route: finalRoute,
            isRead: !!item.read_at,
          };
        })
      );

      setNotifications(formatted);
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

      subscription = supabase
        .channel("realtime_user_notifications")
        // ✅ INSERT → new notification
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            // Realtime: Check if the new notification is for a graded assignment that is NOT a file submission, and ignore it.
            const { data: checkData } = await supabase
              .from("notifications")
              .select("type, route").eq("id", payload.new.notification_id).single();
            const isGradedFileSubmission = checkData?.type === "graded_assignment" && checkData?.route?.pathname === '/assignmentDetails';
            if (checkData?.type === "graded_assignment" && !isGradedFileSubmission) return;

            // If it's not a graded quiz, process it.
            const { data: notifData } = await supabase
              .from("notifications")
              .select("id, type, title, description, event_date, route")
              .eq("id", payload.new.notification_id)
              .single();

            if (notifData) {
              const isMessageType = notifData.type === "message";
              const isGradedFileType = notifData.type === "graded_assignment" && notifData?.route?.pathname === '/assignmentDetails';

              let finalRoute = notifData.route;
              // If it's a message, fetch sender's info to populate route params
              if (isMessageType && notifData.route?.params?.receiverId) {
                const senderId = notifData.route.params.receiverId;
                const { data: senderData, error: senderError } = await supabase
                  .from("users")
                  .select("first_name, last_name, profile_picture")
                  .eq("id", senderId)
                  .single();

                if (!senderError && senderData) {
                  finalRoute = {
                    ...notifData.route,
                    params: {
                      ...notifData.route.params,
                      name: `${senderData.first_name} ${senderData.last_name}`.trim(),
                      avatar: senderData.profile_picture,
                    },
                  };
                }
              }

              const newNotif = {
                id: notifData.id,
                userNotifId: payload.new.id,
                title: notifData.title,
                message: isMessageType
                  ? "You have a new message"
                  : isGradedFileType
                  ? `Your submission for "${notifData.title}" has been graded.` // This is now the only graded assignment message
                  : notifData.description || notifData.title,
                type: notifData.type,
                eventDate: notifData.event_date,
                route: finalRoute,
                isRead: false,
              };
              setNotifications((prev) => [newNotif, ...prev]);
            }
          }
        )
        // ✅ UPDATE → read_at / dismissed_at changed
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const { new: updatedRow } = payload;

            // If dismissed, remove it from local list
            if (updatedRow.dismissed_at) {
              setNotifications((prev) =>
                prev.filter((n) => n.id !== updatedRow.notification_id)
              );
              return;
            }

            // If marked read, update isRead status
            if (updatedRow.read_at) {
              setNotifications((prev) =>
                prev.map((n) =>
                  n.id === updatedRow.notification_id
                    ? { ...n, isRead: true }
                    : n
                )
              );
            }
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
              : item.type === "graded_assignment"
              ? "clipboard-check" // Using a clipboard-check icon for graded assignments
              : "bell"
          }
          size={20}
          color="#046a38"
          style={styles.icon}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.message}>{item.message}</Text>
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}>
              <Text style={styles.noNotifications}>No new notifications</Text>
            </RefreshControl>
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
