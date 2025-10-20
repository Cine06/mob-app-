import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState, useEffect, useRef } from "react";
import BottomNav from "../components/BottomNav";
import styles from "../styles/messaged"; // Assuming this is the correct path for styles
import { supabase } from "../utils/supabaseClient";
import * as SecureStore from "expo-secure-store";
import * as DocumentPicker from "expo-document-picker";
import * as Linking from "expo-linking";

export default function MessageDetails() {
  const router = useRouter();
  const { name, avatar, receiverId } = useLocalSearchParams();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef();

  // 🔹 Get current user
  useEffect(() => {
    const setup = async () => {
      const userStr = await SecureStore.getItemAsync("user");
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      } else {
        // If no user, stop loading to show an error or empty state
        setLoading(false);
      }
    };
    setup();
  }, []);

  // 🔹 Mark messages as read in DB
  const markMessagesAsRead = async (currentUserId, senderId) => {
    if (!currentUserId || !senderId) return;
  
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("receiver_id", currentUserId)
      .eq("sender_id", senderId)
      .is("read_at", null);
  
    if (error) {
      console.error("Error marking messages as read in DB:", error);
    }
  };

  // 🔹 Listen for real-time message updates
  useEffect(() => {
    if (!currentUser) return;

    const channelId = `chat-${currentUser.id}-${receiverId}`;
    const channel = supabase
      .channel(channelId, {
        config: { broadcast: { self: true } },
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new;
          if (
            (newMsg.receiver_id === currentUser.id &&
              newMsg.sender_id.toString() === receiverId) ||
            (newMsg.receiver_id.toString() === receiverId &&
              newMsg.sender_id === currentUser.id)
          ) {
            // Add new message without sorting, as inverted list handles order
            setMessages((prev) => [newMsg, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser, receiverId]);

  // 🔹 Fetch all messages between users
  const fetchMessages = async (currentUserId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`
      )
      .order("created_at", { ascending: true });

    if (error) console.error("Error fetching messages:", error);
    else setMessages(data.reverse()); // Reverse for inverted list
    setLoading(false);
  };

  useEffect(() => {
    if (currentUser?.id && receiverId) {
      fetchMessages(currentUser.id);
      markMessagesAsRead(currentUser.id, receiverId);
    }
  }, [currentUser, receiverId]);

  // 🔹 Send text message
  const sendMessage = async () => {
    if ((newMessage.trim() === "" && !selectedFile) || !currentUser || isSending)
      return;
    if (selectedFile) return sendFile();

    const messageContent = newMessage.trim();
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content: messageContent,
      created_at: new Date().toISOString(),
      sender_id: currentUser.id,
      receiver_id: receiverId,
    };
    setMessages((prev) => [tempMessage, ...prev]);
    setNewMessage("");

    const { data, error } = await supabase
      .from("messages")
      .insert([{ content: messageContent, sender_id: currentUser.id, receiver_id: receiverId }])
      .select()
      .single();

    if (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId)); // Keep order
      setNewMessage(messageContent);
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data : m)) // Keep order
      );
    }
    setIsSending(false);
  };

  // 🔹 File picker
  const pickFile = async () => {
    setDropdownVisible(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;
    const file = result.assets[0];
    const maxFileSize = 250 * 1024 * 1024; // 250MB limit

    if (file.size > maxFileSize) {
      Alert.alert("File Too Large", "The selected file exceeds the 250 MB size limit.");
      return;
    }

    setSelectedFile(file);
  };

  // 🔹 Send file
  const sendFile = async () => {
    if (!selectedFile) return;
    setIsSending(true);

    const tempId = `temp-file-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content: newMessage.trim() || selectedFile.name,
      created_at: new Date().toISOString(),
      sender_id: currentUser.id,
      receiver_id: receiverId,
      file_url: null,
      file_name: selectedFile.name,
      file_type: selectedFile.mimeType,
      is_uploading: true,
    };

    setMessages((prev) => [tempMessage, ...prev]);
    setSelectedFile(null);
    setNewMessage("");

    try {
      const filePath = `${currentUser.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(filePath, {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.mimeType,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(filePath);

      const fileUrl = urlData?.publicUrl;
      if (!fileUrl) throw new Error("Could not get public URL for the file.");

      const fileMessage = {
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content: newMessage.trim() || selectedFile.name,
        file_url: fileUrl,
        file_name: selectedFile.name,
        file_type: selectedFile.mimeType,
      };

      const { data: finalMessage, error: insertError } = await supabase
        .from("messages")
        .insert(fileMessage)
        .select()
        .single();

      if (insertError) throw insertError;

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...finalMessage, is_uploading: false } : m))
      );
    } catch (error) {
      console.error("Error sending file:", error);
      Alert.alert("Error", "Failed to send file. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleFilePress = async (fileUrl) => {
    Linking.openURL(fileUrl).catch(() =>
      Alert.alert("Error", "Could not open the file.")
    );
  };

  // Helper to check if a date separator should be shown
  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage) return true; // Always show for the first message
    const currentDate = new Date(currentMessage.created_at);
    const previousDate = new Date(previousMessage.created_at);
    return currentDate.toDateString() !== previousDate.toDateString();
  };

  // Helper to format the date for the separator
  const formatDateSeparator = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -500} // Adjust if needed
      >
        <View style={{ flex: 1 }}>
          {/* 🔹 Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <Image
                source={avatar ? { uri: avatar } : require("../assets/default_profile.png")}
                style={styles.avatar}
              />
              <Text style={styles.headerText}>{name}</Text>
            </View>
            <FontAwesome5 name="envelope" size={20} color="white" style={styles.icon} />
          </View>

          {/* 🔹 Message List */}
          <View style={{ flex: 1, backgroundColor: 'white' }}>
            {loading ? (
              <ActivityIndicator style={{ flex: 1 }} size="large" color="#046a38" />
            ) : !currentUser ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Ionicons name="alert-circle-outline" size={48} color="#D32F2F" />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 16, textAlign: 'center' }}>
                  Authentication Error
                </Text>
                <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 }}>
                  Could not load user details. Please try logging out and back in.
                </Text>
              </View>
            ) : (
              <FlatList
                inverted
                data={messages}
                extraData={messages}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.chatContainer}
                ref={flatListRef}
                renderItem={({ item: msg, index }) => {
                  const isMyMessage = msg.sender_id === currentUser?.id;
                  const prevMsg = messages[index + 1]; // Inverted list, so previous is next in array
                  const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);

                  return (
                    <View>
                      {showDateSeparator && (
                        <View style={styles.dateSeparatorContainer}>
                          <Text style={styles.dateSeparatorText}>
                            {formatDateSeparator(msg.created_at)}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          isMyMessage ? styles.receiverBubble : styles.senderBubble,
                          isMyMessage && { backgroundColor: "#05642d" },
                          { marginBottom: 15 }, // Consistent padding
                        ]}
                      >
                        {msg.file_url ? (
                          <TouchableOpacity
                            style={{ flexDirection: "row", alignItems: "center" }}
                            onPress={() => handleFilePress(msg.file_url)}
                            disabled={msg.is_uploading}
                          >
                            {msg.is_uploading ? (
                              <ActivityIndicator
                                size="small"
                                color={isMyMessage ? "white" : "#046a38"}
                                style={{ marginRight: 8 }}
                              />
                            ) : (
                              <FontAwesome5
                                name="file-alt"
                                size={24}
                                color={isMyMessage ? "white" : "#333"}
                                style={{ marginRight: 8 }}
                              />
                            )}
                            <Text
                              style={[
                                styles.fileText,
                                { color: isMyMessage ? "white" : "#333" },
                              ]}
                              numberOfLines={2}
                            >
                              {msg.file_name || "File"}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text
                            style={{
                              color: isMyMessage ? "white" : "#000",
                            }}
                          >
                            {msg.content}
                          </Text>
                        )}
                        <Text
                          style={{
                            color: isMyMessage ? "#e0e0e0" : "#666",
                            fontSize: 10,
                            marginTop: 5,
                          }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>

          {/* 🔹 File preview & Input */}
          <View style={styles.inputArea}>
            {selectedFile && (
              <View
                style={{
                  backgroundColor: "white",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 10,
                }}
              >
                <FontAwesome5 name="file-alt" size={20} color="#333" />
                <Text
                  style={{ flex: 1, marginLeft: 8 }}
                  numberOfLines={1}
                >
                  {selectedFile.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <Ionicons name="close-circle" size={24} color="gray" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputContainer}>
              <TouchableOpacity onPress={() => setDropdownVisible(!dropdownVisible)}>
                <FontAwesome5 name="plus" size={20} color="green" />
              </TouchableOpacity>

              {dropdownVisible && (
                <View style={styles.dropdownMenu}>
                  <TouchableOpacity style={styles.menuItem} onPress={pickFile}>
                    <FontAwesome5 name="paperclip" size={18} color="#046a38" />
                    <Text style={styles.menuText}>Document</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Aa"
                placeholderTextColor="gray"
                value={newMessage}
                onChangeText={setNewMessage}
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={sendMessage}
                disabled={isSending || (newMessage.trim() === "" && !selectedFile)}
              >
                <Ionicons name="send" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View> 
      </KeyboardAvoidingView>

    </View>
  );
}
