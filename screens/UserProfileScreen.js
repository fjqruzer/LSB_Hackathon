import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc, deleteDoc, getDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import ChatService from '../services/ChatService';

const { width } = Dimensions.get('window');

const UserProfileScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();
  const { user: currentUser } = useAuth();
  const { userId } = route.params;
  
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [userListings, setUserListings] = useState([]);
  const [activeTab, setActiveTab] = useState('listings'); // 'listings', 'about', 'comments'
  const [userStats, setUserStats] = useState({
    totalSales: 0,
    averageRating: 0,
    totalRatings: 0
  });
  const [userComments, setUserComments] = useState([]);
  const [defaultAddress, setDefaultAddress] = useState(null);
  
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

  const isOwnProfile = currentUser?.uid === userId;

  // Load user profile data
  useEffect(() => {
    if (userId) {
      loadUserProfile();
      loadUserListings();
      checkFollowingStatus();
      loadFollowCounts();
      loadUserStats();
      loadUserComments();
      loadDefaultAddress();
    }
  }, [userId, currentUser]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfileUser({
          id: userDoc.id,
          ...userData,
          name: userData.displayName || userData.name || 'Unknown User',
          username: userData.username || `@${userData.email?.split('@')[0] || 'user'}`,
          avatar: userData.photoURL || userData.avatar,
          bio: userData.bio || 'No bio available',
          location: userData.location || 'Location not specified',
          joinedDate: userData.createdAt || userData.joinedDate,
          rating: userData.rating || 4.0,
          itemsSold: userData.itemsSold || 0,
          isVerified: userData.isVerified || false,
        });
      } else {
        Alert.alert('Error', 'User profile not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const loadUserListings = async () => {
    try {
      console.log('🔍 UserProfileScreen - Loading listings for userId:', userId);
      const listingsQuery = query(
        collection(db, 'listings'),
        where('sellerId', '==', userId)
      );
      const listingsSnapshot = await getDocs(listingsQuery);
      
      const listings = listingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return bTime - aTime;
      });
      
      console.log('🔍 UserProfileScreen - Loaded listings:', listings.length, 'items');
      console.log('🔍 UserProfileScreen - First listing sample:', listings[0]);
      setUserListings(listings);
    } catch (error) {
      console.error('❌ UserProfileScreen - Error loading user listings:', error);
    }
  };

  // Get display price based on price type (consistent with marketplace)
  const getDisplayPrice = (listing) => {
    if (listing.priceType === 'msl') {
      return `₱${listing.lockPrice?.toLocaleString() || '0'}`;
    } else if (listing.priceType === 'bidding') {
      return `₱${listing.currentBid?.toLocaleString() || listing.startingPrice?.toLocaleString() || '0'}`;
    }
    return `₱${listing.price?.toLocaleString() || '0'}`;
  };

  // Get status text (consistent with marketplace)
  const getStatusText = (listing) => {
    if (listing.status === 'sold') return 'Sold';
    if (listing.status === 'expired') return 'Expired';
    return listing.priceType === 'msl' ? 'M-S-L' : 'Bidding';
  };

  const checkFollowingStatus = async () => {
    if (!currentUser || isOwnProfile) return;
    
    try {
      const followingDoc = await getDoc(doc(db, 'following', `${currentUser.uid}_${userId}`));
      setIsFollowing(followingDoc.exists());
    } catch (error) {
      console.error('Error checking following status:', error);
    }
  };

  const loadFollowCounts = async () => {
    try {
      // Get followers count
      const followersQuery = query(
        collection(db, 'following'),
        where('followingId', '==', userId)
      );
      const followersSnapshot = await getDocs(followersQuery);
      setFollowersCount(followersSnapshot.size);

      // Get following count
      const followingQuery = query(
        collection(db, 'following'),
        where('followerId', '==', userId)
      );
      const followingSnapshot = await getDocs(followingQuery);
      setFollowingCount(followingSnapshot.size);
    } catch (error) {
      console.error('Error loading follow counts:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      // Get total sales from payments collection
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('sellerId', '==', userId),
        where('status', '==', 'sold')
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const totalSales = paymentsSnapshot.size;

      // Get ratings and calculate average
      const ratingsQuery = query(
        collection(db, 'ratings'),
        where('sellerId', '==', userId)
      );
      const ratingsSnapshot = await getDocs(ratingsQuery);
      const ratings = [];
      ratingsSnapshot.forEach(doc => {
        ratings.push(doc.data().rating);
      });

      const totalRatings = ratings.length;
      const averageRating = totalRatings > 0 ? 
        (ratings.reduce((sum, rating) => sum + rating, 0) / totalRatings) : 0;

      setUserStats({
        totalSales,
        averageRating,
        totalRatings
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadUserComments = async () => {
    try {
      const ratingsQuery = query(
        collection(db, 'ratings'),
        where('sellerId', '==', userId)
      );
      const ratingsSnapshot = await getDocs(ratingsQuery);
      const comments = [];
      
      for (const docSnapshot of ratingsSnapshot.docs) {
        const ratingData = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Get listing details
        try {
          const listingDoc = await getDoc(doc(db, 'listings', ratingData.listingId));
          if (listingDoc.exists()) {
            ratingData.listingData = { id: listingDoc.id, ...listingDoc.data() };
          }
        } catch (error) {
          console.error('Error fetching listing data:', error);
        }
        
        comments.push(ratingData);
      }
      
      // Sort by creation date (newest first)
      comments.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bTime - aTime;
      });
      
      setUserComments(comments);
    } catch (error) {
      console.error('Error loading user comments:', error);
    }
  };

  const loadDefaultAddress = async () => {
    try {
      console.log('🏠 Loading default address for user:', userId);
      
      // First try to get all addresses for this user
      const allAddressesQuery = query(
        collection(db, 'addresses'),
        where('userId', '==', userId)
      );
      const allAddressesSnapshot = await getDocs(allAddressesQuery);
      console.log('🏠 Total addresses for user:', allAddressesSnapshot.size);
      
      if (!allAddressesSnapshot.empty) {
        // Look for default address
        let defaultAddr = null;
        allAddressesSnapshot.docs.forEach((doc, index) => {
          const addr = doc.data();
          console.log(`🏠 Address ${index + 1}:`, {
            id: doc.id,
            isDefault: addr.isDefault,
            isDefaultType: typeof addr.isDefault,
            cityName: addr.cityName,
            city: addr.city
          });
          
          // Check for default address (handle both boolean true and string "true")
          if (addr.isDefault === true || addr.isDefault === 'true') {
            defaultAddr = addr;
            console.log('🏠 Found default address at index:', index);
          }
        });
        
        if (defaultAddr) {
          console.log('🏠 Setting default address:', defaultAddr);
          setDefaultAddress(defaultAddr);
        } else {
          console.log('🏠 No default address found, using first address as fallback');
          // Use first address as fallback if no default is set
          const firstAddr = allAddressesSnapshot.docs[0].data();
          setDefaultAddress(firstAddr);
        }
      } else {
        console.log('🏠 No addresses found for user');
        setDefaultAddress(null);
      }
    } catch (error) {
      console.error('❌ Error loading default address:', error);
      setDefaultAddress(null);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || isOwnProfile) return;
    
    try {
      const followId = `${currentUser.uid}_${userId}`;
      
      if (isFollowing) {
        // Unfollow
        await deleteDoc(doc(db, 'following', followId));
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        // Follow
        await setDoc(doc(db, 'following', followId), {
          followerId: currentUser.uid,
          followingId: userId,
          createdAt: new Date(),
        });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleMessageUser = async () => {
    if (!currentUser || isOwnProfile) return;
    
    try {
      // Create or get chat using ChatService
      const chat = await ChatService.createOrGetChat(currentUser.uid, userId, null);
      
      if (chat) {
        navigation.navigate('Chat', {
          chatId: chat.id,
          otherUser: {
            id: userId,
            name: profileUser?.name || 'User',
            avatar: profileUser?.avatar,
          }
        });
      } else {
        Alert.alert('Error', 'Failed to create chat. Please try again.');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const handleListingPress = (listing) => {
    if (!listing) {
      console.error('❌ UserProfileScreen - Cannot navigate: listing is null/undefined');
      Alert.alert('Error', 'Listing information is not available');
      return;
    }
    
    console.log('🔍 UserProfileScreen - Navigating to ListingDetails with:', listing);
    navigation.navigate('ListingDetails', { 
      listing: { ...listing, fromUserProfile: true } 
    });
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  const renderStars = (rating) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? "star" : "star-outline"}
            size={14}
            color={star <= rating ? "#FFD700" : "#DDD"}
          />
        ))}
      </View>
    );
  };

  const getRatingText = (rating) => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'No Rating';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.primary }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[
            styles.loadingText, 
            { color: colors.text },
            { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
          ]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={[styles.container, { backgroundColor: colors.primary }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.errorContainer}>
          <Text style={[
            styles.errorText, 
            { color: colors.text },
            { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
          ]}>User not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[
          styles.headerTitle, 
          { color: colors.accent },
          { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
        ]}>
          {isOwnProfile ? 'My Profile' : 'Profile'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colors.secondary }]}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: profileUser.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face" }} 
              style={styles.avatar} 
            />
            {profileUser.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={16} color="white" />
              </View>
            )}
          </View>
          
          <Text style={[
            styles.userName, 
            { color: colors.text },
            { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }
          ]}>
            {profileUser.name}
          </Text>
          <Text style={[
            styles.username, 
            { color: colors.textSecondary },
            { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
          ]}>
            {profileUser.username}
          </Text>
          

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[
                styles.statNumber, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }
              ]}>
                {followersCount}
              </Text>
              <Text style={[
                styles.statLabel, 
                { color: colors.textSecondary },
                { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
              ]}>
                Followers
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[
                styles.statNumber, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }
              ]}>
                {followingCount}
              </Text>
              <Text style={[
                styles.statLabel, 
                { color: colors.textSecondary },
                { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
              ]}>
                Following
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[
                styles.statNumber, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }
              ]}>
                {userStats.totalSales}
              </Text>
              <Text style={[
                styles.statLabel, 
                { color: colors.textSecondary },
                { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
              ]}>
                Items Sold
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[
                styles.statNumber, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }
              ]}>
                {userStats.averageRating?.toFixed(1) || '0.0'}
              </Text>
              <Text style={[
                styles.statLabel, 
                { color: colors.textSecondary },
                { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
              ]}>
                Rating ({userStats.totalRatings})
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  { backgroundColor: isFollowing ? colors.border : colors.accent }
                ]}
                onPress={handleFollow}
              >
                <Text style={[
                  styles.followButtonText,
                  { color: isFollowing ? colors.text : 'white' }
                ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.messageButton, { borderColor: colors.accent }]}
                onPress={handleMessageUser}
              >
                <Ionicons name="chatbubble-outline" size={20} color={colors.accent} />
                <Text style={[
                  styles.messageButtonText, 
                  { color: colors.accent },
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
                ]}>
                  Message
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[
            styles.joinedDate, 
            { color: colors.textSecondary },
            { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
          ]}>
            Joined {formatDate(profileUser.joinedDate)}
          </Text>
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: colors.secondary }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'listings' && styles.activeTab,
              { borderBottomColor: colors.accent }
            ]}
            onPress={() => setActiveTab('listings')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'listings' ? colors.accent : colors.textSecondary },
              { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
            ]}>
              Listings ({userListings.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'about' && styles.activeTab,
              { borderBottomColor: colors.accent }
            ]}
            onPress={() => setActiveTab('about')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'about' ? colors.accent : colors.textSecondary },
              { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
            ]}>
              About
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'comments' && styles.activeTab,
              { borderBottomColor: colors.accent }
            ]}
            onPress={() => setActiveTab('comments')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'comments' ? colors.accent : colors.textSecondary },
              { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
            ]}>
              Comments ({userComments.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'listings' ? (
          <View style={styles.listingsContainer}>
            {userListings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="storefront-outline" size={64} color="#83AFA7" />
                <Text style={[
                  styles.emptyText,
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
                ]}>
                  No listings yet
                </Text>
                <Text style={[
                  styles.emptySubtext,
                  { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                ]}>
                  This user hasn't posted any listings yet
                </Text>
              </View>
            ) : (
              <View style={styles.listingsGrid}>
                {userListings.filter(listing => listing && listing.id).map((listing) => (
                  <TouchableOpacity
                    key={listing.id}
                    style={[styles.listingCard, { backgroundColor: colors.surface }]}
                    onPress={() => handleListingPress(listing)}
                  >
                    <Image
                      source={{ uri: listing.images?.[0] || listing.image || 'https://via.placeholder.com/200' }}
                      style={styles.listingImage}
                    />
                    <View style={styles.listingInfo}>
                      <Text style={[
                        styles.listingTitle, 
                        { color: colors.text },
                        { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                      ]} numberOfLines={2}>
                        {listing.title}
                      </Text>
                      <View style={styles.priceRow}>
                        <Text style={[
                          styles.listingPrice, 
                          { color: colors.accent },
                          { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }
                        ]}>
                          {getDisplayPrice(listing)}
                        </Text>
                        <Text style={[
                          styles.statusText, 
                          { color: colors.textSecondary },
                          { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                        ]}>
                          • {getStatusText(listing)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : activeTab === 'about' ? (
          <View style={[styles.aboutContainer, { backgroundColor: colors.secondary }]}>
            <View style={styles.aboutSection}>
              <Text style={[
                styles.aboutTitle, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
              ]}>About</Text>
              <Text style={[
                styles.aboutText, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
              ]}>
                {profileUser.bio || 'No additional information available.'}
              </Text>
            </View>
            
            <View style={styles.aboutSection}>
              <Text style={[
                styles.aboutTitle, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
              ]}>Location</Text>
              <Text style={[
                styles.aboutText, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
              ]}>
                {(() => {
                  console.log('🏠 Rendering location - defaultAddress:', defaultAddress);
                  console.log('🏠 Rendering location - profileUser.location:', profileUser.location);
                  
                  if (defaultAddress) {
                    // Only use cityName (readable name), never use city code
                    const cityDisplay = defaultAddress.cityName || 'City not specified';
                    console.log('🏠 Using default address city:', cityDisplay);
                    return cityDisplay;
                  } else {
                    const fallbackLocation = profileUser.location || 'Not specified';
                    console.log('🏠 Using fallback location:', fallbackLocation);
                    return fallbackLocation;
                  }
                })()}
              </Text>
            </View>
            
            <View style={styles.aboutSection}>
              <Text style={[
                styles.aboutTitle, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
              ]}>Member Since</Text>
              <Text style={[
                styles.aboutText, 
                { color: colors.text },
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
              ]}>
                {formatDate(profileUser.joinedDate)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.commentsContainer, { backgroundColor: colors.secondary }]}>
            {userComments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#83AFA7" />
                <Text style={[
                  styles.emptyTitle,
                  { color: colors.text },
                  { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
                ]}>
                  No Comments Yet
                </Text>
                <Text style={[
                  styles.emptySubtitle,
                  { color: colors.textSecondary },
                  { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                ]}>
                  This user hasn't received any buyer comments yet.
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {userComments.map((comment) => (
                  <View key={comment.id} style={[styles.commentCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.commentHeader}>
                      <View style={[styles.commentIcon, { backgroundColor: '#83AFA720' }]}>
                        <Text style={[styles.commentInitial, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                          {comment.buyerName ? comment.buyerName.charAt(0).toUpperCase() : 'B'}
                        </Text>
                      </View>
                      <View style={styles.commentContent}>
                        <Text style={[styles.commentTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                          {comment.buyerName || 'Anonymous Buyer'}
                        </Text>
                        <Text style={[styles.commentSubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                          {formatDate(comment.createdAt)} • {getRatingText(comment.rating)}
                        </Text>
                      </View>
                      <View style={styles.ratingContainer}>
                        {renderStars(comment.rating)}
                      </View>
                    </View>

                    {comment.listingData && (
                      <View style={styles.listingInfo}>
                        <Text style={[styles.listingLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                          For: {comment.listingData.title}
                        </Text>
                      </View>
                    )}

                    {comment.comment && (
                      <View style={styles.commentTextContainer}>
                        <Text style={[styles.commentText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                          "{comment.comment}"
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 44,
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
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#83AFA7',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 3,
    textAlign: 'center',
  },
  username: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  bio: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  location: {
    marginLeft: 4,
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 90,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
  },
  messageButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  joinedDate: {
    fontSize: 11,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#83AFA7',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listingsContainer: {
    padding: 12,
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
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  listingCard: {
    width: '48%',
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'android' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  listingImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  listingInfo: {
    padding: 8,
  },
  listingTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    marginLeft: 4,
  },
  aboutContainer: {
    padding: 12,
  },
  aboutSection: {
    marginBottom: 20,
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  aboutText: {
    fontSize: 12,
    lineHeight: 16,
  },
  commentsContainer: {
    padding: 12,
  },
  commentsList: {
    gap: 10,
  },
  commentCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  commentInitial: {
    fontSize: 16,
    color: '#83AFA7',
  },
  commentContent: {
    flex: 1,
  },
  commentTitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 1,
  },
  commentSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  ratingContainer: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  listingInfo: {
    marginTop: 8,
    paddingLeft: 48,
  },
  listingLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  commentTextContainer: {
    marginTop: 8,
    paddingLeft: 48,
  },
  commentText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  emptyTitle: {
    fontSize: 18,
    color: '#83AFA7',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default UserProfileScreen;
