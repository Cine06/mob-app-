import {StyleSheet} from "react-native";

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#046a38",
      },
      scrollContent: {
        flexGrow: 1,
      },
      header: {
        marginTop: 30,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
      },
      logo: {
        width: 120,
        height: 120,
      },
      menuButton: {
        top: 40,
        left: 20,
        marginBottom: 10,
      },
      dropdownMenu: {
        position: "absolute",
        top: 78,
        left: 20,
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
      welcomeText: {
        color: "#FFF",
        fontSize: 20,
        textAlign: "center",
        marginBottom: 30,
      },
      boldText: {
        fontWeight: "bold",
      },
      infoContainer: {
        backgroundColor: "#FFF",
        padding: 15,
        borderRadius: 10,
        flexGrow: 1,
        paddingBottom: 100,
      },
      section: {
        marginBottom: 15,
      },
      sectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 10,
      },
      aboutImage: {
        width: "100%",
        height: 100,
        borderRadius: 10,
        borderColor: "black",
        borderWidth: 2,
      },
      notifications: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        padding: 15,
        borderRadius: 10,
        borderColor: "#046a38",
        borderWidth: 1,
      },
      reminderText: {
        marginLeft: 10,
      },
      awards: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        padding: 15,
        borderRadius: 10,
        borderColor: "#046a38",
        borderWidth: 1,
      },
      awardText: {
        fontSize: 16,
        marginLeft: 10,
      },
      sectionContainer: {
        backgroundColor: "#FFF",
        padding: 15,
        borderRadius: 10,
        borderColor: "#046a38",
        borderWidth: 1,
        marginBottom: 15,
      },
      leaderboardContainer: {
        padding: 15,
        borderRadius: 10,
        borderColor: "#046a38",
        borderWidth: 1,
        backgroundColor: "white",
      },
      leaderboardText: {
        fontSize: 14,
        marginBottom: 5,
      },
      progressText: {
        fontSize: 16,
        fontWeight: "bold",
      },
      leaderboardRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 5,
      },
      leaderboardText: {
        fontSize: 14,
        marginLeft: 5,
      },
      rankText: {
        fontSize: 16,
        fontWeight: "bold",
        marginTop: 10,
      },
      
});