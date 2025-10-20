import { StyleSheet } from "react-native";

export default StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: "#F0F5F1",
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
    alignSelf: "flex-start",
  },
  userContainer: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
  },
  botIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
    borderRadius: 16,
  },
  message: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  botMsg: {
    backgroundColor: "#1B5E20",
  },
  userMsg: {
    backgroundColor: "#E0E0E0",
  },
  botText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#000000",
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#CCC",
    padding: 10,
    backgroundColor: "#FFF",
  },
  input: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderRadius: 20,
    borderColor: "#CCC",
    marginRight: 6,
    backgroundColor: "#FFF",
    color: "#000",
  },
  sendButton: {
    backgroundColor: "#1B5E20",
    borderRadius: 20,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
