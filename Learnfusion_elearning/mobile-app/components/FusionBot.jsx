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
const lessonHandouts = [
  // HANDOUT 1: JAVA BASICS
  {
    question: "What is Java?",
    answer:
      "Java is a high-level, object-oriented programming language that is platform-independent and allows developers to write code once and run it anywhere. It was designed to be simple, secure, and robust."
  },
  {
    question: "What is the structure of a basic Java program?",
    answer:
      "A basic Java program includes a class definition, a main method (public static void main), and statements enclosed in curly braces { }. Every Java program starts executing from the main method."
  },
  {
    question: "What are Java data types?",
    answer:
      "Java data types define the kind of data a variable can hold. These include primitive types such as int, float, double, char, and boolean, as well as non-primitive types like String, arrays, and classes."
  },
  {
    question: "What is type casting in Java?",
    answer:
      "Type casting in Java is the process of converting a variable from one data type to another, such as converting an int to a double or vice versa."
  },
  {
    question: "What are Java identifiers and keywords?",
    answer:
      "Identifiers are names given to variables, methods, classes, or objects, while keywords are reserved words that have predefined meanings in Java, such as class, public, static, and void."
  },

  // HANDOUT 2: OPERATORS AND CONTROL STRUCTURES
  {
    question: "What are Java operators?",
    answer:
      "Java operators are symbols that perform operations on variables and values. They include arithmetic, relational, and logical operators."
  },
  {
    question: "What is the purpose of decision-making statements in Java?",
    answer:
      "Decision-making statements like if, if-else, and switch are used to execute different blocks of code based on conditions."
  },
  {
    question: "What are looping statements in Java?",
    answer:
      "Looping statements such as for, while, and do-while allow repeated execution of a block of code as long as a condition is true."
  },
  {
    question: "What is the difference between break and continue statements?",
    answer:
      "The break statement terminates a loop or switch statement completely, while continue skips the current iteration and proceeds to the next one."
  },
  {
    question: "What is an ArrayList in Java?",
    answer:
      "An ArrayList is a resizable array that allows elements to be added, removed, or accessed dynamically without a fixed size limit."
  },

  // HANDOUT 3: METHODS AND CLASSES
  {
    question: "What is a method in Java?",
    answer:
      "A method in Java is a block of code that performs a specific task, can be reused, and is called by its name when needed."
  },
  {
    question: "What are the advantages of using methods?",
    answer:
      "Methods help reduce code duplication, improve readability, and make programs easier to maintain and debug."
  },
  {
    question: "What is a class in Java?",
    answer:
      "A class is a blueprint for creating objects. It defines the properties (fields) and behaviors (methods) that objects of that class will have."
  },
  {
    question: "What is an object in Java?",
    answer:
      "An object is an instance of a class that has state (attributes) and behavior (methods)."
  },
  {
    question: "What is the purpose of constructors in Java?",
    answer:
      "Constructors are special methods used to initialize objects when they are created."
  },

  // HANDOUT 4: OBJECT-ORIENTED PROGRAMMING (OOP) PRINCIPLES
  {
    question: "What are the four main principles of OOP in Java?",
    answer:
      "The four main principles are encapsulation, inheritance, polymorphism, and abstraction."
  },
  {
    question: "What is encapsulation?",
    answer:
      "Encapsulation is the process of bundling data (variables) and methods that operate on that data into a single unit (class) and restricting direct access to it."
  },
  {
    question: "What is inheritance in Java?",
    answer:
      "Inheritance allows one class to acquire the properties and behaviors of another class, promoting code reusability."
  },
  {
    question: "What is polymorphism in Java?",
    answer:
      "Polymorphism allows objects to take on multiple forms, enabling methods to perform different tasks based on the object that invokes them."
  },
  {
    question: "What is abstraction in Java?",
    answer:
      "Abstraction is the concept of hiding complex implementation details and showing only essential features of an object."
  },

  // HANDOUT 5: OBJECT-ORIENTED ANALYSIS AND DESIGN (OOAD)
  {
    question: "What is Object-Oriented Analysis and Design (OOAD)?",
    answer:
      "OOAD is a software development approach that focuses on identifying and organizing a system’s components into objects that combine both data and behavior."
  },
  {
    question: "What are the three phases of OOAD?",
    answer:
      "The three main phases of OOAD are Object-Oriented Analysis (OOA), Object-Oriented Design (OOD), and Object-Oriented Implementation (OOI)."
  },
  {
    question: "What are the core principles of OOAD?",
    answer:
      "OOAD uses the same principles as OOP: Abstraction, Encapsulation, Inheritance, and Polymorphism."
  },
  {
    question: "What is UML in software design?",
    answer:
      "UML (Unified Modeling Language) is a standard way to visualize the structure and behavior of a software system before coding begins."
  },
  {
    question: "What is a Use Case Diagram?",
    answer:
      "A Use Case Diagram shows how users (actors) interact with the system by depicting system functionality from the user’s perspective."
  },
  {
    question: "What is a Class Diagram?",
    answer:
      "A Class Diagram represents the static structure of a system, showing classes, their attributes, methods, and relationships between classes."
  },
  {
    question: "What is a Sequence Diagram?",
    answer:
      "A Sequence Diagram describes how objects communicate over time by showing the sequence of message exchanges between them."
  },
  {
    question: "What is an Activity Diagram?",
    answer:
      "An Activity Diagram models the workflow or processes in a system, showing the flow of control from one activity to another."
  },

  // HANDOUT 6: SOFTWARE DEVELOPMENT PROCESS AND MODELING
  {
    question: "What is the Software Development Process?",
    answer:
      "The Software Development Process is a structured series of steps used to design, build, test, and maintain software systems to meet user needs."
  },
  {
    question: "What are the phases of the Software Development Life Cycle (SDLC)?",
    answer:
      "The SDLC includes six phases: Planning and Requirement Analysis, Defining Requirements, Design, Development, Testing, and Deployment and Maintenance."
  },
  {
    question: "What is the purpose of the Planning and Requirement Analysis phase?",
    answer:
      "This phase defines the project’s objectives, scope, and feasibility, assessing constraints and identifying risks to create a clear project plan."
  },
  {
    question: "What happens during the Design phase?",
    answer:
      "In the Design phase, developers create technical blueprints using diagrams like UML, DFDs, and ERDs to outline software structure and data flow."
  },
  {
    question: "What is software modeling?",
    answer:
      "Software modeling involves creating simplified representations of software systems before coding to visualize structure, behavior, and data flow."
  },
  {
    question: "What are the common software development models?",
    answer:
      "The most common models are the Waterfall Model, Iterative Model, and Agile Model."
  },
  {
    question: "What is the Waterfall Model?",
    answer:
      "The Waterfall Model is a linear and sequential approach where each phase must be completed before moving to the next."
  },
  {
    question: "What is the Iterative Model?",
    answer:
      "The Iterative Model focuses on building and improving software through repeated cycles or iterations, allowing feedback after each version."
  },
  {
    question: "What is the Agile Model?",
    answer:
      "The Agile Model is a flexible and collaborative approach that emphasizes continuous improvement and adaptability throughout development."
  },
  {
    question: "What are common system modeling tools and techniques?",
    answer:
      "Common tools and techniques include UML, Data Flow Diagrams (DFD), Entity-Relationship Diagrams (ERD), and Flowcharts."
  }
];
const javaKeywords = [
  "java", "jvm", "jdk", "jre", "compile", "run", "program", "code", "syntax",
  "variable", "data type", "int", "double", "boolean", "string", "scanner",
  "if", "else", "switch", "for", "while", "do-while", "array", "arraylist",
  "oop", "class", "object", "constructor", "method", "inheritance", "extends",
  "polymorphism", "encapsulation", "abstract", "interface", "exception", "try", "catch", "ooad",
  "uml", "sdlc", "waterfall", "agile", "iterative", "diagram", "modeling",
  "analysis", "design",
];
const restrictedWords = ["javarice", "java rice", "rice"];

const stopWords = new Set(["what", "is", "the", "a", "an", "of", "in", "are", "for", "to", 
                           "ano", "ang", "mga", "sa", "ng", "at", "ay", "para", "tungkol" 
                          ]);

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

  const normalizeString = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

  const isMessageOnTopic = (message) => {
    const lower = message.toLowerCase();
    const hasKeywords = javaKeywords.some((k) => lower.includes(k));
    const related = hasKeywords || findFaqAnswer(message) !== null;
    const restricted = restrictedWords.some((w) => lower.includes(w));
    return related && !restricted;
  };

  const findFaqAnswer = (message) => {
    const normalizedMessage = normalizeString(message);
    if (!normalizedMessage) return null;
  
    let bestMatch = null;
    let bestMatchLength = 0;
  
    for (const faq of lessonHandouts) {
      const normalizedFaqQuestion = normalizeString(faq.question);
      if (normalizedFaqQuestion.includes(normalizedMessage) && normalizedFaqQuestion.length > bestMatchLength) {
        bestMatch = faq;
        bestMatchLength = normalizedFaqQuestion.length;
      }
    }

    return bestMatch ? bestMatch.answer : null;
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

  const getBotResponse = async (chat, message, contextDocs) => {
    if (!COHERE_API_KEY) {
  return "⚠️ Missing API key configuration. Please contact support.";
}

    const requestBody = {
      model: "command-a-03-2025",
      chat_history: chat.filter((m) => m.role !== "SYSTEM"),
      message,
    };

    if (contextDocs && contextDocs.length > 0) {
      requestBody.documents = contextDocs;
    }

    try {
      const res = await axios.post(
        "https://api.cohere.ai/v1/chat",
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${COHERE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      return (
        res.data?.text?.trim() || "Sorry, I couldn’t find an answer for that."
      );
    } catch (error) {
      console.error(
        "Error calling Cohere API:",
        error.response ? error.response.data : error.message
      );
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
      if (isMessageOnTopic(userMsg.message) || findFaqAnswer(userMsg.message)) {
        const faqAnswer = findFaqAnswer(userMsg.message);
        if (faqAnswer) {
          botReply = faqAnswer;
        } else {
          const contextDocuments = lessonHandouts.map((faq) => ({
            title: faq.question,
            snippet: faq.answer,
          }));
          botReply = await getBotResponse([...chatHistory, userMsg], userMsg.message, contextDocuments);
        }
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
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
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
                  <Markdown style={markdownStyles}>{msg.message}</Markdown>
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

const markdownStyles = StyleSheet.create({
  body: { color: "#FFFFFF", fontSize: 15, lineHeight: 22 },
  strong: { color: "#FFD700" },
  fence: {
    backgroundColor: "#1E1E1E",
    color: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    marginVertical: 8,
  },
  code_block: {
    backgroundColor: "#1E1E1E",
    color: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    marginVertical: 8,
  },
  code_inline: {
    backgroundColor: "#333333",
    color: "#FFFFFF",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  blockquote: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderLeftWidth: 4,
    borderLeftColor: "#FFD700",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
});

export default FusionBot;