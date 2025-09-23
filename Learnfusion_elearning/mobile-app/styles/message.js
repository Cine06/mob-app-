import {StyleSheet} from "react-native";

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff" // Use a clean white background for the main screen
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 15,
        paddingVertical: 15,
        paddingTop: 45, // Adjust for status bar height
        backgroundColor: '#046a38',
        // Add a subtle shadow for depth
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
        fontSize: 20, // Slightly larger for better presence
        fontWeight: "bold"
    },
    manageButton: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600'
    },
    messageList: {
        flex: 1,
        backgroundColor: '#fff', // Ensure list background is white
    },
    messageItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0', // A very light separator for a clean look
        backgroundColor: 'transparent', // No background color needed if list is white
    },
    unreadMessageItem: {
        backgroundColor: '#F0FDF4', // A very subtle, elegant green tint for unread items
    },
    unreadTextContent: {
        fontWeight: 'bold',
        color: '#111', // Make unread text darker for emphasis
    },
    avatar: {
        width: 50, // Slightly larger avatars
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
        fontWeight: "600", // Use semi-bold for a modern feel
        color: '#333',
    },
    messageText: {
        fontSize: 14,
        color: "#666", // A softer gray for the message preview
        marginTop: 2,
    },
    messageTime: {
        fontSize: 12,
        color: "#999", // Lighter gray for the timestamp
        marginLeft: 10,
    },
    noMessages: {
        textAlign: "center",
        marginTop: 50,
        fontSize: 16,
        color: "#888" // A soft gray for the empty state message
    },
    // --- The styles below are for the "New Message" screen and are not modified ---
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
