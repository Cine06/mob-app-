
import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
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

const defaultFile = { id: 1, name: "Main.java", content: "" };

export default function CodeSnippets() {
  const [selectedTab, setSelectedTab] = useState("code");
  const [files, setFiles] = useState([defaultFile]);
  const [activeFileId, setActiveFileId] = useState(1);
  const [output, setOutput] = useState("Output will be displayed here");
  const [isRunning, setIsRunning] = useState(false);
  const [stdin, setStdin] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [completedTopics, setCompletedTopics] = useState(new Set());
  const [activeTopic, setActiveTopic] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const outputScrollRef = useRef(null);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const showInputPanel = files.some(f => f.content.includes("Scanner"));

  

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
  }, [currentUser]); 

  useEffect(() => {
    const saveCompletedTopics = async () => {
      if (!currentUser) return; 

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
      "Use Getters and Setters",
      "Demonstrate Encapsulation",
      "Demonstrate Inheritance & Polymorphism",
      "Demonstrate Abstraction"
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

    "Show object lifecycle (creation, dereference, garbage collection with System.gc())": `class MyObject {
    private String name;

    public MyObject(String name) {
        this.name = name;
        System.out.println(this.name + " created.");
    }

    @Override
    protected void finalize() throws Throwable {
        System.out.println(this.name + " is being garbage collected.");
    }
}

public class ObjectLifecycle {
    public static void main(String[] args) {
        System.out.println("--- Creating object ---");
        MyObject obj1 = new MyObject("Object 1"); // 1. Creation
        System.out.println("--- Dereferencing object ---");
        obj1 = null; // 2. Dereference
        System.out.println("--- Suggesting Garbage Collection ---");
        System.gc(); // 3. Suggest GC
    }
}`,
    "Call methods on objects": `class Calculator {
    // Method with no return value (void)
    public void displayMessage() {
        System.out.println("Hello from Calculator!");
    }

    // Method with a return value (int)
    public int add(int a, int b) {
        return a + b;
    }
}

public class MethodCallExample {
    public static void main(String[] args) {
        // Create a Calculator object
        Calculator myCalc = new Calculator();

        // 1. Call a method that doesn't return a value
        myCalc.displayMessage();

        // 2. Call a method that returns a value and store it
        int sum = myCalc.add(5, 7);
        System.out.println("The sum is: " + sum);
    }
}`,
    "String and StringBuilder manipulation": `public class StringManipulation {
    public static void main(String[] args) {
        // 1. String (immutable)
        System.out.println("--- String (Immutable) ---");
        String str1 = "Hello";
        String str2 = str1 + ", World!"; // Creates a new string object
        System.out.println("Original String: " + str1);
        System.out.println("Concatenated String: " + str2);

        // 2. StringBuilder (mutable)
        System.out.println("\\n--- StringBuilder (Mutable) ---");
        StringBuilder sb = new StringBuilder("Java");
        System.out.println("Initial StringBuilder: " + sb);

        // Append
        sb.append(" is powerful");
        System.out.println("After append: " + sb);

        // Insert
        sb.insert(5, "Programming ");
        System.out.println("After insert: " + sb);

        // Reverse
        sb.reverse();
        System.out.println("After reverse: " + sb);
    }
}`,
    "Override precedence with parentheses": `public class Precedence {
    public static void main(String[] args) {
        int a = 5, b = 10, c = 2;
        
        // Default precedence: multiplication (*) before addition (+)
        int result1 = a + b * c; // 5 + (10 * 2) = 25
        System.out.println("Default precedence (a + b * c): " + result1);
        
        // Overriding precedence with parentheses
        int result2 = (a + b) * c; // (5 + 10) * 2 = 30
        System.out.println("Overridden with parentheses ((a + b) * c): " + result2);
    }
}`,

    "Test equality (== vs. .equals())": `public class EqualityTest {
    public static void main(String[] args) {
        // == with primitives (compares values)
        int x = 10;
        int y = 10;
        System.out.println("--- Primitives ---");
        System.out.println("x == y: " + (x == y)); // true
        
        // == vs .equals() with Objects (String)
        String s1 = "hello"; // String literal
        String s2 = "hello"; // String literal, points to same object in pool
        String s3 = new String("hello"); // New object in memory
        
        System.out.println("\\n--- Objects (String) ---");
        System.out.println("s1 == s2: " + (s1 == s2)); // true, same reference
        System.out.println("s1 == s3: " + (s1 == s3)); // false, different references
        System.out.println("s1.equals(s3): " + s1.equals(s3)); // true, same content
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

    "Create a class with fields and methods": {
      main: `public class Main {
    public static void main(String[] args) {
        // Create an instance of the Car class
        Car myCar = new Car();

        // Assign values to its fields
        myCar.model = "Toyota Camry";
        myCar.year = 2023;

        // Call the display method
        myCar.display();
    }
}`,
      other: `// Car.java
class Car {
    // Fields (or properties)
    String model;
    int year;

    // Method (or behavior)
    void display() {
        System.out.println("Model: " + model);
        System.out.println("Year: " + year);
    }
}`
    },

    "Use constructors to initialize objects": {
      main: `public class Main {
    public static void main(String[] args) {
        // Create a Book object using its constructor
        Book myBook = new Book("The Lord of the Rings", "J.R.R. Tolkien");

        System.out.println("Title: " + myBook.title);
        System.out.println("Author: " + myBook.author);
    }
}`,
      other: `// Book.java
public class Book {
    String title;
    String author;

    // Constructor to initialize the object's fields
    public Book(String title, String author) {
        this.title = title;
        this.author = author;
    }
}`
    },

    "Use Getters and Setters": {
      main: `public class Main {
    public static void main(String[] args) {
        // Create a Student object
        Student student = new Student();

        // Use setter methods to assign values
        student.setName("Alex");
        student.setGrade(95);

        // Use getter methods to retrieve and print values
        System.out.println("Student Name: " + student.getName());
        System.out.println("Student Grade: " + student.getGrade());
    }
}`,
      other: `// Student.java
public class Student {
    private String name;
    private int grade;

    // Getter for 'name'
    public String getName() { return this.name; }

    // Setter for 'name'
    public void setName(String name) { this.name = name; }

    // Getter and Setter for 'grade' can be added similarly
    public int getGrade() { return this.grade; }
    public void setGrade(int grade) { this.grade = grade; }
}`
    },
    "Demonstrate Encapsulation": {
      main: `public class Main {
    public static void main(String[] args) {
        // Create a Person object
        Person person = new Person();

        // Set data using public setter methods
        person.setName("Francine");
        person.setAge(21);

        // Get data using public getter methods
        System.out.println("Name: " + person.getName());
        System.out.println("Age: " + person.getAge());

        // Direct access to private fields is not allowed
        // person.name = "Error"; // This would cause a compilation error
    }
}`,
      other: `// Person.java
public class Person {
    // Private fields - data is hidden from other classes
    private String name;
    private int age;

    // Public getter method for name
    public String getName() {
        return name;
    }

    // Public setter method for name
    public void setName(String name) {
        this.name = name;
    }

    // Public getter method for age
    public int getAge() {
        return age;
    }

    // Public setter method for age
    public void setAge(int age) {
        if (age > 0) { // Basic validation
            this.age = age;
        }
    }
}`
    },

    "Demonstrate Inheritance & Polymorphism": {
      main: `public class Main {
    public static void main(String[] args) {
        // Create objects of each class
        Animal myAnimal = new Animal();
        Animal myDog = new Dog(); // A Dog is an Animal (Polymorphism)
        Animal myCat = new Cat(); // A Cat is an Animal (Polymorphism)

        // Call the sound() method on each object
        System.out.print("Animal says: ");
        myAnimal.sound();

        System.out.print("Dog says: ");
        myDog.sound();

        System.out.print("Cat says: ");
        myCat.sound();
    }
}`,
      other: `// Animal.java (Superclass)
public class Animal {
    public void sound() {
        System.out.println("The animal makes a sound");
    }
}

// Dog.java (Subclass)
class Dog extends Animal { // 'extends' keyword for inheritance
    @Override // Annotation to override the parent method
    public void sound() {
        System.out.println("The dog barks");
    }
}

// Cat.java (Subclass)
class Cat extends Animal { // 'extends' keyword for inheritance
    @Override // Annotation to override the parent method
    public void sound() {
        System.out.println("The cat meows");
    }
}`
    },

    "Demonstrate Abstraction": {
      main: `public class Main {
    public static void main(String[] args) {
        // Cannot create an instance of an abstract class
        // Shape myShape = new Shape(); // This would cause a compilation error

        Shape circle = new Circle(5.0);
        Shape rectangle = new Rectangle(4.0, 6.0);

        System.out.println("Area of Circle: " + circle.getArea());
        System.out.println("Area of Rectangle: " + rectangle.getArea());
    }
}`,
      other: `// Shape.java (Abstract Class)
public abstract class Shape {
    // Abstract method - must be implemented by subclasses
    public abstract double getArea();
}

// Circle.java
class Circle extends Shape {
    private double radius;
    public Circle(double radius) { this.radius = radius; }
    public double getArea() { return Math.PI * radius * radius; }
}

// Rectangle.java
class Rectangle extends Shape {
    private double width, height;
    public Rectangle(double w, double h) { this.width = w; this.height = h; }
    public double getArea() { return width * height; }
}`
    },

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

    // Find the main file, which contains the entry point of the program.
    const mainFile = files.find(f => f.content.includes("public static void main")) || files[0];
    const importRegex = /^\s*import\s+[\w\.\*]+;/gm;
    let allImports = new Set();
    let mainClassCode = "";
    let otherClassCode = [];

    files.forEach(file => {
      const content = file.content || "";
      // Collect all unique import statements from all files.
      const imports = content.match(importRegex) || [];
      imports.forEach(imp => allImports.add(imp));
      
      // Separate the main class from other classes.
      if (file.id === mainFile.id) {
        // For the main file, just remove its imports. The public class remains.
        mainClassCode = content.replace(importRegex, '').trim();
      } else {
        // For other files, remove imports AND the 'public' keyword from the class.
        const classCode = content.replace(importRegex, '').replace(/public class/g, 'class').trim();
        if (classCode) otherClassCode.push(classCode);
      }
    });

    const uniqueImports = Array.from(allImports).join('\n');
    // Assemble the final code: imports first, then other classes, then the main class.
    const fullCode = `${uniqueImports}\n\n${otherClassCode.join('\n\n')}\n\n${mainClassCode}`;
  
    try {
      log("Executing on JDoodle with provided stdin...", {
        fullCodeLength: fullCode.length,
        stdinLength: stdin.length,
      });
      const result = await executeOnJDoodle(fullCode, stdin);
      log("JDoodle result processed", result);

      let programOutput = result.output || "No output received.";
      let finalOutput = "--- Output ---\n";

      if (stdin.trim()) {
        // Simulate an interactive terminal by merging prompts and input
        const inputLines = stdin.trim().split('\n');
        let currentInputIndex = 0;
        let finalMergedOutputParts = [];
        let lastIndex = 0;
        let match;

        // Regex to find prompts ending with a colon and optional space,
        // which are typically followed by user input.
        const promptRegex = /(.+?:\s*)/g;

        while ((match = promptRegex.exec(programOutput)) !== null) {
          const promptText = match[1];
          const startIndex = match.index;
          const endIndex = promptRegex.lastIndex;

          // Add any text before this prompt
          if (startIndex > lastIndex) {
            finalMergedOutputParts.push(programOutput.substring(lastIndex, startIndex));
          }

          // Add the prompt and the corresponding input
          if (currentInputIndex < inputLines.length) {
            finalMergedOutputParts.push(promptText + inputLines[currentInputIndex++] + '\n');
          } else {
            finalMergedOutputParts.push(promptText); // No more input, just add the prompt
          }
          lastIndex = endIndex;
        }

        // Add any remaining output after the last prompt
        if (lastIndex < programOutput.length) {
          finalMergedOutputParts.push(programOutput.substring(lastIndex));
        }

        finalOutput += finalMergedOutputParts.join('').trim();
      } else {
        finalOutput += programOutput;
      }
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
    log("Starting new run", { fileCount: files.length, stdinLength: stdin.length });

    if (files.every(f => !f.content.trim())) {
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

  const handleFileContentChange = (text) => {
    const updatedFiles = files.map((file) =>
      file.id === activeFileId ? { ...file, content: text } : file
    );
    setFiles(updatedFiles);
  };

  const addFile = () => {
    const name = newFileName.trim().endsWith(".java") ? newFileName.trim() : `${newFileName.trim()}.java`;
    const newFile = { id: Date.now(), name, content: `public class ${name.replace(".java", "")} {\n\n}` };
    setFiles([...files, newFile]);
    setActiveFileId(newFile.id);
    setNewFileName("");
    setModalVisible(false);
  };

  const handleDeleteOrClearFile = (fileToDelete) => {
    if (!fileToDelete) return;

    const isMainJava = fileToDelete.name === "Main.java";
    const isLastFile = files.length <= 1;

    if (isMainJava || isLastFile) {
      // This is Main.java or the last file, so we only clear its content.
      Alert.alert("Clear Content", `Are you sure you want to clear the content of ${fileToDelete.name}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            const updatedFiles = files.map(f => f.id === fileToDelete.id ? { ...f, content: "" } : f);
            setFiles(updatedFiles);
          },
        },
      ]);
    } else {
      // This is a deletable file.
      Alert.alert("Delete File", `Are you sure you want to delete ${fileToDelete.name}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setFiles(prevFiles => prevFiles.filter(f => f.id !== fileToDelete.id));
            setActiveFileId(files.find(f => f.id !== fileToDelete.id)?.id || defaultFile.id);
          },
        },
      ]);
    }
  };
  const hasException = (text) => {
    const lower = text.toLowerCase();
    return lower.includes("exception in thread") || lower.includes("error:");
  }

  const checkCodeCompletion = (topicToCheck = activeTopic) => {
     if (!topicToCheck) return;
 
     const allCode = files.map(f => f.content).join('\n').toLowerCase();
     const newCompleted = new Set(completedTopics);

     // Find the main file content for checks that are specific to it
     const mainFile = files.find(f => f.content.includes("public static void main"));
     const mainCodeLower = mainFile ? mainFile.content.toLowerCase() : allCode;

     const checkAndAdd = (topic, keywords) => {
       if (keywords.every(kw => allCode.includes(kw))) {
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
       "Show object lifecycle (creation, dereference, garbage collection with System.gc())": ["class objectlifecycle", "obj1 = null", "system.gc()"],
       "Call methods on objects": ["class methodcallexample", "mycalc.displaymessage()", "mycalc.add"],
       "String and StringBuilder manipulation": ["class stringmanipulation", "stringbuilder sb", "sb.append"],
       "Override precedence with parentheses": ["class precedence", "(a + b) * c"],
       "Test equality (== vs. .equals())": ["class equalitytest", "s1 == s3", "s1.equals(s3)"],
       "Basic arithmetic, relational, logical operators": ["class operators", "a + b", "a > b"],
       "If-else statements": ["class ifelseexample", "if(num > 0)"],
       "Switch statement": ["class switchexample", "switch(day)"],
       "Declare, initialize, and use a 1D array": ["class array1d", "int[] nums"],
       "Declare, initialize, and use a 2D array": ["class array2d", "int[][] matrix"],
       "Use an ArrayList (add, remove, get elements)": ["class arraylistexample", "arraylist<string>"],
       "Create a class with fields and methods": ["class main", "mycar.display()"],
       "Use constructors to initialize objects": ["class main", "new book("],
       "Use Getters and Setters": ["class main", "student.setname", "student.getname"],
       "Demonstrate Encapsulation": ["class main", "person.setname", "person.getname"],
       "Demonstrate Inheritance & Polymorphism": ["class main", "class dog extends animal", "mycat.sound()"],
       "Demonstrate Abstraction": ["abstract class animal", "mycat.sound()", "mydog.sleep()"],
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
    const template = codeTemplates[topic];
    if (template) {
      Alert.alert("Load Template", `Load template for "${topic}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load Template",
          onPress: () => {
            if (typeof template === 'object' && template.main && template.other) {
              const mainFile = { id: 1, name: "Main.java", content: template.main };
              // Split the 'other' block into multiple class definitions
              const otherClasses = template.other.split(/(?=\s*(?:\/\/.*)?\s*(?:public |abstract )?class )/).filter(s => s.trim());
              const otherFiles = otherClasses.map((classContent, index) => {
                // This regex finds the class name, ignoring keywords like 'public' or 'extends'.
                const nameMatch = classContent.match(/class\s+([a-zA-Z0-9_]+)/);
                // If a name isn't found, we'll skip creating a broken file tab.
                if (!nameMatch || !nameMatch[1]) {
                  return null;
                }
                const fileName = `${nameMatch[1]}.java`;
                return { id: Date.now() + index, name: fileName, content: classContent.trim() };
              }).filter(Boolean); // Filter out any null entries that may have been created
              setFiles([mainFile, ...otherFiles]);
              setActiveFileId(mainFile.id);
            } else {
              setFiles([{ ...defaultFile, content: template }]);
              setActiveFileId(defaultFile.id);
            }
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
          setFiles([{ ...defaultFile, content: "" }]);
          setActiveFileId(defaultFile.id);
          setActiveTopic(null);
          setStdin("");
          setOutput("Output will be displayed here");
        },
      },
    ]);
  };

  const downloadCode = async () => {
    if (!activeFile || !activeFile.content.trim()) {
      Alert.alert("No Code", "There is no code to download.");
      return;
    }

    setIsDownloading(true);

    try {
      const fileUri = `${FileSystem.cacheDirectory}${activeFile.name}`;
      await FileSystem.writeAsStringAsync(fileUri, activeFile.content, {
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
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Enter New File Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Person.java"
              value={newFileName}
              onChangeText={setNewFileName}
              autoFocus={true}
            />
            <View style={styles.modalButtonContainer}>
              <Pressable style={[styles.modalButton, styles.buttonClose]} onPress={() => setModalVisible(false)}>
                <Text style={styles.textStyle}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.buttonCreate]} onPress={addFile} disabled={!newFileName.trim()}>
                <Text style={styles.textStyle}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* The main container for all screen content */}
        <View style={styles.container}>
          <View style={[styles.header, { flexDirection: 'row', alignItems: 'center' }]}>
            <FontAwesome5 style={styles.icon} name="code" size={24} color="white" marginTop={10} />
            <Text style={styles.headerText}>JAVA IDE & CHECKLIST</Text>
          </View>

          <View style={styles.fileNameContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
              style={[styles.addButton, { marginLeft: 5 }]}
              onPress={downloadCode}
              disabled={isDownloading}
            >
              {isDownloading ? <ActivityIndicator size="small" color="white" /> : <FontAwesome5 name="download" size={16} color="white" />}
            </TouchableOpacity>

              <TouchableOpacity
              style={[styles.testButton, { marginLeft: 5 }]}
              onPress={testConnection}
              disabled={isRunning}
            >
              <FontAwesome5 name="wifi" size={12} color="white" />
            </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.runButton, { paddingHorizontal: 20 }]}
              onPress={() => runCode()}
              disabled={isRunning}
            >
              <Text style={styles.runButtonText}>{isRunning ? "RUNNING..." : "RUN"}</Text>
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
                <View style={styles.fileTabsContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    {files.map(file => (
                      <TouchableOpacity 
                        key={file.id}
                        style={[styles.fileTab, activeFileId === file.id && styles.activeFileTab]}
                        onPress={() => setActiveFileId(file.id)}
                      >
                        <Text style={[styles.fileTabText, activeFileId === file.id && styles.activeFileTabText]}>{file.name}</Text>
                        {activeFileId === file.id && (
                          <TouchableOpacity 
                            style={styles.closeFileButton} 
                            onPress={() => handleDeleteOrClearFile(file)}>
                            <FontAwesome5 name="trash-alt" size={12} color="#666" />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.addFileButton} onPress={() => setModalVisible(true)}>
                      <FontAwesome5 name="plus" size={14} color="#046a38" />
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                <ScrollView style={{ flex: 1 }} nestedScrollEnabled={true}>
                  <TextInput
                    style={styles.codeInput}
                    multiline
                    value={activeFile?.content || ""}
                    onChangeText={handleFileContentChange}
                    placeholder="Write your Java code here..."
                    placeholderTextColor="#888"
                    scrollEnabled={false} // Important for nested scroll
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
