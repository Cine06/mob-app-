import {StyleSheet} from "react-native";

export default StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#FFF",
      padding: 15,
    },
    header: {
      marginTop: 25,
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 5,
      textAlign: "center",
      
    },
    noNotifications: {
      textAlign: "center",
      fontSize: 16,
      marginTop: 20,
      color: "gray",
    },
    notificationItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#F9F9F9",
      padding: 15,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#E0E0E0",
      marginBottom: 10,
    },
    unreadItem: {
      backgroundColor: '#F0FDF4', 
      borderColor: '#046a38',     
    },
    selectedItem: {
      backgroundColor: '#E3F2FD', 
      borderColor: '#2196F3',
    },
    headerText: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    icon: {
      marginRight: 10,
    },
    message: {
      fontSize: 16,
      fontWeight: "500",
    },
    time: {
      fontSize: 12,
      color: "gray",
    },
  });
  