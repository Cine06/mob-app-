import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NewMessageScreen = () => {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchCurrentUserAndUsers = async () => {
      setLoading(true);
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);

        const { data, error } = await supabase
          .from('users')
          .select('id, first_name, last_name, profile_picture, role')
          .neq('id', user.id) 
          .neq('role', 'Admin');

        if (error) {
          console.error('Error fetching users:', error);
        } else {
          setUsers(data);
        }
      }
      setLoading(false);
    };

    fetchCurrentUserAndUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) {
      return users;
    }
    return users.filter(user => {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });
  }, [users, searchQuery]);

  const startChat = (user) => {
    router.push({
      pathname: '/messagedetails',
      params: {
        receiverId: user.id,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        avatar: user.profile_picture,
      },
    });
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity style={styles.userItem} onPress={() => startChat(item)}>
      <Image
        source={item.profile_picture ? { uri: item.profile_picture } : require('../assets/default_profile.png')}
        style={styles.avatar}
      />
      <View>
        <Text style={styles.userName}>{`${item.first_name || ''} ${item.last_name || ''}`.trim()}</Text>
        <Text style={styles.userRole}>{item.role}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Message</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for users..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#046a38" />
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
          />
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#046a38', paddingVertical: 15, paddingHorizontal: 10, paddingTop: 40 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', margin: 10, borderRadius: 20, paddingHorizontal: 10 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 40, fontSize: 16 },
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  userName: { fontSize: 16, fontWeight: 'bold' },
  userRole: { fontSize: 14, color: 'gray' },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: 'gray' },
});

export default NewMessageScreen;