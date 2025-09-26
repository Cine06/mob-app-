import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, FlatList, Alert } from "react-native";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import styles from "../styles/message";
import { supabase } from "../utils/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  useFocusEffect(
    useCallback(() => {
      const fetchUserAndConversations = async () => {
        setLoading(true);
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          setCurrentUser(user);
          fetchConversations(user);
        } else {
          setLoading(false);
        }
      };
      fetchUserAndConversations();

      return () => {};
    }, [fetchConversations])
  );

  useEffect(() => {
    if (!currentUser) return;

    const channelId = `realtime-conversations:${currentUser.id}`;
    if (channelRef.current && channelRef.current.topic === channelId) {
      return;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase.channel(channelId);
    channelRef.current.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `or(sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id})` },
        (payload) => {
          fetchConversations(currentUser);
        }
      )
      .subscribe();

    return () => {};
  }, [currentUser?.id]);

  const fetchConversations = useCallback(async (user) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_conversations', { p_user_id: user.id });

      if (error) throw error;

      if (data) {
        const formattedConversations = data.map(convo => ({
          id: convo.other_user_id,
          name: `${convo.other_user_first_name || ''} ${convo.other_user_last_name || ''}`.trim(),
          text: convo.latest_message_file_url ? `\uD83D\uDCCE ${convo.latest_message_file_name || 'File'}` : convo.latest_message_content,
          time: formatTimeAgo(convo.latest_message_created_at),
          avatar: convo.other_user_profile_picture ? { uri: convo.other_user_profile_picture } : require("../assets/default_profile.png"),
          unreadCount: convo.unread_count,
          otherUser: {
            id: convo.other_user_id,
            name: `${convo.other_user_first_name || ''} ${convo.other_user_last_name || ''}`.trim(),
            avatar: convo.other_user_profile_picture ? { uri: convo.other_user_profile_picture } : require("../assets/default_profile.png"),
          }
        }));
        setConversations(formattedConversations);
      }
    } catch (error) {
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
    setSelectedConversations(prev => {
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
      const allConversationIds = new Set(conversations.map(c => c.id));
      setSelectedConversations(allConversationIds);
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
              const deletePromises = Array.from(selectedConversations).map(otherUserId =>
                supabase
                  .from('messages')
                  .delete()
                  .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
              );

              const results = await Promise.all(deletePromises);
              const someFailed = results.some(res => res.error);

              if (someFailed) {
                throw new Error("Some conversations could not be deleted.");
              }

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

  const isAllSelected = useMemo(() => {
    return conversations.length > 0 && selectedConversations.size === conversations.length;
  }, [selectedConversations, conversations]);

  const renderItem = ({ item }) => {
    const isSelected = selectedConversations.has(item.id);
    const isUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity 
        style={[styles.messageItem, isUnread && styles.unreadMessageItem]} 
        onPress={() => selectionMode ? toggleSelection(item.id) : openChat(item)}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            toggleSelection(item.id);
          }
        }}
      >
        {selectionMode && (
          <MaterialIcons name={isSelected ? "check-box" : "check-box-outline-blank"} size={24} color="#046a38" style={{ marginRight: 15 }} />
        )}
        <Image source={item.avatar} style={styles.avatar} />
        <View style={styles.messageTextContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.messageName, isUnread && styles.unreadTextContent]}>{item.name}</Text>
            {isUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.messageText, isUnread && styles.unreadTextContent]} numberOfLines={1}>{item.text}</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
              <TouchableOpacity onPress={() => router.push('/new-message')}>
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
