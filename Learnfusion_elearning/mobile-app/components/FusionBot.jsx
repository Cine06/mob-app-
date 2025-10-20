import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import Markdown from "react-native-markdown-display";
import styles from "../styles/fusionbot";
import { supabase } from "../utils/supabaseClient";
import Constants from "expo-constants";

const COHERE_API_KEY =
  Constants.expoConfig?.extra?.COHERE_API_KEY ??
  Constants.manifest?.extra?.COHERE_API_KEY ??
  process.env.COHERE_API_KEY;
const systemPrompt = `You are FusionBot, a helpful assistant that only answers questions related to Java programming topics...`;

const javaKeywords = [
  "java", "jvm", "jdk", "jre", "compile", "run", "program", "code", "syntax",
  "variable", "data type", "int", "double", "boolean", "string", "scanner",
  "if", "else", "switch", "for", "while", "do-while", "array", "arraylist",
  "oop", "class", "object", "constructor", "method", "inheritance", "extends",
  "polymorphism", "abstract", "interface", "exception", "try", "catch",
];
const restrictedWords = ["javarice", "java rice", "rice"];

const initialChatHistory = [
  { role: "SYSTEM", message: systemPrompt },
  {
    role: "CHATBOT",
    message:
      "👋 Hi, I’m FusionBot! Ask me anything about Java programming.",
  },
];

const FusionBot = ({ currentUser }) => {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState(initialChatHistory);
  const scrollRef = useRef();

  const scrollToBottom = React.useCallback(() => {
    setTimeout(() => scrollRef?.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const isMessageOnTopic = (message) => {
    const lower = message.toLowerCase();
    const related = javaKeywords.some((k) => lower.includes(k));
    const restricted = restrictedWords.some((w) => lower.includes(w));
    return related && !restricted;
  };

  const saveMessagesToDb = async (messagesToSave) => {
    if (!currentUser) return;
    const records = messagesToSave.map((msg) => ({
      user_id: currentUser.id,
      sender: msg.role === "USER" ? "user" : "bot",
      text: msg.message,
    }));
    await supabase.from("chatbot_history").insert(records);
  };

  const getBotResponse = async (chat, message) => {
    if (!COHERE_API_KEY) {
  return "⚠️ Missing API key configuration. Please contact support.";
}

    try {
      const res = await axios.post(
        "https://api.cohere.ai/v1/chat",
        {
          model: "command-a-03-2025",
          chat_history: chat.filter((m) => m.role !== "SYSTEM"),
          message,
        },
        {
          headers: {
            Authorization: `Bearer ${COHERE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      return res.data?.text?.trim() || "Sorry, I couldn’t find an answer for that.";
    } catch {
      return "⚠️ Oops! Something went wrong. Please try again.";
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setChatHistory([{ role: "CHATBOT", message: "Please log in to use the chatbot." }]);
      return;
    }

    const loadMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("chatbot_history")
        .select("sender, text")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: true });

      if (error || !data?.length) {
        setChatHistory(initialChatHistory);
      } else {
        const history = data.map((m) => ({
          role: m.sender === "user" ? "USER" : "CHATBOT",
          message: m.text,
        }));
        setChatHistory([initialChatHistory[0], ...history]);
      }
      setLoading(false);
    };
    loadMessages();
  }, [currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);

  const handleSend = React.useCallback(async () => {
    if (!inputText.trim() || !currentUser) return;

    const userMsg = { role: "USER", message: inputText.trim() };
    setInputText("");
    setChatHistory((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      let botReply;
      if (isMessageOnTopic(userMsg.message)) {
        botReply = await getBotResponse([...chatHistory, userMsg], userMsg.message);
      } else {
        botReply = "🚫 Sorry, I can only answer questions about Java programming.";
      }
      const botMsg = { role: "CHATBOT", message: botReply };
      setChatHistory((prev) => [...prev, botMsg]);
      saveMessagesToDb([userMsg, botMsg]);
    } finally {
      setLoading(false);
    }
  }, [inputText, currentUser, chatHistory]);

  const handleRefresh = async () => {
    if (!currentUser) return;
    await supabase.from("chatbot_history").delete().eq("user_id", currentUser.id);
    setInputText("");
    setChatHistory(initialChatHistory);
  };

  const chat = chatHistory.filter((m) => m.role !== "SYSTEM");

  return (
    <KeyboardAvoidingView
      style={styles.body}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.chatArea}
          contentContainerStyle={{ paddingBottom: 20 }}
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {chat.map((msg, i) => (
            <View
              key={i}
              style={[
                styles.messageContainer,
                msg.role === "CHATBOT" ? styles.botContainer : styles.userContainer,
              ]}
            >
              {msg.role === "CHATBOT" && (
                <Image
                  source={require("../assets/chatbot-icon.png")}
                  style={styles.botIcon}
                />
              )}
              <View
                style={[
                  styles.message,
                  msg.role === "CHATBOT" ? styles.botMsg : styles.userMsg,
                ]}
              >
                {msg.role === "CHATBOT" ? (
                  <Markdown
  style={{
    body: { color: "#FFFFFF", fontSize: 15, lineHeight: 22 },
    strong: { color: "#FFD700" },

    fence: {
      backgroundColor: "#1E1E1E",
      color: "#FFFFFF",
      borderRadius: 10,
      padding: 10,
      fontFamily: "monospace",
      marginVertical: 8,
    },
    code_block: {
      backgroundColor: "#1E1E1E",
      color: "#FFFFFF",
      borderRadius: 10,
      padding: 10,
      fontFamily: "monospace",
      marginVertical: 8,
    },
    code_inline: {
      backgroundColor: "#333333",
      color: "#FFFFFF",
      borderRadius: 5,
      paddingHorizontal: 6,
      paddingVertical: 2,
      fontFamily: "monospace",
    },
    blockquote: {
      backgroundColor: "rgba(255,255,255,0.2)",
      borderLeftWidth: 4,
      borderLeftColor: "#FFD700",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
  }}
>
  {msg.message}
</Markdown>

                ) : (
                  <Text style={styles.userText}>{msg.message}</Text>
                )}
              </View>
            </View>
          ))}

          {loading && (
            <View style={[styles.messageContainer, styles.botContainer]}>
              <Image
                source={require("../assets/chatbot-icon.png")}
                style={styles.botIcon}
              />
              <View style={[styles.message, styles.botMsg]}>
                <ActivityIndicator color="white" />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask about Java..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            editable={!loading && !!currentUser}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={styles.sendButton}
            disabled={loading || !currentUser}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={!currentUser}
            style={[styles.sendButton, { marginLeft: 6, backgroundColor: "#888" }]}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default FusionBot;
