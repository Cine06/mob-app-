import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import BottomNav from "../components/BottomNav";
import styles from "../styles/notif";
import { useState, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabaseClient";

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readNotifIds, setReadNotifIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState(new Set());

  const fetchNotifications = async (currentReadIds) => {
    setLoading(true);
    try {
      const userStr = await AsyncStorage.getItem("user");
      if (!userStr) {
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);

      const notifList = [];

      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, created_at, sender:sender_id(id, first_name, last_name)')
        .eq('receiver_id', user.id)
        .eq('read', false); 

      if (messagesError) throw messagesError;

      messages.forEach(msg => {
        notifList.push({
          id: `msg-${msg.id}`,
          message: `New message from ${msg.sender.first_name || 'user'}`,
          eventDate: new Date(msg.created_at),
          route: {
            pathname: '/chat',
            params: {
              senderId: msg.sender.id,
              senderName: `${msg.sender.first_name} ${msg.sender.last_name}`.trim() || 'User'
            }},
          icon: 'envelope'
        });
      });

      if (user.section_id) {
        const { data: assigned, error: assignedError } = await supabase
          .from('assigned_assessments')
          .select('id, deadline, assigned_at, assessment:assessments(id, title, description, questions, type)')
          .eq('section_id', user.section_id)
          .gte('deadline', new Date().toISOString());

        if (assignedError) throw assignedError;

        const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000; 
        const DEADLINE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; 

        assigned.forEach(item => {
          const deadline = new Date(item.deadline);
          const assignedAt = new Date(item.assigned_at);
          const now = new Date();

          if (now - assignedAt < NEW_ITEM_WINDOW_MS) {
            notifList.push({
              id: `new-as-${item.id}`,
              message: `New ${item.assessment.type}: ${item.assessment.title}`,
              eventDate: assignedAt,
              route: {
                pathname: '/lessons',
                params: {
                  initialTab: item.assessment.type === 'Quiz' ? 'quizzes' : 'assignments',
                  itemId: item.id
                }
              },
              icon: 'clipboard-list'
            });
          }

          if (deadline - now > 0 && deadline - now < DEADLINE_WINDOW_MS) {
            notifList.push({
              id: `due-as-${item.id}`,
              message: `Due soon: ${item.assessment.title}`,
              eventDate: deadline, 
              route: {
                pathname: '/lessons',
                params: {
                  initialTab: item.assessment.type === 'Quiz' ? 'quizzes' : 'assignments',
                  itemId: item.id
                }
              },
              icon: 'clock'
            });
          }
        });

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: newHandouts, error: handoutsError } = await supabase.rpc('get_new_handouts_for_section', {
          p_section_id: user.section_id,
          p_since: twentyFourHoursAgo
        });

        if (handoutsError) throw handoutsError;

        newHandouts.forEach(handout => {
          notifList.push({
            id: `hnd-${handout.id}`,
            message: `New Handout: ${handout.handouts_title}`,
            eventDate: new Date(handout.created_at),
            route: {
              pathname: '/handoutDetails',
              params: {
                handout_id: handout.id
              }
            },
            icon: 'file-alt'
          });
        });
      }

      notifList.sort((a, b) => b.eventDate - a.eventDate);

      const formattedNotifications = notifList.map(notif => {
        const eventDate = new Date(notif.eventDate);
        const timeString = eventDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        let time;
        if (notif.message.startsWith('Due soon:')) {
          time = `Due on ${timeString}`;
        } else {
          time = timeString;
        }
        const isRead = currentReadIds.has(notif.id);
        return { ...notif, time, isRead };
      });

      setNotifications(formattedNotifications);

    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      setNotifications([]); 
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadReadStatus = async () => {
        try {
          const storedIds = await AsyncStorage.getItem('readNotificationIds');
          const idsSet = storedIds ? new Set(JSON.parse(storedIds)) : new Set();
          setReadNotifIds(idsSet);
          fetchNotifications(idsSet);
        } catch (e) {
          console.error("Failed to load read notification statuses.", e);
          fetchNotifications(new Set()); 
        }
      };
      loadReadStatus();
    }, [])
  );

  const handleNotificationPress = async (item) => {
    setNotifications(currentNotifs =>
      currentNotifs.map(n => (n.id === item.id ? { ...n, isRead: true } : n))
    );

    const updatedReadIds = new Set(readNotifIds).add(item.id);
    setReadNotifIds(updatedReadIds);
    await AsyncStorage.setItem('readNotificationIds', JSON.stringify(Array.from(updatedReadIds)));

    router.push(item.route);
  };

  const toggleSelection = (notificationId) => {
    setSelectedNotifications(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(notificationId)) {
        newSelection.delete(notificationId);
      } else {
        newSelection.add(notificationId);
      }
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    if (selectedNotifications.size === notifications.length) {
      setSelectedNotifications(new Set());
    } else {
      const allNotificationIds = new Set(notifications.map(n => n.id));
      setSelectedNotifications(allNotificationIds);
    }
  };

  const dismissNotifications = async (idsToDismiss) => {
    if (idsToDismiss.size === 0) return;

    setNotifications(currentNotifs =>
      currentNotifs.filter(n => !idsToDismiss.has(n.id))
    );

    const updatedReadIds = new Set([...readNotifIds, ...idsToDismiss]);
    setReadNotifIds(updatedReadIds);
    await AsyncStorage.setItem('readNotificationIds', JSON.stringify(Array.from(updatedReadIds)));
  };

  const handleDeleteSelected = () => {
    if (selectedNotifications.size === 0) {
      Alert.alert("No Selection", "Please select notifications to delete.");
      return;
    }
    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to delete ${selectedNotifications.size} notification(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await dismissNotifications(selectedNotifications);
            setSelectionMode(false);
            setSelectedNotifications(new Set());
          },
        },
      ]
    );
  };

  const isAllSelected = useMemo(() => {
    return notifications.length > 0 && selectedNotifications.size === notifications.length;
  }, [selectedNotifications, notifications]);

  const renderItem = ({ item }) => {
    const isSelected = selectedNotifications.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && styles.unreadItem, isSelected && styles.selectedItem]}
        onPress={() => selectionMode ? toggleSelection(item.id) : handleNotificationPress(item)}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            toggleSelection(item.id);
          }
        }}
      >
        {selectionMode && (
          <MaterialIcons name={isSelected ? "check-box" : "check-box-outline-blank"} size={24} color="#046a38" style={{ marginRight: 15 }} />
        )}
        <FontAwesome5 name={item.icon || 'bell'} size={20} color="#046a38" style={styles.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
     <Stack.Screen options={{ title: "Notifications" }} />
      <View style={styles.container}> 
        <View style={[styles.header]}>
          {selectionMode ? (
            <>
              <View style={{ 
  flexDirection: 'row', 
  alignItems: 'center', 
  justifyContent: 'space-between', 
  paddingHorizontal: 10, 
  paddingVertical: 8,
}}>
  <TouchableOpacity 
    onPress={() => { 
      setSelectionMode(false); 
      setSelectedNotifications(new Set()); 
    }}
  >
    <Ionicons name="close" size={24} color="#333" />
  </TouchableOpacity>

  <Text style={styles.headerText}>
    {selectedNotifications.size} Selected
  </Text>

  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <TouchableOpacity onPress={handleSelectAll} style={{ marginRight: 20 }}>
      <MaterialIcons 
        name={isAllSelected ? "deselect" : "select-all"} 
        size={24} 
        color="#333" 
      />
    </TouchableOpacity>
    <TouchableOpacity onPress={handleDeleteSelected}>
      <FontAwesome5 name="trash" size={20} color="red" />
    </TouchableOpacity>
  </View>
</View>

            </>
          ) : (
            <>
              <View style={{ 
  flexDirection: "row", 
  alignItems: "center", 
  justifyContent: "space-between",
  paddingHorizontal: 10, 
  marginBottom: 10 
}}>
  <Text style={styles.header}>Notifications</Text>
  <TouchableOpacity onPress={() => setSelectionMode(true)}>
    <FontAwesome5 name="trash-alt" size={20} color="red" />
  </TouchableOpacity>
</View>

            </>
          )}
        </View>

        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color="#046a38" />
        ) : notifications.length === 0 ? (
          <Text style={styles.noNotifications}>No new notifications</Text>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
          />
        )}
        
      </View>
      <BottomNav />
    </>
  );
}
