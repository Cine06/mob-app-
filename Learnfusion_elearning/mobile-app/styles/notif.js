import {StyleSheet} from "react-native";

export default StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#FFF",
      padding: 15,
    },
    headerContainer: {
      marginTop: 25
    },
    defaultHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      marginBottom: 10,
      width: '100%'
    },
    selectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 8,
      width: '100%',
    },
    header: {
      fontSize: 22,
      fontWeight: "bold",
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
  