
import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import { Stack } from "expo-router";
import FloatingChatbot from "../components/FloatingChatbot";
import Constants from "expo-constants";
import styles from "../styles/code";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const DEBUG = true;

const log = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

const {
  JDOODLE_CLIENT_ID,
  JDOODLE_CLIENT_SECRET,
  JDOODLE_RUN_URL,
} = Constants.expoConfig?.extra || {};

export default function CodeSnippets() {
  const [selectedTab, setSelectedTab] = useState("code");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("Output will be displayed here");
  const [isRunning, setIsRunning] = useState(false);
  const [stdin, setStdin] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [completedTopics, setCompletedTopics] = useState(new Set());
  const [activeTopic, setActiveTopic] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const outputScrollRef = useRef(null);
  const showInputPanel = code.includes("Scanner");

  

  // Fetch the current user from SecureStore when the component mounts
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userStr = await SecureStore.getItemAsync("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          setCurrentUser(user);
          log("User loaded for checklist", user);
        }
      } catch (error) {
        log("Failed to load user from secure store", error);
      }
    };
    fetchUser();
  }, []);

  // Load user-specific completed topics from AsyncStorage once the user is identified
  useEffect(() => {
    const loadCompletedTopics = async () => {
      try {        const storageKey = `completed_topics_${currentUser.id}`;
        const savedTopics = await AsyncStorage.getItem(storageKey);
        if (savedTopics !== null) {
          const topicsArray = JSON.parse(savedTopics);
          setCompletedTopics(new Set(topicsArray));
          log("Loaded completed topics from storage", topicsArray);
        }
      } catch (error) {
        log("Failed to load completed topics from storage", error);
      }
    };

    if (currentUser) {
      loadCompletedTopics();
    }
  }, [currentUser]); // This effect runs when the currentUser state is updated

  // Save user-specific completed topics to AsyncStorage whenever they change
  useEffect(() => {
    const saveCompletedTopics = async () => {
      if (!currentUser) return; // Don't save if there's no user

      try {
        const storageKey = `completed_topics_${currentUser.id}`;
        const topicsArray = Array.from(completedTopics);
        await AsyncStorage.setItem(storageKey, JSON.stringify(topicsArray));
        log(`Saved ${topicsArray.length} completed topics for user ${currentUser.id}`);
      } catch (error) {
        log("Failed to save completed topics to storage", error);
      }
    };

    saveCompletedTopics();
  }, [completedTopics]);
  
   const javaTopics = {
    "Java Basics": [
      "Run HelloWorld program",
      "Hello with name input/output",
      "Hello with name and date"
    ],
    "Variables & Data Types": [
      "Declare and initialize primitive variables (int, double, boolean, etc.)",
      "Declare and initialize object references (String, custom objects)",
      "Read and write to object fields",
      "Show object lifecycle (creation, dereference, garbage collection with System.gc())",
      "Call methods on objects",
      "String and StringBuilder manipulation"
    ],
    "Operators & Decision Constructs": [
      "Basic arithmetic, relational, logical operators",
      "Override precedence with parentheses",
      "Test equality (== vs. .equals())",
      "If-else statements",
      "Switch statement"
    ],
    "Arrays & Collections": [
      "Declare, initialize, and use a 1D array",
      "Declare, initialize, and use a 2D array",
      "Use an ArrayList (add, remove, get elements)"
    ],
    "Object-Oriented Programming": [
      "Create a class with fields and methods",
      "Use constructors to initialize objects",
      "Call methods on objects",
      "Object-Oriented Programming Example"
    ]
  };


  const codeTemplates = {
    "Run HelloWorld program": `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,

    "Hello with name input/output": `import java.util.Scanner;

public class HelloName {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.println("Enter your name: ");
        
        if (scanner.hasNextLine()) {
            String name = scanner.nextLine();
            System.out.println("Hello, " + name + "!");
        }
        
        scanner.close();
    }
}`,

    "Hello with name and date": `import java.util.Scanner;
import java.time.LocalDate;

public class HelloNameDate {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.println("Enter your name: ");

        if (scanner.hasNextLine()) {
            String name = scanner.nextLine();
            LocalDate today = LocalDate.now();
            System.out.println("Hello, " + name + "! Today is " + today + ".");
        }

        scanner.close();
    }
}`,

    "Declare and initialize primitive variables (int, double, boolean, etc.)": `public class Variables {
    public static void main(String[] args) {
        int age = 25;
        double height = 5.9;
        boolean isStudent = true;
        char grade = 'A';
        
        System.out.println("Age: " + age);
        System.out.println("Height: " + height);
        System.out.println("Is Student: " + isStudent);
        System.out.println("Grade: " + grade);
    }
}`,

    "Declare and initialize object references (String, custom objects)": `public class ObjectReferences {
    public static void main(String[] args) {
        String name = "Francine";
        Object obj = new Object();
        
        System.out.println("Name: " + name);
        System.out.println("Object: " + obj.toString());
    }
}`,

    "Read and write to object fields": `class Person {
    String name;
    int age;
}

public class ObjectFields {
    public static void main(String[] args) {
        Person p = new Person();
        p.name = "Francine";
        p.age = 20;

        System.out.println("Name: " + p.name);
        System.out.println("Age: " + p.age);
    }
}`,

    "Basic arithmetic, relational, logical operators": `public class Operators {
    public static void main(String[] args) {
        int a = 10, b = 5;
        System.out.println("a + b = " + (a + b));
        System.out.println("a > b? " + (a > b));
        System.out.println("Logical AND: " + ((a > 0) && (b > 0)));
    }
}`,

    "If-else statements": `public class IfElseExample {
    public static void main(String[] args) {
        int num = 10;
        if(num > 0) {
            System.out.println("Positive number");
        } else {
            System.out.println("Non-positive number");
        }
    }
}`,

    "Switch statement": `public class SwitchExample {
    public static void main(String[] args) {
        int day = 3;
        switch(day) {
            case 1: System.out.println("Monday"); break;
            case 2: System.out.println("Tuesday"); break;
            case 3: System.out.println("Wednesday"); break;
            default: System.out.println("Another day");
        }
    }
}`,

    "Declare, initialize, and use a 1D array": `public class Array1D {
    public static void main(String[] args) {
        int[] nums = {1, 2, 3, 4, 5};
        for(int n : nums) {
            System.out.println(n);
        }
    }
}`,

    "Declare, initialize, and use a 2D array": `public class Array2D {
    public static void main(String[] args) {
        int[][] matrix = {{1,2},{3,4}};
        for(int i=0;i<matrix.length;i++){
            for(int j=0;j<matrix[i].length;j++){
                System.out.println("matrix[" + i + "][" + j + "] = " + matrix[i][j]);
            }
        }
    }
}`,

    "Use an ArrayList (add, remove, get elements)": `import java.util.ArrayList;

public class ArrayListExample {
    public static void main(String[] args) {
        ArrayList<String> list = new ArrayList<>();
        list.add("Apple");
        list.add("Banana");
        list.add("Cherry");
        for(String item : list) {
            System.out.println(item);
        }
    }
}`,

    "Create a class with fields and methods": `class Car {
    String model;
    int year;

    void display() {
        System.out.println(model + " - " + year);
    }
}

public class CarExample {
    public static void main(String[] args) {
        Car c = new Car();
        c.model = "Toyota";
        c.year = 2022;
        c.display();
    }
}`,

    "Use constructors to initialize objects": `class Book {
    String title;
    Book(String t) {
        title = t;
    }
}

public class ConstructorExample {
    public static void main(String[] args) {
        Book b = new Book("Java 101");
        System.out.println("Book title: " + b.title);
    }
}`,

    "Object-Oriented Programming Example": `class Animal {
    void sound() {
        System.out.println("Some sound");
    }
}

class Dog extends Animal {
    void sound() {
        System.out.println("Bark");
    }
}

public class OOPExample {
    public static void main(String[] args) {
        Animal a = new Dog();
        a.sound(); // Polymorphism
    }
}`,

    // --- Existing useful templates ---
    "Simple addition program": `import java.util.Scanner;

public class AddNumbers {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.println("Enter first number: ");

        if (scanner.hasNextInt()) {
            int a = scanner.nextInt();
            System.out.println("Enter second number: ");
            if (scanner.hasNextInt()) {
                int b = scanner.nextInt();
                System.out.println("The sum is: " + (a + b));
            }
        }
        scanner.close();
    }
}`,
  };

  const executeOnJDoodle = async (javaSource, stdinInput = "") => {
    log("Preparing JDoodle request", { stdinInput, javaSourceLength: javaSource.length });

    const payload = {
      clientId: JDOODLE_CLIENT_ID,
      clientSecret: JDOODLE_CLIENT_SECRET,
      script: javaSource,
      language: "java",
      versionIndex: "3",
      stdin: stdinInput,
    };

    try {
      const resp = await fetch(JDOODLE_RUN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        log("JDoodle HTTP error", { status: resp.status, response: txt });
        throw new Error(`JDoodle HTTP ${resp.status}`);
      }

      const json = await resp.json();
      log("JDoodle response received", json);
      return { success: true, output: json.output || "", statusCode: json.statusCode || resp.status };
    } catch (err) {
      log("JDoodle execution failed", err);
      throw err;
    }
  };

  const proceedWithRun = async () => {
    setOutput("Running code...");
    setIsRunning(true);
    setSelectedTab("output");
  
    try {
      log("Executing on JDoodle with provided stdin...");
      const result = await executeOnJDoodle(code, stdin);
      log("JDoodle result processed", result);
  
      const programOutput = result.output?.trim() || "No output received.";
      let finalOutput = "";

      if (stdin.trim()) {
        const formattedInput = stdin.trim().split('\n').map(line => `> ${line}`).join('\n');
        finalOutput += `Your Input:\n${formattedInput}\n\n--- Output ---\n`;
      }
      finalOutput += programOutput;
      setOutput(finalOutput);
      
      if (result.success) {
        checkCodeCompletion();
      }
    } catch (error) {
      setOutput("❌ Code execution failed: " + error.message);
      log("Code run error", error);
    } finally {
      log("Run complete");
      setIsRunning(false);
    }
  }

  const runCode = () => {
    log("Starting new run", { codeLength: code.length, stdinLength: stdin.length });

    if (!code.trim()) {
      Alert.alert("Error", "Please enter some code to run");
      log("Run aborted — empty code");
      return;
    }

    if (showInputPanel && !stdin.trim()) {
      Alert.alert(
        "Input Required",
        "This code needs input to run. Please provide the required data in the input box below the code editor first.",
        [{ text: "OK" }]
      );
      log("Run aborted - input required but not provided.");
      return;
    }

    proceedWithRun();
  };

  const hasException = (text) => {
    const lower = text.toLowerCase();
    return lower.includes("exception in thread") || lower.includes("error:");
  }

  const checkCodeCompletion = (topicToCheck = activeTopic) => {
     if (!topicToCheck) return;
 
     const codeLower = code.toLowerCase();
     const newCompleted = new Set(completedTopics);
     const checkAndAdd = (topic, keywords) => {
       if (keywords.every(kw => codeLower.includes(kw))) {
         if (!newCompleted.has(topic)) {
           newCompleted.add(topic);
           log(`Checklist: "${topic}" marked complete`);
         }
       }
     };
 
     const topicChecks = {
       "Run HelloWorld program": ["class helloworld", "hello, world!"],
       "Hello with name input/output": ["class helloname", "scanner", "nextline"],
       "Hello with name and date": ["class hellonamedate", "localdate"],
       "Declare and initialize primitive variables (int, double, boolean, etc.)": ["class variables", "int age", "double height"],
       "Declare and initialize object references (String, custom objects)": ["class objectreferences", "string name", "object obj"],
       "Read and write to object fields": ["class person", "p.name", "p.age"],
       "Basic arithmetic, relational, logical operators": ["class operators", "a + b", "a > b"],
       "If-else statements": ["class ifelseexample", "if(num > 0)"],
       "Switch statement": ["class switchexample", "switch(day)"],
       "Declare, initialize, and use a 1D array": ["class array1d", "int[] nums"],
       "Declare, initialize, and use a 2D array": ["class array2d", "int[][] matrix"],
       "Use an ArrayList (add, remove, get elements)": ["class arraylistexample", "arraylist<string>"],
       "Create a class with fields and methods": ["class car", "void display()"],
       "Use constructors to initialize objects": ["class book", "book(string t)"],
       "Object-Oriented Programming Example": ["class animal", "class dog extends animal", "a.sound()"],
       "Simple addition program": ["class addnumbers", "enter first number"],
     };
 
     if (topicChecks[topicToCheck]) {
       checkAndAdd(topicToCheck, topicChecks[topicToCheck]);
     }
 
     if (newCompleted.size > completedTopics.size) {
       setCompletedTopics(newCompleted);
     }
   };
  const loadTemplate = (topic) => {
    if (codeTemplates[topic]) {
      Alert.alert("Load Template", `Load template for "${topic}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load Template",
          onPress: () => {
            setCode(codeTemplates[topic]);
            setActiveTopic(topic);
            setSelectedTab("code");
            setStdin("");
            setOutput("Output will be displayed here");
          },
        },
      ]);
    } else {
      Alert.alert("No Template", `A code template for "${topic}" is not yet available.`);
    }
  };

  const clearCode = () => {
    Alert.alert("Clear Code", "Clear the code editor?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        onPress: () => {
          setCode("");
          setActiveTopic(null);
          setStdin("");
          setOutput("Output will be displayed here");
        },
      },
    ]);
  };

  const downloadCode = async () => {
    if (!code.trim()) {
      Alert.alert("No Code", "There is no code to download.");
      return;
    }

    setIsDownloading(true);
    let fileName = "MyCode.java";
    // Try to find the class name to use as the filename
    const match = code.match(/public class (\w+)/);
    if (match && match[1]) {
      fileName = `${match[1]}.java`;
    }

    try {
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, code, {
        encoding: 'utf8',
      });

      log(`Code saved to ${fileUri}`);

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing not available", "Sharing is not available on your platform.");
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch (error) {
      log("Error downloading code", error);
      Alert.alert("Error", "Could not download the file.");
    } finally {
      setIsDownloading(false);
    }
  };
  const testConnection = async () => {
    setIsRunning(true);
    setOutput("Testing JDoodle connection...");
    setSelectedTab("output");
    log("Testing JDoodle connection...");

    try {
      const testCode = `public class Test { public static void main(String[] args) { System.out.println("Connection test successful!"); } }`;
      const res = await executeOnJDoodle(testCode);
      setOutput("✅ " + (res.output || "") + "\nConnected to JDoodle.");
      log("Connection test passed", res);
    } catch (error) {
      setOutput("❌ Connection failed: " + error.message);
      log("Connection test failed", error);
    } finally {
      setIsRunning(false);
    }
  };


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -150}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <FontAwesome5 style={styles.icon} name="code" size={24} color="white" />
            <Text style={styles.headerText}>JAVA IDE & CHECKLIST</Text>
          </View>

          <View style={styles.fileNameContainer}>
            <TouchableOpacity style={styles.addButton} onPress={clearCode}>
              <FontAwesome5 name="trash" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { marginLeft: 5 }]}
              onPress={downloadCode}
              disabled={isDownloading}
            >
              {isDownloading ? <ActivityIndicator size="small" color="white" /> : <FontAwesome5 name="download" size={16} color="white" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.runButton, { marginLeft: 5, paddingHorizontal: 15 }]}
              onPress={() => runCode()}
              disabled={isRunning}
            >
              <Text style={styles.runButtonText}>{isRunning ? "RUNNING..." : "RUN"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testButton, { marginLeft: 5 }]}
              onPress={testConnection}
              disabled={isRunning}
            >
              <FontAwesome5 name="wifi" size={12} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabContainer}>
            {["code", "output", "checklist"].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, selectedTab === tab && styles.activeTab]}
                onPress={() => setSelectedTab(tab)}
              >
                <Text style={styles.tabText}>{tab.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.contentContainer}> 
            {selectedTab === "code" && ( 
              <View style={{ flex: 1 }}>
                <ScrollView style={{ flex: 1 }} nestedScrollEnabled={true}>
                  <TextInput
                    style={styles.codeInput}
                    multiline
                    value={code}
                    onChangeText={setCode}
                    placeholder="Write your Java code here..."
                    placeholderTextColor="#888"
                    scrollEnabled={false}
                  />
                </ScrollView>
                {showInputPanel && (
                  <ScrollView style={{ flex: 0.2, borderTopWidth: 1, borderColor: '#333' , marginTop: 10}} nestedScrollEnabled={true}>
                    <TextInput
                      style={[styles.codeInput, { height: 'auto', minHeight: 100, fontSize: 14 }]}
                      multiline
                      value={stdin}
                      onChangeText={setStdin}
                      placeholder="Enter all program input here, one line at a time..."
                      placeholderTextColor="#888"
                      scrollEnabled={false}
                    />
                  </ScrollView>
                )}
              </View>
            )}

            {selectedTab === "output" && (
              <View style={styles.outputContainer}>
                <ScrollView style={{ flex: 1 }} ref={outputScrollRef}>
                  <Text selectable style={styles.outputText}>
                    {output}
                  </Text>
                </ScrollView>
              </View>
            )}

            {selectedTab === "checklist" && ( 
              <ScrollView>
                <View style={[styles.checklistContainer, { marginBottom: 100 }]}>
                  <Text style={styles.checklistTitle}>Java Programming Concepts</Text>
                  <Text style={styles.progressText}>
                    Progress: {completedTopics.size} / {Object.values(javaTopics).flat().length} completed
                  </Text>
                  {Object.entries(javaTopics).map(([category, topics]) => (
                    <View key={category} style={styles.categoryContainer}>
                      <Text style={styles.categoryTitle}>{category}</Text>
                      {topics.map((topic, index) => (
                        <TouchableOpacity key={index} style={styles.topicItem} onPress={() => loadTemplate(topic)}>
                          <View style={styles.topicContent}>
                            <View style={[styles.checkbox, completedTopics.has(topic) && styles.checkboxCompleted]}><FontAwesome5 name="check" size={12} color={completedTopics.has(topic) ? "white" : "transparent"} /></View>
                            <Text style={[styles.topicText, completedTopics.has(topic) && styles.topicTextCompleted]}>{topic}</Text>
                          </View>
                          <FontAwesome5 name="code" size={12} color="#046a38" style={{ padding: 5 }} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View> 
        </View>
        
      </KeyboardAvoidingView>
      <FloatingChatbot />
      <BottomNav />
    </>
  );
}
