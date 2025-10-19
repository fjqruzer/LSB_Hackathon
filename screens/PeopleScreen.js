import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Platform, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc, deleteDoc, getDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const PeopleScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('discover'); // 'discover', 'following', 'followers'
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [featuredUsers, setFeaturedUsers] = useState([]);
  const [topSellers, setTopSellers] = useState([]);
  
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

  // Load users from Firebase
  useEffect(() => {
    loadUsers();
  }, []);

  // Load all users from Firebase
  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Get all users from Firebase
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const usersData = [];
      
      // Load real stats for each user
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        const userId = doc.id;
        
        // Get real followers count
        const followersQuery = query(
          collection(db, 'following'),
          where('followingId', '==', userId)
        );
        const followersSnapshot = await getDocs(followersQuery);
        const followersCount = followersSnapshot.size;
        
        // Get real sales count
        const salesQuery = query(
          collection(db, 'payments'),
          where('sellerId', '==', userId),
          where('status', '==', 'sold')
        );
        const salesSnapshot = await getDocs(salesQuery);
        const salesCount = salesSnapshot.size;
        
        // Get real rating
        const ratingsQuery = query(
          collection(db, 'ratings'),
          where('sellerId', '==', userId)
        );
        const ratingsSnapshot = await getDocs(ratingsQuery);
        const ratings = [];
        ratingsSnapshot.forEach(ratingDoc => {
          ratings.push(ratingDoc.data().rating);
        });
        const averageRating = ratings.length > 0 ? 
          (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) : 0;
        
        usersData.push({
          id: userId,
          ...userData,
          // Ensure we have required fields with defaults
          name: userData.displayName || userData.name || 'Unknown User',
          username: userData.username || `@${userData.email?.split('@')[0] || 'user'}`,
          avatar: userData.photoURL || userData.avatar,
          followers: followersCount,
          itemsSold: salesCount,
          rating: averageRating,
          isVerified: userData.isVerified || false,
        });
      }

      setAllUsers(usersData);
      
      // Get featured users (users with most followers)
      const featured = usersData
        .filter(u => u.id !== user?.uid) // Exclude current user
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 3);
      setFeaturedUsers(featured);

      // Get top sellers (users with most sales)
      const sellers = usersData
        .filter(u => u.id !== user?.uid) // Exclude current user
        .sort((a, b) => b.itemsSold - a.itemsSold)
        .slice(0, 3)
        .map(seller => ({
          ...seller,
          sales: `${seller.itemsSold} items`,
        }));
      setTopSellers(sellers);

    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load following data
  useEffect(() => {
    if (user?.uid) {
      loadFollowingData();
    }
  }, [user?.uid]);

  // Load following and followers data
  const loadFollowingData = async () => {
    try {
      setLoading(true);
      
      // Load following
      const followingQuery = query(
        collection(db, 'following'),
        where('followerId', '==', user.uid)
      );
      const followingSnapshot = await getDocs(followingQuery);
      const followingData = followingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFollowing(followingData);
      setFollowingIds(new Set(followingData.map(f => f.followingId)));

      // Load followers
      const followersQuery = query(
        collection(db, 'following'),
        where('followingId', '==', user.uid)
      );
      const followersSnapshot = await getDocs(followersQuery);
      const followersData = followersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFollowers(followersData);
    } catch (error) {
      console.error('Error loading following data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Follow/Unfollow functionality
  const handleFollow = async (targetUserId, targetUserData) => {
    if (!user?.uid) {
      Alert.alert('Error', 'Please log in to follow users');
      return;
    }

    if (targetUserId === user.uid) {
      Alert.alert('Error', 'You cannot follow yourself');
      return;
    }

    try {
      setLoading(true);
      const followId = `${user.uid}_${targetUserId}`;
      const followRef = doc(db, 'following', followId);

      if (followingIds.has(targetUserId)) {
        // Unfollow
        await deleteDoc(followRef);
        setFollowing(prev => prev.filter(f => f.followingId !== targetUserId));
        setFollowingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });
        Alert.alert('Success', 'You unfollowed this user');
      } else {
        // Follow
        await setDoc(followRef, {
          followerId: user.uid,
          followingId: targetUserId,
          followerName: user.displayName || user.email,
          followingName: targetUserData.name || 'Unknown User',
          followingUsername: targetUserData.username || '@user',
          followingAvatar: targetUserData.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face",
          followedAt: new Date(),
          createdAt: new Date()
        });
        
        setFollowing(prev => [...prev, {
          id: followId,
          followerId: user.uid,
          followingId: targetUserId,
          followingName: targetUserData.name || 'Unknown User',
          followingUsername: targetUserData.username || '@user',
          followingAvatar: targetUserData.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face",
          followedAt: new Date()
        }]);
        
        setFollowingIds(prev => new Set([...prev, targetUserId]));
        Alert.alert('Success', 'You are now following this user');
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      Alert.alert('Error', 'Failed to follow/unfollow user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (userId) => {
    if (navigation) {
      navigation.navigate('UserProfile', { userId });
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'Unknown date';
    
    try {
      let date;
      // Handle Firestore timestamp
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      } else {
        // Handle regular Date object or string
        date = new Date(dateValue);
      }
      
      // Format as "Month Year" (e.g., "December 2023")
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  // Search functionality
  const filteredUsers = allUsers.filter(userData => 
    userData.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    userData.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    userData.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = (text) => {
    setSearchQuery(text);
    setIsSearching(text.length > 0);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

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
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={[
          styles.headerTitle, 
          { color: colors.accent },
          { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }
        ]}>People</Text>
        <Text style={[
          styles.headerSubtitle, 
          { color: colors.textSecondary },
          { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
        ]}>Connect with sellers and buyers</Text>
        
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
            {[
              { key: 'discover', label: 'Discover' },
              { key: 'following', label: 'Following', count: following.length },
              { key: 'followers', label: 'Followers', count: followers.length },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[
                  styles.tabText,
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                  activeTab === tab.key && styles.activeTabText
                ]}>
                  {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Search Bar - Only show on discover tab */}
        {activeTab === 'discover' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#83AFA7" style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
              ]}
              placeholder="Search people or usernames..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#83AFA7" />
          <Text style={[
            styles.loadingText,
            { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
          ]}>Loading users...</Text>
        </View>
      ) : activeTab === 'following' ? (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={[
              styles.sectionTitle,
              { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
            ]}>People You Follow ({following.length})</Text>
            {following.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#83AFA7" />
                <Text style={[
                  styles.emptyStateTitle,
                  { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                ]}>No Following Yet</Text>
                <Text style={[
                  styles.emptyStateText,
                  { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                ]}>Start following people to see their updates here</Text>
              </View>
            ) : (
              <FlatList
                data={following}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.followingCard}
                    onPress={() => handleUserPress(item.followingId)}
                  >
                    <Image 
                      source={{ uri: item.followingAvatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face" }} 
                      style={styles.followingAvatar} 
                    />
                    <View style={styles.followingInfo}>
                      <Text style={[
                        styles.followingName,
                        { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                      ]}>{item.followingName}</Text>
                      <Text style={[
                        styles.followingUsername,
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                      ]}>{item.followingUsername}</Text>
                      <Text style={[
                        styles.followingDate,
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                      ]}>
                        Following since {formatDate(item.followedAt)}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.unfollowButton}
                      onPress={() => handleFollow(item.followingId, {
                        name: item.followingName,
                        username: item.followingUsername,
                        avatar: item.followingAvatar
                      })}
                    >
                      <Text style={[
                        styles.unfollowButtonText,
                        { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
                      ]}>Unfollow</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.followingList}
              />
            )}
          </View>
        </View>
      ) : activeTab === 'followers' ? (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={[
              styles.sectionTitle,
              { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
            ]}>Your Followers ({followers.length})</Text>
            {followers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#83AFA7" />
                <Text style={[
                  styles.emptyStateTitle,
                  { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                ]}>No Followers Yet</Text>
                <Text style={[
                  styles.emptyStateText,
                  { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                ]}>When people follow you, they'll appear here</Text>
              </View>
            ) : (
              <FlatList
                data={followers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.followerCard}
                    onPress={() => handleUserPress(item.followerId)}
                  >
                    <Image 
                      source={{ uri: item.followerAvatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face" }} 
                      style={styles.followerAvatar} 
                    />
                    <View style={styles.followerInfo}>
                      <Text style={[
                        styles.followerName,
                        { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                      ]}>{item.followerName}</Text>
                      <Text style={[
                        styles.followerDate,
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                      ]}>
                        Started following {formatDate(item.followedAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.followersList}
              />
            )}
          </View>
        </View>
      ) : isSearching ? (
        <View style={styles.content}>
          <View style={styles.searchResultsHeader}>
            <Text style={[
              styles.searchResultsTitle,
              { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
            ]}>
              {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.searchResultCard}>
                <View style={styles.searchResultHeader}>
                    <Image 
                      source={{ uri: item.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face" }} 
                      style={styles.searchResultAvatar} 
                    />
                  {item.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark" size={12} color="white" />
                    </View>
                  )}
                </View>
                <View style={styles.searchResultInfo}>
                  <Text style={[
                    styles.searchResultName,
                    { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                  ]}>{item.name}</Text>
                  <Text style={[
                    styles.searchResultUsername,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                  ]}>{item.username}</Text>
                  <View style={styles.searchResultStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="people" size={12} color="#83AFA7" />
                      <Text style={[
                        styles.statText,
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                      ]}>{item.followers || 0}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="bag" size={12} color="#83AFA7" />
                      <Text style={[
                        styles.statText,
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                      ]}>{item.itemsSold || 0}</Text>
                    </View>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={12} color="#F68652" />
                      <Text style={[
                        styles.ratingText,
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                      ]}>{item.rating?.toFixed(1) || '0.0'}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.followButton,
                    followingIds.has(item.id.toString()) && styles.followingButton
                  ]}
                  onPress={() => handleFollow(item.id.toString(), item)}
                  disabled={loading}
                >
                  <Text style={[
                    styles.followButtonText,
                    followingIds.has(item.id.toString()) && styles.followingButtonText,
                    { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
                  ]}>
                    {followingIds.has(item.id.toString()) ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.searchResultsContent}
          />
        </View>
      ) : (
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

        {/* Featured Users */}
        <View style={styles.section}>
          <Text style={[
            styles.sectionTitle,
            { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
          ]}>Featured Users</Text>
          <View style={styles.usersGrid}>
            {featuredUsers.map((user) => (
              <TouchableOpacity 
                key={user.id} 
                style={styles.userCard}
                onPress={() => handleUserPress(user.id)}
              >
                <View style={styles.userHeader}>
                    <Image 
                      source={{ uri: user.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face" }} 
                      style={styles.userAvatar} 
                    />
                  {user.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark" size={12} color="white" />
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={[
                    styles.userName,
                    { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                  ]}>{user.name}</Text>
                  <Text style={[
                    styles.userUsername,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                  ]}>{user.username}</Text>
                  <View style={styles.userStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="people" size={12} color="#83AFA7" />
                      <Text style={[
                        styles.statText,
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                      ]}>{user.followers || 0}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="bag" size={12} color="#83AFA7" />
                      <Text style={[
                        styles.statText,
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                      ]}>{user.itemsSold || 0}</Text>
                    </View>
                  </View>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={12} color="#F68652" />
                    <Text style={[
                      styles.ratingText,
                      { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                    ]}>{user.rating?.toFixed(1) || '0.0'}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.followButton,
                    followingIds.has(user.id.toString()) && styles.followingButton
                  ]}
                  onPress={() => handleFollow(user.id.toString(), user)}
                  disabled={loading}
                >
                  <Text style={[
                    styles.followButtonText,
                    followingIds.has(user.id.toString()) && styles.followingButtonText,
                    { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
                  ]}>
                    {followingIds.has(user.id.toString()) ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Top Sellers */}
        <View style={styles.section}>
          <Text style={[
            styles.sectionTitle,
            { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
          ]}>Top Sellers</Text>
          <View style={styles.sellersList}>
            {topSellers.map((seller, index) => (
              <TouchableOpacity 
                key={seller.id} 
                style={styles.sellerCard}
                onPress={() => handleUserPress(seller.id)}
              >
                <View style={styles.sellerRank}>
                  <Text style={[
                    styles.rankNumber,
                    { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }
                  ]}>{index + 1}</Text>
                </View>
                <Image 
                  source={{ uri: seller.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face" }} 
                  style={styles.sellerAvatar} 
                />
                <View style={styles.sellerInfo}>
                  <Text style={[
                    styles.sellerName,
                    { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                  ]}>{seller.name}</Text>
                  <Text style={[
                    styles.sellerUsername,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                  ]}>{seller.username}</Text>
                  <Text style={[
                    styles.sellerSales,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                  ]}>{seller.sales}</Text>
                </View>
                <View style={styles.sellerRating}>
                  <Ionicons name="star" size={14} color="#F68652" />
                  <Text style={[
                    styles.sellerRatingText,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                  ]}>{seller.rating?.toFixed(1) || '0.0'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  usersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  userCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  userHeader: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    resizeMode: 'cover',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontSize: 12,
    color: '#333',
    marginBottom: 1,
  },
  userUsername: {
    fontSize: 10,
    color: '#83AFA7',
    marginBottom: 6,
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 9,
    color: '#666',
    marginLeft: 3,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 3,
  },
  followButton: {
    backgroundColor: '#83AFA7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'center',
  },
  followButtonText: {
    color: 'white',
    fontSize: 10,
  },
  sellersList: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sellerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F68652',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankNumber: {
    color: 'white',
    fontSize: 12,
  },
  sellerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    resizeMode: 'cover',
    marginRight: 10,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 12,
    color: '#333',
    marginBottom: 1,
  },
  sellerUsername: {
    fontSize: 10,
    color: '#83AFA7',
    marginBottom: 1,
  },
  sellerSales: {
    fontSize: 10,
    color: '#666',
  },
  sellerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerRatingText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 3,
  },
  // Search styles
  searchContainer: {
    marginTop: 3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 10,
    height: Platform.OS === 'ios' ? 40 : 44,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    ...(Platform.OS === 'android' && {
      height: '100%',
      lineHeight: 14,
    }),
  },
  clearButton: {
    marginLeft: 8,
  },
  // Search results styles
  searchResultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#DFECE2',
  },
  searchResultsTitle: {
    fontSize: 14,
    color: '#333',
  },
  searchResultsContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  searchResultHeader: {
    position: 'relative',
    marginRight: 12,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 1,
  },
  searchResultUsername: {
    fontSize: 12,
    color: '#83AFA7',
    marginBottom: 6,
  },
  searchResultStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Tab Navigation Styles
  tabContainer: {
    backgroundColor: '#DFECE2',
    paddingBottom: 16,
    marginTop: 8,
  },
  tabScroll: {
    paddingHorizontal: 20,
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
  // Following/Followers Styles
  followingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  followingAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  followingInfo: {
    flex: 1,
  },
  followingName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  followingUsername: {
    fontSize: 14,
    color: '#83AFA7',
    marginBottom: 4,
  },
  followingDate: {
    fontSize: 12,
    color: '#666',
  },
  unfollowButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  unfollowButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  followerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  followerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  followerInfo: {
    flex: 1,
  },
  followerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  followerDate: {
    fontSize: 12,
    color: '#666',
  },
  followingList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  followersList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  // Empty State Styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    color: '#83AFA7',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Follow Button States
  followingButton: {
    backgroundColor: '#F68652',
  },
  followingButtonText: {
    color: 'white',
  },
  // Loading Styles
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
  },
});

export default PeopleScreen;
