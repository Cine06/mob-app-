import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import { useRouter, Stack } from "expo-router";
import FloatingChatbot from "../components/FloatingChatbot";
import styles from "../styles/code";

export default function CodeSnippets() {
  const [selectedTab, setSelectedTab] = useState("code");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("Output will be displayed here");
  const [isRunning, setIsRunning] = useState(false);
  const [completedTopics, setCompletedTopics] = useState(new Set());
  const [javaVersion, setJavaVersion] = useState(null);

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
        System.out.print("Enter your name: ");
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
        scanner.close();
    }
}`,
    "Declare and initialize primitive variables": `public class Variables {
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
    "If-else statements": `public class DecisionMaking {
    public static void main(String[] args) {
        int score = 85;
        
        if (score >= 90) {
            System.out.println("Grade: A");
        } else if (score >= 80) {
            System.out.println("Grade: B");
        } else if (score >= 70) {
            System.out.println("Grade: C");
        } else {
            System.out.println("Grade: F");
        }
    }
}`,
    "Declare, initialize, and use a 1D array": `public class ArrayExample {
    public static void main(String[] args) {
        int[] numbers = {1, 2, 3, 4, 5};
        
        System.out.println("Array elements:");
        for (int i = 0; i < numbers.length; i++) {
            System.out.println("Index " + i + ": " + numbers[i]);
        }
        
        System.out.println("\\nUsing enhanced for loop:");
        for (int num : numbers) {
            System.out.println(num);
        }
    }
}`,
    "Object-Oriented Programming Example": `public class Car {
    String brand;
    String model;
    int year;

    public Car(String brand, String model, int year) {
        this.brand = brand;
        this.model = model;
        this.year = year;
    }

    public void displayCarDetails() {
        System.out.println("Brand: " + brand);
        System.out.println("Model: " + model);
        System.out.println("Year: " + year);
    }

    public static void main(String[] args) {
        System.out.println("Program started...");

        Car myCar = new Car("Toyota", "Camry", 2023);
        myCar.displayCarDetails();

        Car anotherCar = new Car("Honda", "Civic", 2024);
        anotherCar.displayCarDetails();

        System.out.println("Program ended...");
    }
}`
  };

  const runCode = async () => {
    if (!code.trim()) {
      Alert.alert("Error", "Please enter some code to run");
      return;
    }

    setSelectedTab("output");
    setIsRunning(true);
    setOutput("Running code...");
    
    try {
      const result = simulateJavaExecution(code);
      setOutput(result.output);
      
      if (result.success) {
        checkCodeCompletion();
      }
      
    } catch (error) {
      console.error("Code execution error:", error);
      setOutput("Code execution failed: " + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const generateClassOutput = (className, params, javaCode) => {
    let output = "";
    
    const classDef = javaCode.match(new RegExp(`class\\s+${className}\\s*\\{[\\s\\S]*?\\}`, 'i'));
    
    if (classDef) {
      const classContent = classDef[0];
      
      const fieldMatches = classContent.match(/(\w+)\s+(\w+)\s*;/g);
      const fields = [];
      if (fieldMatches) {
        fieldMatches.forEach(field => {
          const fieldMatch = field.match(/(\w+)\s+(\w+)\s*;/);
          if (fieldMatch) {
            fields.push(fieldMatch[2]); 
          }
        });
      }
      
      const methodMatches = classContent.match(/public\s+void\s+(\w+)\s*\([^)]*\)\s*\{[^}]*System\.out\.println[^}]*\}/g);
      const methods = [];
      if (methodMatches) {
        methodMatches.forEach(method => {
          const methodMatch = method.match(/public\s+void\s+(\w+)\s*\(/);
          if (methodMatch) {
            methods.push(methodMatch[1]);
          }
        });
      }
      
      if (fields.length > 0 && params.length > 0) {
        const minLength = Math.min(fields.length, params.length);
        for (let i = 0; i < minLength; i++) {
          const fieldName = fields[i];
          const paramValue = params[i];
          
          const displayName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
          output += `${displayName}: ${paramValue}\n`;
        }
      } else {
        params.forEach((param, index) => {
          output += `Parameter ${index + 1}: ${param}\n`;
        });
      }
    } else {
      params.forEach((param, index) => {
        output += `${className} parameter ${index + 1}: ${param}\n`;
      });
    }
    
    return output;
  };

  const simulateJavaExecution = (javaCode) => {
    const codeLower = javaCode.toLowerCase();
    
    if (!javaCode.includes("public class")) {
      return {
        success: false,
        output: "Compilation Error:\nMissing 'public class' declaration.\nEvery Java program must have a public class."
      };
    }
    
    if (!javaCode.includes("public static void main")) {
      return {
        success: false,
        output: "Compilation Error:\nMissing 'main' method.\nEvery Java program must have a main method:\npublic static void main(String[] args)"
      };
    }
    
    let output = "Code executed successfully!\n\n";
    let hasOutput = false;
    
    const printStatements = javaCode.match(/System\.out\.println\s*\(\s*["']([^"']*)["']\s*\)/g);
    if (printStatements) {
      hasOutput = true;
      printStatements.forEach(stmt => {
        const match = stmt.match(/System\.out\.println\s*\(\s*["']([^"']*)["']\s*\)/);
        if (match) {
          output += match[1] + "\n";
        }
      });
    }
    
    const printStatements2 = javaCode.match(/System\.out\.print\s*\(\s*["']([^"']*)["']\s*\)/g);
    if (printStatements2) {
      hasOutput = true;
      printStatements2.forEach(stmt => {
        const match = stmt.match(/System\.out\.print\s*\(\s*["']([^"']*)["']\s*\)/);
        if (match) {
          output += match[1];
        }
      });
    }
    
    if (codeLower.includes("new ") && codeLower.includes("class")) {
      hasOutput = true;
      
      const objectCreations = javaCode.match(/new\s+(\w+)\s*\([^)]*\)/g);
      if (objectCreations) {
        objectCreations.forEach(creation => {
          const classMatch = creation.match(/new\s+(\w+)\s*\(/);
          if (classMatch) {
            const className = classMatch[1];
            
            const paramMatch = creation.match(/new\s+\w+\s*\(([^)]*)\)/);
            if (paramMatch) {
              const params = paramMatch[1];
              
              const paramList = params.split(',').map(p => p.trim());
              const parsedParams = paramList.map(param => {
                if (param.match(/^["'][^"']*["']$/)) {
                  return param.slice(1, -1); 
                }
                if (param.match(/^\d+$/)) {
                  return param;
                }
                return param;
              });
              
              output += generateClassOutput(className, parsedParams, javaCode);
            }
          }
        });
      }
    }
    
    const methodCalls = javaCode.match(/\w+\.\w+\s*\([^)]*\)/g);
    if (methodCalls && methodCalls.length > 0) {
      hasOutput = true;
    }
    
    if (codeLower.includes("system.out.println") && codeLower.includes("+") && 
        (codeLower.includes("name") || codeLower.includes("age") || codeLower.includes("hello"))) {
      hasOutput = true;
      if (codeLower.includes("hello") && codeLower.includes("name")) {
        output += "Hello, [User Name]!\n";
      }
      if (codeLower.includes("java.version")) {
        output += "Java version: 11.0.2\n";
      }
    }
    
    if ((codeLower.includes("int[]") || codeLower.includes("string[]")) && 
        (codeLower.includes("for") || codeLower.includes("length") || codeLower.includes("index"))) {
      hasOutput = true;
      
      const arrayMatches = javaCode.match(/(?:int\[\]|String\[\])\s+(\w+)\s*=\s*\{([^}]+)\}/g);
      if (arrayMatches) {
        arrayMatches.forEach(arrayMatch => {
          const arrayDefMatch = arrayMatch.match(/(?:int\[\]|String\[\])\s+(\w+)\s*=\s*\{([^}]+)\}/);
          if (arrayDefMatch) {
            const arrayName = arrayDefMatch[1];
            const valuesString = arrayDefMatch[2];
            const values = valuesString.split(',').map(v => v.trim().replace(/['"]/g, ''));
            
            const loopWithArray = javaCode.match(new RegExp(`for\\s*\\([^)]*${arrayName}\\.length[^)]*\\)`, 'g'));
            if (loopWithArray) {
              const printInLoop = javaCode.match(new RegExp(`System\\.out\\.println\\s*\\([^)]*\\+\\s*${arrayName}\\[[^\\]]+\\][^)]*\\)`, 'g'));
              if (printInLoop) {
                const printMatch = printInLoop[0].match(/System\.out\.println\s*\(\s*["']([^"']*)["']\s*\+/);
                if (printMatch) {
                  const prefix = printMatch[1];
                  values.forEach((value, index) => {
                    output += `${prefix}${index}: ${value}\n`;
                  });
                } else {
                  values.forEach((value, index) => {
                    output += `Index ${index}: ${value}\n`;
                  });
                }
              } else {
                values.forEach((value, index) => {
                  output += `Index ${index}: ${value}\n`;
                });
              }
            } else {
              output += "Array elements:\n";
              values.forEach((value, index) => {
                output += `Index ${index}: ${value}\n`;
              });
            }
          }
        });
      } else {
        const arrayDeclarations = javaCode.match(/(?:int\[\]|String\[\])\s+(\w+)\s*;/g);
        if (arrayDeclarations) {
          arrayDeclarations.forEach(declaration => {
            const declMatch = declaration.match(/(?:int\[\]|String\[\])\s+(\w+)\s*;/);
            if (declMatch) {
              const arrayName = declMatch[1];
              
              const loopWithArray = javaCode.match(new RegExp(`for\\s*\\([^)]*${arrayName}\\.length[^)]*\\)`, 'g'));
              if (loopWithArray) {
                const loopMatch = loopWithArray[0].match(/for\s*\(\s*[^;]+;\s*([^;]+);\s*[^)]+\)/);
                if (loopMatch) {
                  const condition = loopMatch[1];
                  if (condition.includes('<') && condition.includes('5')) {
                    output += "Index 0: [value]\n";
                    output += "Index 1: [value]\n";
                    output += "Index 2: [value]\n";
                    output += "Index 3: [value]\n";
                    output += "Index 4: [value]\n";
                  } else {
                    output += "Index 0: [value]\n";
                    output += "Index 1: [value]\n";
                    output += "Index 2: [value]\n";
                  }
                }
              }
            }
          });
        }
      }
    }
    
    if ((codeLower.includes("for") || codeLower.includes("while")) && 
        codeLower.includes("system.out.println")) {
      hasOutput = true;
      
      const forLoops = javaCode.match(/for\s*\(\s*([^;]+);\s*([^;]+);\s*([^)]+)\)/g);
      if (forLoops) {
        forLoops.forEach(loop => {
          const loopMatch = loop.match(/for\s*\(\s*([^;]+);\s*([^;]+);\s*([^)]+)\)/);
          if (loopMatch) {
            const init = loopMatch[1].trim();
            const condition = loopMatch[2].trim();
            const increment = loopMatch[3].trim();
            
            const varMatch = init.match(/(\w+)\s*=\s*(\d+)/);
            if (varMatch) {
              const varName = varMatch[1];
              const startValue = parseInt(varMatch[2]);
              
              let endValue = startValue + 3; 
              if (condition.includes('<')) {
                const endMatch = condition.match(/<\s*(\d+)/);
                if (endMatch) {
                  endValue = parseInt(endMatch[1]);
                } else if (condition.includes('length')) {
                  const arrayMatches = javaCode.match(/(?:int\[\]|String\[\])\s+\w+\s*=\s*\{([^}]+)\}/g);
                  if (arrayMatches) {
                    const valuesMatch = arrayMatches[0].match(/\{([^}]+)\}/);
                    if (valuesMatch) {
                      const values = valuesMatch[1].split(',').map(v => v.trim());
                      endValue = values.length;
                    }
                  }
                }
              }
              
              for (let i = startValue; i < endValue; i++) {
                const printInLoop = javaCode.match(new RegExp(`System\\.out\\.println\\s*\\([^)]*\\+\\s*${varName}[^)]*\\)`, 'g'));
                if (printInLoop) {
                  const printMatch = printInLoop[0].match(/System\.out\.println\s*\(\s*["']([^"']*)["']\s*\+/);
                  if (printMatch) {
                    output += `${printMatch[1]}${i}\n`;
                  } else {
                    output += `Loop iteration: ${i}\n`;
                  }
                } else {
                  output += `Loop iteration: ${i}\n`;
                }
              }
            }
          }
        });
      }
      
      const whileLoops = javaCode.match(/while\s*\(([^)]+)\)/g);
      if (whileLoops) {
        whileLoops.forEach(loop => {
          const conditionMatch = loop.match(/while\s*\(([^)]+)\)/);
          if (conditionMatch) {
            const condition = conditionMatch[1];
            
            if (condition.includes('<') && condition.includes('5')) {
              output += "While loop iteration: 0\n";
              output += "While loop iteration: 1\n";
              output += "While loop iteration: 2\n";
              output += "While loop iteration: 3\n";
              output += "While loop iteration: 4\n";
            } else {
              output += "While loop iteration: 1\n";
              output += "While loop iteration: 2\n";
              output += "While loop iteration: 3\n";
            }
          }
        });
      }
    }
    
    if (codeLower.includes("if") && codeLower.includes("system.out.println")) {
      hasOutput = true;
      
      const ifStatements = javaCode.match(/if\s*\([^)]+\)\s*\{[^}]*System\.out\.println[^}]*\}/g);
      if (ifStatements) {
        ifStatements.forEach(ifStmt => {
          const conditionMatch = ifStmt.match(/if\s*\(([^)]+)\)/);
          if (conditionMatch) {
            const condition = conditionMatch[1];
            
            const printMatch = ifStmt.match(/System\.out\.println\s*\(\s*["']([^"']*)["']\s*\)/);
            if (printMatch) {
              const printText = printMatch[1];
              
              if (condition.includes('>=') && condition.includes('90')) {
                output += "Grade: A\n";
              } else if (condition.includes('>=') && condition.includes('80')) {
                output += "Grade: B\n";
              } else if (condition.includes('>=') && condition.includes('70')) {
                output += "Grade: C\n";
              } else {
                output += `${printText}\n`;
              }
            }
          }
        });
      } else {
        if (codeLower.includes("grade") || codeLower.includes("score")) {
          output += "Grade: B\n";
        }
      }
    }
    
    if (codeLower.includes("program started") || codeLower.includes("program ended")) {
      hasOutput = true;
      if (codeLower.includes("program started")) {
        output = "Program started...\n" + output;
      }
      if (codeLower.includes("program ended")) {
        output += "Program ended...\n";
      }
    }
    
    if (!hasOutput) {
      output += "Program executed successfully but produced no output.\n";
      output += "Try adding System.out.println() statements to see output.";
    }
    
    output += "\nYour code demonstrates: " + analyzeCode();
    
    return {
      success: true,
      output: output
    };
  };

  const analyzeCode = () => {
    const codeLower = code.toLowerCase();
    const features = [];
    
    if (codeLower.includes("system.out.println")) features.push("Output statements");
    if (codeLower.includes("scanner")) features.push("Input handling");
    if (codeLower.includes("if") && codeLower.includes("else")) features.push("Conditional logic");
    if (codeLower.includes("for") || codeLower.includes("while")) features.push("Loops");
    if (codeLower.includes("int[]") || codeLower.includes("string[]")) features.push("Arrays");
    if (codeLower.includes("class")) features.push("Class definition");
    if (codeLower.includes("public static void main")) features.push("Main method");
    
    return features.length > 0 ? features.join(", ") : "Basic Java structure";
  };


  const checkCodeCompletion = () => {
    const codeLower = code.toLowerCase();
    const newCompleted = new Set(completedTopics);

    if (codeLower.includes("system.out.println") && codeLower.includes("hello")) {
      newCompleted.add("Run HelloWorld program");
    }
    if (codeLower.includes("scanner") && codeLower.includes("nextline")) {
      newCompleted.add("Hello with name input/output");
    }

    if (codeLower.includes("int ") && codeLower.includes("double ") && codeLower.includes("boolean ")) {
      newCompleted.add("Declare and initialize primitive variables (int, double, boolean, etc.)");
    }
    if (codeLower.includes("string ") && codeLower.includes("new ")) {
      newCompleted.add("Declare and initialize object references (String, custom objects)");
    }
    if (codeLower.includes("stringbuilder")) {
      newCompleted.add("String and StringBuilder manipulation");
    }

    if (codeLower.includes("if") && codeLower.includes("else")) {
      newCompleted.add("If-else statements");
    }
    if (codeLower.includes("switch")) {
      newCompleted.add("Switch statement");
    }
    if (codeLower.includes("==") || codeLower.includes(".equals")) {
      newCompleted.add("Test equality (== vs. .equals())");
    }

    if (codeLower.includes("int[]") || codeLower.includes("string[]")) {
      newCompleted.add("Declare, initialize, and use a 1D array");
    }
    if (codeLower.includes("int[][]") || codeLower.includes("string[][]")) {
      newCompleted.add("Declare, initialize, and use a 2D array");
    }
    if (codeLower.includes("arraylist")) {
      newCompleted.add("Use an ArrayList (add, remove, get elements)");
    }

    if (codeLower.includes("class") && codeLower.includes("public") && codeLower.includes("{")) {
      newCompleted.add("Create a class with fields and methods");
    }
    
    const constructorPattern = /public\s+\w+\s*\([^)]*\)\s*\{/g;
    if (constructorPattern.test(code)) {
      newCompleted.add("Use constructors to initialize objects");
    }
    
    if (codeLower.includes("new ") && codeLower.includes("(") && codeLower.includes(")")) {
      newCompleted.add("Call methods on objects");
    }
    
    if (codeLower.includes("class") && codeLower.includes("new ") && 
        code.match(/\w+\.\w+\s*\([^)]*\)/)) {
      newCompleted.add("Object-Oriented Programming Example");
    }

    setCompletedTopics(newCompleted);
  };

  const loadTemplate = (topic) => {
    if (codeTemplates[topic]) {
      Alert.alert(
        "Load Template",
        `Do you want to load the template for "${topic}"?\n\nThis will replace your current code.`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Load Template", 
            onPress: () => {
              setCode(codeTemplates[topic]);
              setSelectedTab("code");
            }
          }
        ]
      );
    }
  };

  const clearCode = () => {
    Alert.alert(
      "Clear Code",
      "Are you sure you want to clear the code editor?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", onPress: () => setCode("") }
      ]
    );
  };

  const testConnection = async () => {
    setIsRunning(true);
    setOutput("Testing code execution capabilities...");
    
    try {
      const testCode = `public class Test {
    public static void main(String[] args) {
        System.out.println("Connection test successful!");
        System.out.println("Java version: " + System.getProperty("java.version"));
    }
}`;
      
      setOutput("✅ Code execution system ready!\n\n" +
                "Simulated output:\n" +
                "Connection test successful!\n" +
                "Java version: 11.0.2\n\n" +
                "Note: Using local code analysis and simulation.\n" +
                "Your code will be analyzed for Java concepts and syntax.");
      
      setJavaVersion("11");
      
    } catch (error) {
      console.error("Connection test error:", error);
      setOutput("Connection test failed: " + error.message);
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <FontAwesome5 style={styles.icon} name="code" size={24} color="white" />
          <Text style={styles.headerText}>JAVA IDE & CHECKLIST</Text>
        </View>
        
        <View style={styles.fileNameContainer}>
          <TouchableOpacity style={styles.addButton} onPress={clearCode}>
            <FontAwesome5 name="trash" size={16} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.runButton, { marginLeft: 5, paddingHorizontal: 15 }]} onPress={runCode} disabled={isRunning}>
            <Text style={styles.runButtonText}>{isRunning ? "RUNNING..." : "RUN"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.testButton, { marginLeft: 5 }]} onPress={testConnection} disabled={isRunning}>
            <FontAwesome5 name="wifi" size={12} color="white" />
          </TouchableOpacity>
          
        </View>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, selectedTab === "code" && styles.activeTab]} onPress={() => setSelectedTab("code")}>
            <Text style={styles.tabText}>CODE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, selectedTab === "output" && styles.activeTab]} onPress={() => setSelectedTab("output")}>
            <Text style={styles.tabText}>OUTPUT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, selectedTab === "checklist" && styles.activeTab]} onPress={() => setSelectedTab("checklist")}>
            <Text style={styles.tabText}>CHECKLIST</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.contentContainer}>
          {selectedTab === "code" ? (
            <TextInput
              style={styles.codeInput}
              multiline
              value={code}
              onChangeText={setCode}
              placeholder="Write your Java code here... Be creative!

Example:
public class MyProgram {
    public static void main(String[] args) {
        System.out.println('Hello, World!');
    }
}"
              placeholderTextColor="#888"
            />
          ) : selectedTab === "output" ? (
            <View style={styles.outputContainer}>
              <Text style={styles.outputText}>{output}</Text>
            </View>
          ) : (
            <View style={[styles.checklistContainer, {flexGrow: 1, marginBottom: 100}]}>
              <Text style={styles.checklistTitle}>Java Programming Concepts</Text>
              <Text style={styles.progressText}>
                Progress: {completedTopics.size} / {Object.values(javaTopics).flat().length} completed
              </Text>
              
              {Object.entries(javaTopics).map(([category, topics]) => (
                <View key={category} style={styles.categoryContainer}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {topics.map((topic, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.topicItem}
                      onPress={() => loadTemplate(topic)}
                    >
                      <View style={styles.topicContent}>
                        <View style={[
                          styles.checkbox,
                          completedTopics.has(topic) && styles.checkboxCompleted
                        ]}>
                          {completedTopics.has(topic) && (
                            <FontAwesome5 name="check" size={12} color="white" />
                          )}
                        </View>
                        <Text style={[
                          styles.topicText,
                          completedTopics.has(topic) && styles.topicTextCompleted
                        ]}>
                          {topic}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.templateButton}
                        onPress={() => loadTemplate(topic)}
                      >
                        <FontAwesome5 name="code" size={12} color="#046a38" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <FloatingChatbot />
      <BottomNav />
    </>
  );
}
