import React, { useState, useRef, useEffect } from "react";
import {  View,  Text,  TextInput,  TouchableOpacity,  ScrollView,  StyleSheet,  Image,  KeyboardAvoidingView,  Platform,  ActivityIndicator,  Keyboard} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import Markdown from "react-native-markdown-display";
import { COHERE_API_KEY } from "@env";
import styles from "../styles/fusionbot";
import { supabase } from "../utils/supabaseClient";

const systemPrompt = `You are FusionBot, a helpful assistant that only answers questions related to a specific set of Java programming topics.
The allowed topics are:
1. Java Basics: HelloWorld, input/output, date.
2. Variables & Data Types: primitives (int, double, etc.), objects, String, StringBuilder, object lifecycle, System.gc().
3. Operators & Decision Constructs: arithmetic, relational, logical, if-else, switch, equality (== vs .equals()).
4. Arrays & Collections: 1D/2D arrays, ArrayList.
5. Looping Constructs: for, while, do-while, break, continue.
6. Object-Oriented Programming (OOP): classes, objects, constructors, encapsulation (getters/setters), inheritance (extends), polymorphism, abstraction (abstract classes, interfaces), and exception handling (try-catch).
If a user asks a question outside this scope, you must politely state that you can only answer questions about these specific Java topics. Do not answer the off-topic question.`;

const javaKeywords = [
  "java", "jvm", "jdk", "jre", "compile", "run", "program", "code", "syntax", "debugging", "hi", "hello",
  "helloworld", "main", "system.out.println", "input", "output", "scanner", "date",
  "variable", "data type", "primitive", "int", "double", "boolean", "char", "byte", "short", "long", "float",
  "object", "reference", "string", "stringbuilder", "field", "lifecycle", "garbage collection", "system.gc",
  "operator", "arithmetic", "relational", "logical", "precedence", "parentheses", "equality", "==", ".equals",
  "if", "else", "switch", "case",
  "array", "1d", "2d", "multidimensional", "collection", "arraylist", "add", "remove", "get", "size",
  "loop", "while", "for", "do-while", "enhanced-for", "break", "continue",
  "oop", "object-oriented", "class", "object", "field", "constructor", "method", "encapsulation", "private",
  "public", "protected", "getter", "setter", "inheritance", "superclass", "subclass", "extends", "override",
  "tostring", "equals", "polymorphism", "upcasting", "dispatch", "abstraction", "abstract", "interface",
  "implements", "exception", "handling", "try", "catch", "finally", "throw", "throws", "custom exception", "uml"
];
const restrictedWords = ["javarice", "java rice", "rice"];

const initialChatHistory = [
  { role: "SYSTEM", message: systemPrompt },
  { role: "CHATBOT", message: "Hi, I’m FusionBot! You can ask me questions related to Java programming." }
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
    const lowerCaseMessage = message.toLowerCase();
    const isRelated = javaKeywords.some(keyword => lowerCaseMessage.includes(keyword));
    const isRestrictedTopic = restrictedWords.some(word => lowerCaseMessage.includes(word));
    return isRelated && !isRestrictedTopic;
  };

  const saveMessagesToDb = async (messagesToSave) => {
    if (!currentUser) return;
    const records = messagesToSave.map(msg => ({
      user_id: currentUser.id,
      sender: msg.role === 'USER' ? 'user' : 'bot',
      text: msg.message,
    }));
    const { error } = await supabase.from('chatbot_history').insert(records);
    if (error) {
      console.error("Error saving chat history:", error.message);
    }
  };

  const getBotResponse = async (currentChatHistory, userMessage) => {
    try {
      const response = await axios.post(
        "https://api.cohere.ai/v1/chat",
        {
          model: "command-a-03-2025",
          chat_history: currentChatHistory.filter(m => m.role !== 'SYSTEM'),
          message: userMessage,
        },
        {
          headers: {
            Authorization: `Bearer ${COHERE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data?.text?.trim() || "Sorry, I couldn’t find an answer for that.";
    } catch (err) {
      console.error("API Error in handleSend:", err.response?.data || err.message);
      return "Oops! Something went wrong. Please check your connection or try again later.";
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
        .from('chatbot_history')
        .select('sender, text')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        setChatHistory([{ role: "CHATBOT", message: "Could not load previous conversation." }]);
      } else if (data && data.length > 0) {
        const history = data.map(msg => ({
          role: msg.sender === 'user' ? 'USER' : 'CHATBOT',
          message: msg.text
        }));
        setChatHistory([initialChatHistory[0], ...history]); 
      } else {
        setChatHistory(initialChatHistory);
      }
      setLoading(false);
    };

    loadMessages();
  }, [currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading, scrollToBottom]);

  const handleSend = React.useCallback(async () => {
    if (!inputText.trim() || !currentUser) return;

    const userMessageText = inputText.trim();
    const userMessage = { role: "USER", message: userMessageText };
    
    setInputText("");
    setChatHistory(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      let botMessageText;
      if (isMessageOnTopic(userMessageText)) {
        botMessageText = await getBotResponse([...chatHistory, userMessage], userMessageText);
      } else {
        botMessageText = "Sorry, I can only answer questions related to Java programming.";
      }

      const botMessage = { role: "CHATBOT", message: botMessageText };
      setChatHistory(prev => [...prev, botMessage]);
      saveMessagesToDb([userMessage, botMessage]);
    } finally {
      setLoading(false);
    }
  }, [inputText, currentUser, chatHistory]);

  const handleRefresh = React.useCallback(async () => {
    if (!currentUser) return;

    const { error } = await supabase
      .from('chatbot_history')
      .delete()
      .eq('user_id', currentUser.id);

    if (error) {
      console.error("Error clearing conversation:", error);
      alert("Could not clear conversation. Please try again.");
    } else {
      setInputText("");
      setChatHistory(initialChatHistory);
    }
  }, [currentUser]);

  const renderableChat = chatHistory.filter(m => m.role !== 'SYSTEM');

  return (
    <KeyboardAvoidingView
      style={styles.body}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.chatArea}
          contentContainerStyle={{ paddingBottom: 20 }}
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {renderableChat.map((msg, index) => (
            <View
              key={index}
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
                  <Markdown style={{ body: styles.botText }}>{msg.message}</Markdown>
                ) : (
                  <Text style={styles.userText}>
                    {msg.message}
                  </Text>
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
