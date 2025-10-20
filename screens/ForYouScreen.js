import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationListener } from '../contexts/NotificationListenerContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const ForYouScreen = ({ navigation, onNavigateToFavorites }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const { unreadCount: notificationUnreadCount } = useNotificationListener();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  const topPadding = insets.top || (Platform.OS === 'ios' ? 44 : 0);

  // Fetch unread message count
  const fetchUnreadCount = async () => {
    if (!user) return;
    
    try {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid)
      );
      const chatsSnapshot = await getDocs(chatsQuery);
      
      let totalUnread = 0;
      chatsSnapshot.docs.forEach(chatDoc => {
        const chatData = chatDoc.data();
        const unreadCount = chatData.unreadCount?.[user.uid] || 0;
        totalUnread += unreadCount;
      });
      
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, [user]);

  const handleChatPress = () => {
    if (navigation) {
      setUnreadCount(0);
      navigation.navigate('messages');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUnreadCount();
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: colors.primary }]}>
      <StatusBar 
        style={isDarkMode ? "light" : "dark"} 
        backgroundColor={colors.primary}
        translucent={Platform.OS === "android"}
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        animated={true}
        hidden={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <Image
          source={{
            uri: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-uzcx2rUT6ee8nzIBhYHxhd0BdCkXUF.png",
          }}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#83AFA7" style={styles.searchIcon} />
          <TextInput 
            style={[styles.searchInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]} 
            placeholder="Search recommendations" 
            placeholderTextColor="#83AFA7"
            multiline={false}
            textAlign="left"
            textAlignVertical="center"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation && navigation.navigate('updates')}
          >
            <Ionicons name="notifications-outline" size={24} color="#83AFA7" />
            {notificationUnreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => onNavigateToFavorites && onNavigateToFavorites()}
          >
            <Ionicons name="heart-outline" size={24} color="#83AFA7" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleChatPress}>
            <Ionicons name="chatbubble-outline" size={24} color="#83AFA7" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Title and Subtitle */}
      <View style={[styles.subtitleContainer, { backgroundColor: colors.primary }]}>
        <Text style={[
          styles.pageTitle,
          { color: colors.accent },
          { fontFamily: fontsLoaded ? 'Poppins-Bold' : undefined }
        ]}>For You</Text>
        <Text style={[
          styles.headerSubtitle, 
          { color: colors.textSecondary },
          { fontFamily: fontsLoaded ? 'Poppins-Regular' : undefined }
        ]}>Personalized recommendations</Text>
        
        {/* Category Tabs */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
            <TouchableOpacity 
              style={[styles.tab, styles.activeTab]}
              onPress={() => {}}
            >
              <Text style={[styles.tabText, styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Recommended
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => {}}
            >
              <Text style={[styles.tabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Trending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => {}}
            >
              <Text style={[styles.tabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Popular
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#83AFA7']}
            tintColor="#83AFA7"
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#83AFA7" />
            <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? 'Poppins-Medium' : undefined }]}>
              Loading recommendations...
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="sparkles-outline" size={64} color="#83AFA7" />
            <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? 'Poppins-SemiBold' : undefined }]}>
              Your Personalized Feed
            </Text>
            <Text style={[styles.emptyText, { fontFamily: fontsLoaded ? 'Poppins-Regular' : undefined }]}>
              We're curating content just for you based on your interests and activity
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...(Platform.OS === 'android' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  logo: {
    width: 40,
    height: 30,
    marginRight: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginRight: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#F68652',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
  subtitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  tabContainer: {
    backgroundColor: '#DFECE2',
    paddingBottom: 16,
    marginTop: 8,
  },
  tabScroll: {
    paddingRight: 20,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(131, 175, 167, 0.1)',
  },
  activeTab: {
    backgroundColor: '#83AFA7',
  },
  tabText: {
    fontSize: 12,
    color: '#83AFA7',
  },
  activeTabText: {
    color: 'white',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#83AFA7',
    fontFamily: 'Poppins-Medium',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ForYouScreen;
