import { StyleSheet } from "react-native";

export default StyleSheet.create({
    container: {
        position: "absolute",
        zIndex: 100,
      },
      fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        elevation: 10,
      },
      fabImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
      },
      chatPopup: {
        width: 330,
        height: 480,
        backgroundColor: "#fff",
        borderRadius: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 12,
        flex: 1,
      },
      chatHeader: {
        backgroundColor: "#046a38",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
      },
      headerLeft: {
        flexDirection: "row",
        alignItems: "center",
      },
      headerIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        marginRight: 8,
      },
      headerTitle: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "bold",
      },
});