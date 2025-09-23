import { StyleSheet } from "react-native";

export default StyleSheet.create({
    scrollContainer: {
        flex: 1,
        backgroundColor: "#046a38",
        marginBottom: 50,
      },
      container: {
        padding: 20,
        paddingBottom: 60,
      },
      header: {
        flexDirection: "row",
        justifyContent: "space-between", 
        alignItems: "center",
        backgroundColor: "white",
        borderColor: "black",
        borderWidth: 1,
        paddingHorizontal: 10,
      },
      header1: {
        flexDirection: "row",
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center",
        height: 170,
      },
      logo: {
        marginTop: 15,
        width: 55,
        height: 55,
        marginBottom: 12,
      },
      logo1: {
        marginTop: 15,
        width: 125,
        height: 125,
        alignSelf: "center",
      },
      menuButton: {
        marginTop: 20,
        marginBottom: 15,
      },
      dropdownMenu: {
        position: "absolute",
        top: 78,
        right: 15,
        backgroundColor: "#FFF",
        borderRadius: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        padding: 10,
        zIndex: 10,
      },
      menuItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 15,
      },
      menuText: {
        fontSize: 16,
        marginLeft: 10,
        color: "#046a38",
      },
      aboutTitle: {
        backgroundColor: "white",
        fontSize: 24,
        color: "black",
        textAlign: "center",
        fontWeight: "bold",
        height: 50,
      },
      highlight: {
        color: "#FFD700",
      },
      highlight1: {
        color: "white",
      },
      sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#FFD700",
        marginTop: 20,
      },
      text: {
        fontSize: 14,
        color: "#FFF",
        textAlign: "justify",
        marginBottom: 10,
      },
      branchContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: 10,
      },
      branchText: {
        fontSize: 14,
        color: "#FFD700",
        fontWeight: "bold",
        textDecorationLine: "underline",
      },
    
});