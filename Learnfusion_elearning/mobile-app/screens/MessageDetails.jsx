import { View, Text, Image, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useRouter, Stack } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import BottomNav from "../components/BottomNav";
import styles from "../styles/messaged";
import { supabase } from "../utils/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';

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

  useEffect(() => {
    const setup = async () => {
      const userStr = await AsyncStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        if (user.id && receiverId) {
          fetchMessages(user.id);
          markMessagesAsRead(user.id, receiverId);
        }
      }
    };
    setup();
  }, [receiverId]);

  const markMessagesAsRead = async (currentUserId, senderId) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        (msg.receiver_id === currentUserId && msg.sender_id == senderId && !msg.read)
          ? { ...msg, read: true }
          : msg
      )
    );

    const { error } = await supabase.rpc('mark_messages_as_read', { p_receiver_id: currentUserId, p_sender_id: senderId });
    if (error) {
      console.error('Error marking messages as read in DB:', error);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const channelId = `chat-${currentUser.id}-${receiverId}`;
    const channel = supabase.channel(channelId, {
      config: {
        broadcast: { self: true },
      },
    });

    const subscription = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new;
        if ((newMessage.receiver_id === currentUser.id && newMessage.sender_id == receiverId) || 
            (newMessage.receiver_id == receiverId && newMessage.sender_id === currentUser.id)) {
         
          setMessages((prevMessages) => {
            const tempMessageIndex = prevMessages.findIndex(m => typeof m.id === 'string' && m.id.startsWith('temp-'));
            const isDuplicate = prevMessages.some(m => m.id === newMessage.id);
            if (isDuplicate) return prevMessages;
            
            return [...prevMessages.filter(m => m.id !== newMessage.id), newMessage].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          });
          markMessagesAsRead(currentUser.id, receiverId);
        }
      }).subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser, receiverId]);

  const fetchMessages = async (currentUserId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`)
      .order("created_at", { ascending: true });

    if (error) console.error("Error fetching messages:", error);
    else setMessages(data);
    setLoading(false);
  };

  const sendMessage = async () => {
    if ((newMessage.trim() === "" && !selectedFile) || !currentUser || isSending) return;
    if (selectedFile) {
      return sendFile();
    }
    const messageContent = newMessage.trim();
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content: messageContent,
      created_at: new Date().toISOString(),
      sender_id: currentUser.id,
      receiver_id: receiverId,
      file_url: null,
    };
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage(""); 

    const { data, error } = await supabase
      .from("messages")
      .insert([{ content: messageContent, sender_id: currentUser.id, receiver_id: receiverId }])
      .select()
      .single();
      
    setMessages(prev => prev.map(m => m.id === tempId ? data : m));

    if (error) {
      console.error("Error sending message:", error);
      setMessages(prev => prev.filter(m => m.id !== tempId)); 
      setNewMessage(messageContent); 
    } 
    setIsSending(false);
  };

  const pickFile = async () => {
    setDropdownVisible(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: [ 
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ], 
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const file = result.assets[0];

    const maxFileSize = 250 * 1024 * 1024; 
    if (file.size > maxFileSize) {
      Alert.alert("File Too Large", `The selected file exceeds the 250 MB size limit.`);
      return;
    }

    setSelectedFile(file);
  };

  const sendFile = async () => {
    if (!selectedFile) return;
    setIsSending(true);
    
    const tempId = `temp-file-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content: newMessage.trim() || selectedFile.name,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      sender_id: currentUser.id,
      receiver_id: receiverId,
      file_url: null, 
      file_name: selectedFile.name,
      file_type: selectedFile.mimeType,
      is_uploading: true,
    };

    setMessages(prev => [...prev, tempMessage]);
    setSelectedFile(null);
    setNewMessage("");

    try {
      const file = selectedFile;
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      });

      const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, formData);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('message-attachments').getPublicUrl(filePath);
      if (!urlData.publicUrl) throw new Error("Could not get public URL for the file.");

      const fileMessage = {
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content: newMessage.trim() || file.name, 
        content: newMessage.trim(), 
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.mimeType,
      };

      const { data: finalMessage, error: insertError } = await supabase.from('messages').insert(fileMessage).select().single();
      if (insertError) throw insertError;

      setMessages(prev => prev.map(m => m.id === tempId ? { ...finalMessage, is_uploading: false } : m));

    } catch (error) {
      console.error("Error sending file:", error);
      Alert.alert("Error", "Failed to send file. Please try again.");
      setMessages(prev => prev.filter(m => m.id !== tempId)); 
    } finally {
      setIsSending(false);
    }
  };

  const handleFilePress = async (fileUrl) => {
    Linking.openURL(fileUrl).catch(err => Alert.alert("Error", "Could not open the file."));
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView 
       behavior={Platform.OS === "ios" ? "padding" : "height"} 
       style={styles.container}
      >
  <View style={{ flex: 1 }}>
   <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.headerTitle}>
        <Image source={avatar ? { uri: avatar } : require('../assets/default_profile.png')} style={styles.avatar} />
        <Text style={styles.headerText}>{name}</Text>
      </View>
      <FontAwesome5 name="envelope" size={20} color="white" style={styles.icon} />
    </View>

    {loading ? (
      <ActivityIndicator style={{ flex: 1 }} size="large" color="#046a38"/>
    ) : (
      <FlatList
      extraData={messages}
      data={messages}
      renderItem={({ item: msg, index }) => {
        const isMyMessage = msg.sender_id === currentUser?.id;
        return (
          <View style={{ paddingBottom: 25 }}>
          <View key={msg.id} style={[isMyMessage ? styles.receiverBubble : styles.senderBubble, isMyMessage && { backgroundColor: '#05642d' }]}>
            {msg.file_url ? (
              <View style={styles.fileContainer}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => msg.file_url && handleFilePress(msg.file_url)} disabled={msg.is_uploading}>
                  {msg.is_uploading ? (
                    <ActivityIndicator size="small" color={isMyMessage ? 'white' : '#046a38'} style={{ marginRight: 8 }} />
                  ) : (
                    <FontAwesome5 name="file-alt" size={24} color={isMyMessage ? 'white' : '#333'} style={{ marginRight: 8 }} />
                  )}
                  <Text style={[styles.fileText, isMyMessage ? styles.receiverText : styles.senderText, isMyMessage && { color: 'white' }, { flexShrink: 1 }]} numberOfLines={2}>{msg.file_name || 'File'}</Text>
                </TouchableOpacity> 
              </View>
            ) : (
              <Text style={[isMyMessage ? styles.receiverText : styles.senderText, isMyMessage && { color: 'white' }]}>{msg.content}</Text>
            )}
            <Text style={[styles.time, { color: isMyMessage ? '#e0e0e0' : '#666' }]}>{new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</Text>
            {isMyMessage && index === messages.length - 1 && msg.read && (
              <Text style={styles.readReceipt}>Read</Text>
            )}
          </View>
          </View>
        );
      }}
      keyExtractor={(item) => item.id.toString()}
      style={[styles.chatContainer, { backgroundColor: 'white' }]}
      ref={flatListRef}
      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
    />
    )}

      <View>
        {selectedFile ? (
          <View style={[styles.filePreviewContainer, {backgroundColor: 'white', justifyContent: "space-between", alignItems: 'center', flexDirection: 'row'}]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, overflow: 'hidden', paddingRight: 10 }}>
              <FontAwesome5 name="file-alt" size={20} color="#333" style={{ marginRight: 8 }} />
              <Text style={styles.filePreviewText} numberOfLines={1}>{selectedFile.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedFile(null)} style={{ padding: 10 }}>
              <Ionicons name="close-circle" size={24} color="gray" />
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.inputContainer}>
            <TouchableOpacity onPress={() => setDropdownVisible(!dropdownVisible)}
            >
                <FontAwesome5 name="plus" size={20} color="green" left={10} />
            </TouchableOpacity>
            
            {dropdownVisible && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={pickFile}
                >
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
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={isSending || (newMessage.trim() === '' && !selectedFile)}>
            <Ionicons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
</KeyboardAvoidingView>
    </>
  );
}
