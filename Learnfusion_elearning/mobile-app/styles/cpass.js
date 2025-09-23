import { StyleSheet } from "react-native";

export default StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: "#046a38", 
        padding: 20 
    },
    header: { 
        flexDirection: "row", 
        alignItems: "center", 
        marginBottom: 20, 
        marginTop: 25 
    },
    headerText: { 
        fontSize: 20, 
        fontWeight: "bold", 
        color: "white", 
        marginLeft: 15
    },
    formContainer: { 
        backgroundColor: "white", 
        padding: 20, 
        borderRadius: 10 
    },
    label: { 
        fontSize: 14, 
        fontWeight: "bold", 
        marginTop: 10 
    },
    inputContainer: { 
        position: "relative",
         width: "100%" 
        },
    input: {
    width: "100%",
    padding: 10,
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 5,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
  },
  eyeIcon: {
    position: "absolute",
    right: 10,
    marginTop: 20,
    transform: [{ translateY: -12 }],
  },
  saveButton: {
    backgroundColor: "#046a38",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 5,
    marginTop: 10,
  },
  saveButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
},
);