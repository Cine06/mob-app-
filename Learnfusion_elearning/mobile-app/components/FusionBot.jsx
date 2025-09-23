import React, { useState, useRef, useEffect } from "react";
import {  View,  Text,  TextInput,  TouchableOpacity,  ScrollView,  StyleSheet,  Image,  KeyboardAvoidingView,  Platform,  ActivityIndicator,  Keyboard} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const FusionBot = ({ currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      role: "SYSTEM",
      message: systemPrompt,
    },
  ]);
  const scrollRef = useRef();

  const scrollToBottom = () => {
    setTimeout(() => scrollRef?.current?.scrollToEnd({ animated: true }), 100);
  };

  useEffect(() => {
    if (!currentUser) {
      setMessages([
        { sender: "bot", text: "Please log in to use the chatbot." },
      ]);
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
        setMessages([{ sender: "bot", text: "Could not load previous conversation." }]);
      } else if (data.length > 0) {
        setMessages(data);
        const history = data.map(msg => ({
          role: msg.sender === 'user' ? 'USER' : 'CHATBOT',
          message: msg.text
        }));
        setChatHistory(prev => [prev[0], ...history]);
      } else {
        setMessages([{ sender: "bot", text: "Hi, I’m FusionBot! You can ask me questions related to Java programming." }]);
      }
      setLoading(false);
    };

    loadMessages();
  }, [currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser) return;
    const userMessage = inputText.trim();

    const javaKeywords = [ // Expanded keywords for better client-side filtering
      // General
      "java", "jvm", "jdk", "jre", "compile", "run", "program", "code", "syntax", "debugging", "hi", "hello",
      // Basics
      "helloworld", "main", "system.out.println", "input", "output", "scanner", "date",
      // Variables & Data Types
      "variable", "data type", "primitive", "int", "double", "boolean", "char", "byte", "short", "long", "float",
      "object", "reference", "string", "stringbuilder", "field", "lifecycle", "garbage collection", "system.gc",
      // Operators & Decision Constructs
      "operator", "arithmetic", "relational", "logical", "precedence", "parentheses", "equality", "==", ".equals",
      "if", "else", "switch", "case",
      // Arrays & Collections
      "array", "1d", "2d", "multidimensional", "collection", "arraylist", "add", "remove", "get", "size",
      // Looping Constructs
      "loop", "while", "for", "do-while", "enhanced-for", "break", "continue",
      // OOP
      "oop", "object-oriented", "class", "object", "field", "constructor", "method", "encapsulation", "private",
      "public", "protected", "getter", "setter", "inheritance", "superclass", "subclass", "extends", "override",
      "tostring", "equals", "polymorphism", "upcasting", "dispatch", "abstraction", "abstract", "interface",
      "implements", "exception", "handling", "try", "catch", "finally", "throw", "throws", "custom exception", "uml"
    ];
    const restrictedWords = ["javarice", "java rice", "rice"];

    const isJavaRelated = javaKeywords.some(keyword =>
      userMessage.toLowerCase().includes(keyword)
    );
    const isRestricted = restrictedWords.some(restricted =>
      userMessage.toLowerCase().includes(restricted)
    );

    const userMessageObject = { sender: "user", text: userMessage };
    setMessages((prevMessages) => [...prevMessages, userMessageObject]);
    setInputText("");
    setLoading(true);

    if (!isJavaRelated || isRestricted) {
      const botMessage = {
        sender: "bot",
        text: "Sorry, I can only answer questions related to Java programming.",
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      
      const { error: saveError } = await supabase
      .from('chatbot_history')
      .insert([
         { user_id: currentUser.id, sender: 'user', text: userMessage },
          { user_id: currentUser.id, sender: 'bot', text: botMessage.text }
        ]);

      if (saveError) {
          console.error("Error saving off-topic message:", saveError.message);
      }


      setChatHistory(prev => [...prev, { role: "USER", message: userMessage }, { role: "CHATBOT", message: botMessage.text }]);

      setLoading(false);
      return;
    }

    const apiChatHistory = chatHistory
      .filter((msg) => msg.role !== "SYSTEM")
      .map(({ role, message }) => ({ role, message }));

    try {
      const response = await axios.post(
        "https://api.cohere.ai/v1/chat",
        {
          model: "command-a-03-2025",
          chat_history: apiChatHistory,
          message: userMessage,
        },
        {
          headers: {
            Authorization: `Bearer ${COHERE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const botReplyText = response.data?.text?.trim() || "Sorry, I couldn’t find an answer for that.";
      const botMessageObject = {
        sender: "bot",
        text: botReplyText,
      };

      setMessages((prevMessages) => [...prevMessages, botMessageObject]);
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { role: "USER", message: userMessage },
        { role: "CHATBOT", message: botReplyText },
      ]);

      const { error: insertError } = await supabase.from('chatbot_history').insert([
        { user_id: currentUser.id, sender: 'user', text: userMessage },
        { user_id: currentUser.id, sender: 'bot', text: botReplyText }
      ]);

      if (insertError) {
        console.error("Error saving chat history:", insertError.message);
      }
    } catch (err) {
      console.error("API Error in handleSend:", err.response?.data || err.message);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          sender: "bot",
          text: "Oops! Something went wrong. Please check your connection or try again later.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentUser) return;

    const { error } = await supabase
      .from('chatbot_history')
      .delete()
      .eq('user_id', currentUser.id);

    if (error) {
      console.error("Error clearing conversation:", error);
      alert("Could not clear conversation. Please try again.");
    } else {
      setMessages([
        {
          sender: "bot",
          text: "Hi, I’m FusionBot! You can ask me questions related to Java programming.",
        },
      ]);
      setInputText("");
      setChatHistory([{ role: "SYSTEM", message: systemPrompt }]);
    }
  };

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
          {messages.map((msg, index) => (
            <View
              key={index}
              style={[
                styles.messageContainer,
                msg.sender === "bot" ? styles.botContainer : styles.userContainer,
              ]}
            >
              {msg.sender === "bot" && (
                <Image
                  source={require("../assets/chatbot-icon.png")}
                  style={styles.botIcon}
                />
              )}
              <View
                style={[
                  styles.message,
                  msg.sender === "bot" ? styles.botMsg : styles.userMsg,
                ]}
              >
                <Text style={msg.sender === "bot" ? styles.botText : styles.userText}>
                  {msg.text}
                </Text>
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
