import {StyleSheet} from "react-native";

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff" 
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 15,
        paddingVertical: 15,
        paddingTop: 45, 
        backgroundColor: '#046a38',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    headerText: {
        color: "white",
        fontSize: 20, 
        fontWeight: "bold"
    },
    manageButton: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600'
    },
    messageList: {
        flex: 1,
        backgroundColor: '#fff', 
    },
    messageItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0', 
        backgroundColor: 'transparent', 
    },
    unreadMessageItem: {
        backgroundColor: '#F0FDF4', 
    },
    unreadTextContent: {
        fontWeight: 'bold',
        color: '#111', 
    },
    avatar: {
        width: 50, 
        height: 50,
        borderRadius: 25,
        marginRight: 15
    },
    messageTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    messageName: {
        fontSize: 16,
        fontWeight: "600", 
        color: '#333',
    },
    messageText: {
        fontSize: 14,
        color: "#666", 
        marginTop: 2,
    },
    messageTime: {
        fontSize: 12,
        color: "#999", 
        marginLeft: 10,
    },
    noMessages: {
        textAlign: "center",
        marginTop: 50,
        fontSize: 16,
        color: "#888" 
    },
        newContactContainer: { 
            flexDirection: "row", 
            padding: 10, 
            backgroundColor: "white", 
            alignItems: "center" 
        },
        newContactInput: { 
            flex: 1, 
            borderColor: "gray", 
            borderWidth: 1, 
            borderRadius: 5, 
            padding: 5, 
            marginRight: 10 
        },
        addButton: { 
            backgroundColor: "#046a38", 
            padding: 10, 
            borderRadius: 5 
        },
        addButtonText: { 
            color: "white", 
            fontWeight: "bold"
        },
        unreadBadge: {
            backgroundColor: '#046a38',
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 3,
            marginLeft: 'auto',
        },
        unreadText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
});
