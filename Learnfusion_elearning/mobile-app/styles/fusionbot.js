import {StyleSheet} from 'react-native';

export default StyleSheet.create({
    body: {
        flex: 1,
        backgroundColor: "#f9f9f9",
      },
      chatArea: {
        paddingHorizontal: 16,
        paddingTop: 12,
      },
      messageContainer: {
        flexDirection: "row",
        marginBottom: 10,
        alignItems: "flex-end",
      },
      botContainer: {
        flexDirection: "row",
        alignSelf: "flex-start",
      },
      userContainer: {
        flexDirection: "row-reverse",
        alignSelf: "flex-end",
      },
      botIcon: {
        width: 30,
        height: 30,
        marginRight: 8,
        borderRadius: 15,
      },
      message: {
        maxWidth: "75%",
        padding: 12,
        borderRadius: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      botMsg: {
        backgroundColor: "#006400",
      },
      userMsg: {
        backgroundColor: "#E0E0E0",
      },
      botText: {
        color: "#ffffff",
      },
      userText: {
        color: "#000000",
      },
      inputContainer: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderColor: "#ccc",
        padding: 10,
        backgroundColor: "#fff",
      },
      input: {
        flex: 1,
        padding: 10,
        borderWidth: 1,
        borderRadius: 20,
        borderColor: "#ccc",
        marginRight: 6,
      },
      sendButton: {
        backgroundColor: "#006400",
        borderRadius: 20,
        padding: 10,
        justifyContent: "center",
        alignItems: "center",
      },
})