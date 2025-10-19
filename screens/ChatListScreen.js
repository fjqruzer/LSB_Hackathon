import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ChatService from '../services/ChatService';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const ChatListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  // Load user's chats
  useEffect(() => {
    if (!user?.uid) return;

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chatsData = await Promise.all(
        snapshot.docs.map(async (chatDoc) => {
          const chatData = chatDoc.data();
          const otherUserId = chatData.participants.find(id => id !== user.uid);
          
          // Get other user's info
          let otherUser = { id: otherUserId, name: 'Unknown User', avatar: null, isOnline: false };
          if (otherUserId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', otherUserId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                otherUser = {
                  id: otherUserId,
                  name: userData.displayName || userData.name || 'Unknown User',
                  avatar: userData.photoURL || userData.avatar,
                  isOnline: userData.isOnline || false,
                  lastSeen: userData.lastSeen,
                };
              }
            } catch (error) {
              console.error('Error fetching user data:', error);
            }
          }

          return {
            id: chatDoc.id,
            ...chatData,
            otherUser,
            unreadCount: chatData.unreadCount?.[user.uid] || 0,
          };
        })
      );

      // Sort by lastActivity in JavaScript
      const sortedChats = chatsData.sort((a, b) => {
        const aTime = a.lastActivity?.toDate ? a.lastActivity.toDate() : new Date(a.lastActivity || 0);
        const bTime = b.lastActivity?.toDate ? b.lastActivity.toDate() : new Date(b.lastActivity || 0);
        return bTime - aTime; // Descending order (most recent first)
      });

      setChats(sortedChats);
      setFilteredChats(sortedChats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Filter chats based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat => {
        const searchLower = searchQuery.toLowerCase();
        return (
          chat.otherUser.name.toLowerCase().includes(searchLower) ||
          (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchLower)) ||
          (chat.listing && chat.listing.title.toLowerCase().includes(searchLower))
        );
      });
      setFilteredChats(filtered);
    }
  }, [searchQuery, chats]);

  const onRefresh = async () => {
    setRefreshing(true);
    // The real-time listener will automatically update the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    if (isSearchVisible) {
      setSearchQuery('');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const navigateToChat = (chat) => {
    navigation.navigate('Chat', {
      chatId: chat.id,
      otherUser: chat.otherUser,
      listing: chat.listing,
    });
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.chatItem, { backgroundColor: colors.secondary }]}
      onPress={() => navigateToChat(item)}
    >
      <Image
        source={{ uri: item.otherUser.avatar || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={[
            styles.chatName,
            { color: colors.text },
            { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
          ]}>
            {item.otherUser.name}
          </Text>
          <Text style={[
            styles.chatTime,
            { color: colors.textSecondary },
            { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
          ]}>
            {formatTime(item.lastMessageTime)}
          </Text>
        </View>
        
        <View style={styles.chatPreview}>
          <Text
            style={[
              styles.lastMessage,
              { color: colors.textSecondary },
              { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
            ]}
            numberOfLines={1}
          >
            {item.lastMessage || 'No messages yet'}
          </Text>
          
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
              <Text style={[
                styles.unreadText,
                { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
              ]}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
        
        {/* Listing Context */}
        {item.listing && (
          <View style={styles.listingContext}>
            <Image source={{ uri: item.listing.image }} style={styles.listingImage} />
            <View style={styles.listingInfo}>
              <Text style={[
                styles.listingTitle,
                { color: colors.textSecondary },
                { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
              ]}>
                {item.listing.title}
              </Text>
              <Text style={[
                styles.listingPrice,
                { color: colors.accent },
                { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
              ]}>
                {ChatService.getDisplayPrice(item.listing)}
              </Text>
            </View>
          </View>
        )}
      </View>
      
      {item.otherUser.isOnline && (
        <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color="#83AFA7" />
      <Text style={[
        styles.emptyText,
        { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
      ]}>
        No Conversations Yet
      </Text>
      <Text style={[
        styles.emptySubtext,
        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
      ]}>
        Start a conversation by messaging a seller or buyer
      </Text>
    </View>
  );

  const renderSearchEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search" size={64} color="#83AFA7" />
      <Text style={[
        styles.emptyText,
        { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
      ]}>
        No Results Found
      </Text>
      <Text style={[
        styles.emptySubtext,
        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
      ]}>
        Try searching with different keywords
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[
          styles.loadingText,
          { color: colors.text },
          { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
        ]}>
          Loading conversations...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        
        {!isSearchVisible ? (
          <>
            <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
              Messages
            </Text>
            <TouchableOpacity style={styles.searchButton} onPress={toggleSearch}>
              <Ionicons name="search" size={24} color={colors.accent} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.accent} style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                { 
                  color: colors.text,
                },
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
              ]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search conversations..."
              placeholderTextColor={colors.placeholder}
              autoFocus={true}
              multiline={false}
              textAlign="left"
              textAlignVertical="center"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={toggleSearch}>
              <Text style={[styles.cancelText, { color: colors.accent, fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={isSearchVisible && searchQuery.trim() ? renderSearchEmptyState : renderEmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 44,
    backgroundColor: '#DFECE2',
    ...(Platform.OS === 'android' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#83AFA7',
  },
  searchButton: {
    padding: 4,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginLeft: 8,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  cancelButton: {
    padding: 8,
    marginLeft: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  chatTime: {
    fontSize: 11,
  },
  chatPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 12,
    flex: 1,
    marginRight: 6,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  listingContext: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    padding: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#83AFA7',
  },
  listingImage: {
    width: 24,
    height: 24,
    borderRadius: 3,
    marginRight: 6,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 10,
    marginBottom: 1,
  },
  listingPrice: {
    fontSize: 12,
    fontWeight: '600',
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    right: 16,
    top: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#83AFA7',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default ChatListScreen;
