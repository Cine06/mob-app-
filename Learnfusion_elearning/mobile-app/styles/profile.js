import { StyleSheet } from "react-native";

export default StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: "#046a38", 
        padding: 20 
    },
    profileSection: { 
        alignItems: "center", 
        marginBottom: 20, 
        marginTop: 50 
    },
    profilePic: { 
        width: 100, 
        height: 100, 
        borderRadius: 50, 
        marginBottom: 10 
    },
    profileName: { 
        fontSize: 22, 
        fontWeight: "bold", 
        color: "white" 
    },
    email: { 
        fontSize: 14, 
        color: "gold", 
        marginTop: 3, 
        textDecorationLine: "underline" 
    },
    schoolId: { 
        fontSize: 14, 
        color: "gold", 
        marginTop: 3 
    },
    menuContainer: {
         marginBottom: 20 
        },
    menuItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: "#fff",
      padding: 15,
      borderRadius: 10,
      marginVertical: 8,
    },
    menuText: { 
        fontSize: 16, 
        color: "#046a38", 
        fontWeight: "600" 
    },
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
      width: "85%",
      backgroundColor: "white",
      padding: 20,
      borderRadius: 10,
      alignItems: "center",
    },
    modalTitle: { 
        fontSize: 18, 
        fontWeight: "bold",
         marginBottom: 10 
        },
    scrollContainer: { 
        width: "100%" 
    },
    label: { 
        fontSize: 16, 
        fontWeight: "bold", 
        marginTop: 10 
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
    editIcon: { 
        position: "absolute", 
        top: 10, 
        right: 10 
    },
    closeButton: {
      backgroundColor: "#046a38",
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 5,
      marginTop: 10,
    },
    closeButtonText: { 
        color: "white", 
        fontWeight: "bold" 
    },
    awardContainer: 
    { marginTop: 10 

    },
    awardText: { 
        fontSize: 16, 
        color: "#046a38"
    },
});
  