import { space } from "postcss/lib/list";
import { StyleSheet } from "react-native";

export default StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: "#046a38" 
    },
    icon: { 
        left: 75, 
        marginTop: 30 
    },
    header: { 
        flexDirection: "row", 
        backgroundColor: "#046a38", 
        padding: 10, 
        borderColor: "black", 
        borderWidth: 2 
    },
    addButton: { 
        padding: 10 
    },
    headerText: { 
        color: "white", 
        marginTop: 30, 
        fontSize: 18, 
        fontWeight: "bold", 
        flex: 1, 
        left: 85, 
        marginBottom: 10 
    },
    fileNameContainer: { 
        flexDirection: "row", 
        backgroundColor: "#027d43", 
        padding: 10, 
        justifyContent :"space-between",
        alignItems: "center",
        borderColor: "black", 
        borderWidth: 1 
    },
    fileName: { 
        color: "white", 
        fontSize: 16, 
        textDecorationLine: "underline" 
    },
    tabContainer: { 
        flexDirection: "row", 
        borderBottomWidth: 1, 
        borderColor: "#ccc" 
    },
    tab: { 
        flex: 1, 
        padding: 10, 
        alignItems: "center" 
    },
    activeTab: { 
        borderBottomWidth: 2, 
        borderColor: "#046a38" 
    },
    tabText: { 
        fontSize: 16, 
        fontWeight: "bold" 
    },
    contentContainer: { 
        flex: 1, 
        padding: 10 
    },
    codeInput: { 
        backgroundColor: "white", 
        padding: 10, borderRadius: 5, 
        minHeight: 300, fontSize: 14, 
        textAlignVertical: "top" 
    },
    outputText: { 
        color: "white", 
        fontSize: 16, 
        padding: 10, 
        backgroundColor: "#333", 
        borderRadius: 5 
    },
    runButton: { 
        backgroundColor: "#FF9800", 
        paddingVertical: 8, 
        paddingHorizontal: 16, 
        borderRadius: 5 
    },
    runButtonText: { 
        color: "white", 
        fontSize: 14, 
        fontWeight: "bold" 
    },
    testButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5
    },
    outputContainer: {
        backgroundColor: "#333",
        borderRadius: 5,
        padding: 10,
        minHeight: 300
    },
    checklistContainer: {
        backgroundColor: "white",
        borderRadius: 5,
        padding: 15,
        minHeight: 300
    },
    checklistTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#046a38",
        marginBottom: 10,
        textAlign: "center"
    },
    progressText: {
        fontSize: 14,
        color: "#666",
        marginBottom: 20,
        textAlign: "center",
        fontWeight: "600"
    },
    categoryContainer: {
        marginBottom: 20
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#046a38",
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        paddingBottom: 5
    },
    topicItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: "#f9f9f9",
        borderRadius: 5,
        marginBottom: 5
    },
    topicContent: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: "#ddd",
        borderRadius: 3,
        marginRight: 10,
        justifyContent: "center",
        alignItems: "center"
    },
    checkboxCompleted: {
        backgroundColor: "#4CAF50",
        borderColor: "#4CAF50"
    },
    topicText: {
        fontSize: 14,
        color: "#333",
        flex: 1
    },
    topicTextCompleted: {
        textDecorationLine: "line-through",
        color: "#666"
    },
    templateButton: {
        padding: 5,
        backgroundColor: "#e8f5e8",
        borderRadius: 3
    }
  });