import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, FlatList, Alert } from "react-native";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import styles from "../styles/message";
import { supabase } from "../utils/supabaseClient";
import * as SecureStore from "expo-secure-store"; 

// Helper: format time since last message
const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function Messages() {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState(new Set());
  const channelRef = useRef(null);

  // This function will be called when the user navigates to the messages page.
  // It tells the database to mark all message notifications as read.
  const markAllMessageNotificationsAsRead = useCallback(async (user) => {
    if (!user) return;
    try {
      // Get notification IDs for messages
      const { data: messageNotifications, error: notifError } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'message');

      if (notifError) throw notifError;

      const notificationIds = messageNotifications.map(n => n.id);

      // Mark user notifications as read for those message notifications
      const { error } = await supabase
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('notification_id', notificationIds)
        .is('read_at', null);

      if (error) {
        console.error("Error marking message notifications as read:", error);
      }
    } catch (err) {
      console.error("Error in markAllMessageNotificationsAsRead:", err);
    }
  }, []);

  // Fetch user and conversations when focused
  useFocusEffect(
    useCallback(
      () => {
        const fetchUserAndConversations = async () => {
          const userStr = await SecureStore.getItemAsync("user");
          if (userStr) {
            const user = JSON.parse(userStr);
            if (!currentUser) setCurrentUser(user); // Set user if not already set
            await fetchConversations(user);
            markAllMessageNotificationsAsRead(user);
          }
        };
        fetchUserAndConversations();
      },
      [] // Empty dependency array ensures this runs on focus
    )
  );

  // Realtime updates via Supabase
  useEffect(() => {
    if (!currentUser) return;

    const channelId = `realtime-conversations:${currentUser.id}`;
    if (channelRef.current && channelRef.current.topic === channelId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase.channel(channelId);
    channelRef.current
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `or(sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id})`,
        },
        () => {
          fetchConversations(currentUser);
        }
      )
      .subscribe();

    return () => {};
  }, [currentUser?.id]);

  // Fetch conversations from Supabase
  const fetchConversations = useCallback(async (user) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Step 1: Get all messages involving the current user to find distinct partners
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (messagesError) throw messagesError;

      const partnerIds = [...new Set(
        messages.flatMap(m => [m.sender_id, m.receiver_id])
      )].filter(id => id !== user.id);

      if (partnerIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Step 2: Get user info for all partners in one query
      const { data: distinctUsers, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, profile_picture')
        .in('id', partnerIds);

      if (usersError) throw usersError;

      // Step 3: For each partner, get the latest message and unread count
      const conversationPromises = distinctUsers.map(async (partner) => {
        // Get latest message
        const { data: latestMessage, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count
        const { count: unreadCount, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', partner.id)
          .eq('receiver_id', user.id)
          .is('read_at', null);

        if (msgError || countError) return null;

        return {
          id: partner.id,
          name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
          text: latestMessage.file_url ? `\uD83D\uDCCE ${latestMessage.file_name || 'File'}` : latestMessage.content,
          time: formatTimeAgo(latestMessage.created_at),
          avatar: partner.profile_picture ? { uri: partner.profile_picture } : require('../assets/default_profile.png'),
          unreadCount: unreadCount || 0,
        };
      });

      const resolvedConversations = (await Promise.all(conversationPromises)).filter(Boolean);
      // Sort by the time of the latest message
      resolvedConversations.sort((a, b) => new Date(b.time) - new Date(a.time));

      setConversations(resolvedConversations);
    } catch (error) {
      if (error) throw error;
      console.error("Error fetching conversations:", error.message);
      Alert.alert("Error", "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openChat = (conversation) => {
    router.push({
      pathname: "/messagedetails",
      params: {
        name: conversation.name,
        avatar: conversation.avatar.uri,
        receiverId: conversation.id,
      },
    });
  };

  const toggleSelection = (conversationId) => {
    setSelectedConversations((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(conversationId)) {
        newSelection.delete(conversationId);
      } else {
        newSelection.add(conversationId);
      }
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    if (selectedConversations.size === conversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(conversations.map((c) => c.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedConversations.size === 0) {
      Alert.alert("No Selection", "Please select conversations to delete.");
      return;
    }

    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to delete ${selectedConversations.size} conversation(s)? This will permanently delete all messages for BOTH users and cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const deletePromises = Array.from(selectedConversations).map((otherUserId) =>
                supabase
                  .from("messages")
                  .delete()
                  .or(
                    `and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`
                  )
              );

              const results = await Promise.all(deletePromises);
              const someFailed = results.some((res) => res.error);

              if (someFailed) throw new Error("Some conversations could not be deleted.");

              Alert.alert("Success", "Selected conversations deleted successfully.");
              fetchConversations(currentUser);
            } catch (err) {
              console.error("Error deleting conversations:", err);
              Alert.alert("Error", `Failed to delete conversations: ${err.message}`);
            } finally {
              setLoading(false);
              setSelectionMode(false);
              setSelectedConversations(new Set());
            }
          },
        },
      ]
    );
  };

  const isAllSelected = useMemo(
    () => conversations.length > 0 && selectedConversations.size === conversations.length,
    [selectedConversations, conversations]
  );

  const renderItem = ({ item }) => {
    const isSelected = selectedConversations.has(item.id);
    const isUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={[styles.messageItem, isUnread && styles.unreadMessageItem]}
        onPress={() => (selectionMode ? toggleSelection(item.id) : openChat(item))}
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
        <Image source={item.avatar} style={styles.avatar} />
        <View style={styles.messageTextContainer}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[styles.messageName, isUnread && styles.unreadTextContent]}>{item.name}</Text>
            {isUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.messageText, isUnread && styles.unreadTextContent]} numberOfLines={1}>
            {item.text}
          </Text>
        </View>
        <Text style={styles.messageTime}>{item.time}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          {selectionMode ? (
            <>
              <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedConversations(new Set()); }}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerText}>{selectedConversations.size} Selected</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity onPress={handleSelectAll} style={{ marginRight: 20 }}>
                  <MaterialIcons name={isAllSelected ? "deselect" : "select-all"} size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteSelected}>
                  <FontAwesome5 name="trash" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => setSelectionMode(true)}>
                <Text style={styles.manageButton}>Manage</Text>
              </TouchableOpacity> 
              <Text style={styles.headerText}>Messages    </Text>
              <TouchableOpacity onPress={() => router.push("/new-message")}>
                <FontAwesome5 name="plus" size={20} color="white" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color="#046a38" />
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={<Text style={styles.noMessages}>No conversations yet.</Text>}
            style={styles.messageList}
          />
        )}

        <BottomNav />
      </View>
    </>
  );
}
