import { StyleSheet, Platform } from "react-native";

export default StyleSheet.create({
  container: { 
        flex: 1, 
        backgroundColor: "#046a38" 
    },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    padding: 10, 
    backgroundColor: "#046a38", 
    marginTop: 40 
},
  headerTitle: { 
    flexDirection: "row", 
    alignItems: "center" 
},
  headerText: { 
    fontSize: 18, 
    fontWeight: "bold", 
    color: "white", 
    marginLeft: 10 
},
  icon: { 
    marginHorizontal: 10 
},
  avatar: {
     width: 40, 
     height: 40, 
     borderRadius: 20
     },
  chatContainer: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  senderBubble: { 
    alignSelf: "flex-start", 
    backgroundColor: "#E5E5E5", 
    padding: 10, 
    borderRadius: 10, 
    marginVertical: 5, 
    maxWidth: "80%" 
},
  receiverBubble: { 
    alignSelf: "flex-end", 
    backgroundColor: "#A7C7E7", 
    padding: 10, 
    borderRadius: 10, 
    marginVertical: 5, 
    maxWidth: "80%" 
},
  senderText: { 
    fontSize: 14, 
    color: "black" 
},
  receiverText: { 
    fontSize: 14, 
    color: "black" 
},
  time: { 
    fontSize: 12, 
    color: "gray", 
    textAlign: "right" 
},
  inputArea: {
    backgroundColor: 'white',
  },
  inputContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 10, 
    backgroundColor: "white", 
    borderTopWidth: 1, 
    borderTopColor: "#eee",
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
},
  input: { 
    flex: 1, 
    height: 40, 
    borderColor: "gray", 
    borderWidth: 1, 
    borderRadius: 20, 
    paddingHorizontal: 10, 
    marginHorizontal: 10,
},
  sendButton: { 
    backgroundColor: "#046a38", 
    padding: 10, 
    borderRadius: 20 ,
    justifyContent: 'center',
    alignItems: 'center',
    },
  dropdownMenu: {
    position: "absolute",
    left: 45,
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
readReceipt: {
  fontSize: 10,
  color: '#a0a0a0',
  alignSelf: 'flex-end',
  marginTop: 2,
  marginRight: 5,
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dateSeparatorText: {
    backgroundColor: '#f1f1f1',
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fileText: {
    fontSize: 14,
    flexShrink: 1,
  },
});