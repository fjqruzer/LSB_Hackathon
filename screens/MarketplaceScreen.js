import React, { useState, useEffect } from 'react'
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Image,
    TouchableOpacity,
    StatusBar,
    Platform,
    ActivityIndicator,
    RefreshControl,
    Animated,
  } from "react-native"
  import { Ionicons } from "@expo/vector-icons"
  import Constants from "expo-constants"
  import { useSafeAreaInsets } from "react-native-safe-area-context"
  import { useFonts } from 'expo-font'
import { useTheme } from '../contexts/ThemeContext'
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc, arrayUnion, arrayRemove, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'
import RealTimeActionListener from '../services/RealTimeActionListener'
import ActionAlertService from '../services/ActionAlertService'
import ChatService from '../services/ChatService'
  
  const Marketplace = ({ onListingPress, onNavigateToFavorites, navigation }) => {
    const insets = useSafeAreaInsets()
    const { user } = useAuth()
    const { isDarkMode, colors } = useTheme()
    
    // Load Poppins fonts
    const [fontsLoaded] = useFonts({
      'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
      'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
      'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
      'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    })
    
    // State management
    const [listings, setListings] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [activeTab, setActiveTab] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [countdownTimers, setCountdownTimers] = useState({}) // Store countdown for each listing
    const [pulseAnimations, setPulseAnimations] = useState({}) // Store pulse animations for each listing
    const [favorites, setFavorites] = useState([]) // Store user's favorite listing IDs
    const [following, setFollowing] = useState([]) // Store user's following list
    const [unreadCount, setUnreadCount] = useState(0) // Store unread message count
    
    // Use safe area insets for proper padding on all devices, with fallbacks
    const topPadding = insets.top || (Platform.OS === "ios" ? Constants.statusBarHeight : 0)

    // Fetch user's favorites
    const fetchFavorites = async () => {
      if (!user) return;
      
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFavorites(userData.favorites || []);
        }
      } catch (error) {
        console.error('Error fetching favorites:', error);
      }
    };

    // Fetch user's following list
    const fetchFollowing = async () => {
      if (!user) return;
      
      try {
        const followingQuery = query(
          collection(db, 'following'),
          where('followerId', '==', user.uid)
        );
        const snapshot = await getDocs(followingQuery);
        
        const followingList = [];
        snapshot.forEach((doc) => {
          followingList.push(doc.data().followingId);
        });
        
        setFollowing(followingList);
        console.log('📋 Fetched following list:', followingList);
      } catch (error) {
        console.error('Error fetching following list:', error);
      }
    };

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
        console.log('💬 Unread message count:', totalUnread);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    // Toggle favorite status
    const toggleFavorite = async (listingId) => {
      if (!user) return;
      
      try {
        const userRef = doc(db, 'users', user.uid);
        const isFavorited = favorites.includes(listingId);
        
        if (isFavorited) {
          // Remove from favorites
          await updateDoc(userRef, {
            favorites: arrayRemove(listingId)
          });
          setFavorites(prev => prev.filter(id => id !== listingId));
        } else {
          // Add to favorites
          await updateDoc(userRef, {
            favorites: arrayUnion(listingId)
          });
          setFavorites(prev => [...prev, listingId]);
        }
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    };

    // Check if listing is favorited
    const isFavorited = (listingId) => {
      return favorites.includes(listingId);
    };

    // Fetch listings from Firestore
    useEffect(() => {
      const fetchListings = () => {
        try {
          // Fetch user's favorites, following, and unread count first
          fetchFavorites();
          fetchFollowing();
          fetchUnreadCount();
          
          // Set up real-time listener for unread count
          let unsubscribeChats = null;
          if (user) {
            const chatsQuery = query(
              collection(db, 'chats'),
              where('participants', 'array-contains', user.uid)
            );
            
            unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
              let totalUnread = 0;
              snapshot.docs.forEach(chatDoc => {
                const chatData = chatDoc.data();
                const unreadCount = chatData.unreadCount?.[user.uid] || 0;
                totalUnread += unreadCount;
              });
              setUnreadCount(totalUnread);
            });
          }
          
          // Simple query without composite index - just get all listings
          const q = query(collection(db, 'listings'))
          
          const unsubscribe = onSnapshot(q, (snapshot) => {
            const listingsData = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              .filter(listing => listing.status === 'active') // Filter in JavaScript instead
              .sort((a, b) => {
                // Sort by createdAt in JavaScript instead
                const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt)
                const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt)
                return bTime - aTime // Descending order (newest first)
              })
            
            setListings(listingsData)
            setLoading(false)
            setRefreshing(false)
          }, (error) => {
            console.error('Error fetching listings:', error)
            setLoading(false)
            setRefreshing(false)
          })
          
          // Return a cleanup function that unsubscribes from both listeners
          return () => {
            if (unsubscribe) unsubscribe();
            if (unsubscribeChats) unsubscribeChats();
          }
        } catch (error) {
          console.error('Error setting up listings listener:', error)
          setLoading(false)
          setRefreshing(false)
        }
      }
      
      const cleanup = fetchListings()
      return () => {
        if (cleanup) {
          cleanup()
        }
      }
    }, [])

    // Initialize action alert services
    useEffect(() => {
      const initializeServices = async () => {
        await ActionAlertService.initialize()
        RealTimeActionListener.setCurrentUser(user?.uid)
      }

      initializeServices()
    }, [user?.uid])

    // Update countdown timers for all listings
    useEffect(() => {
      if (listings.length === 0) return;

      const updateAllTimers = () => {
        const now = new Date();
        const newTimers = {};

        listings.forEach((listing) => {
          if (!listing.endDateTime) {
            newTimers[listing.id] = { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
            return;
          }

          let endTime;

          // Handle different date formats from Firebase
          if (listing.endDateTime.toDate && typeof listing.endDateTime.toDate === 'function') {
            // Firestore Timestamp
            endTime = listing.endDateTime.toDate();
          } else if (listing.endDateTime instanceof Date) {
            // Already a Date object
            endTime = listing.endDateTime;
          } else if (typeof listing.endDateTime === 'string') {
            // String date
            endTime = new Date(listing.endDateTime);
          } else if (listing.endDateTime.seconds) {
            // Firestore Timestamp object
            endTime = new Date(listing.endDateTime.seconds * 1000);
          } else {
            // Fallback: try to create date from the object
            endTime = new Date(listing.endDateTime);
          }

          // Check if the date is valid
          if (isNaN(endTime.getTime())) {
            newTimers[listing.id] = { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
            return;
          }

          const timeDiff = endTime - now;

          if (timeDiff <= 0) {
            // Listing has expired
            newTimers[listing.id] = { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
          } else {
            // Calculate time remaining
            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

            newTimers[listing.id] = { days, hours, minutes, seconds, isExpired: false };
          }
        });

        setCountdownTimers(newTimers);
      };

      // Update immediately
      updateAllTimers();

      // Update every second
      const interval = setInterval(updateAllTimers, 1000);

      return () => clearInterval(interval);
    }, [listings]);

    // Initialize pulse animations for listings
    useEffect(() => {
      const newPulseAnimations = {};
      listings.forEach((listing) => {
        if (!pulseAnimations[listing.id]) {
          newPulseAnimations[listing.id] = new Animated.Value(1);
        }
      });
      setPulseAnimations(prev => ({ ...prev, ...newPulseAnimations }));
    }, [listings]);

    // Manage pulse animations based on urgency
    useEffect(() => {
      Object.keys(pulseAnimations).forEach((listingId) => {
        const urgency = getTimerUrgency(listingId);
        const pulseAnim = pulseAnimations[listingId];
        
        if (!pulseAnim) return;

        const startPulsing = () => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.1,
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
              }),
            ])
          ).start();
        };

        const stopPulsing = () => {
          pulseAnim.stopAnimation();
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        };

        if (urgency === 'critical') {
          startPulsing();
        } else {
          stopPulsing();
        }
      });
    }, [countdownTimers, pulseAnimations]);

    // Filter listings based on active tab and search
    const filteredListings = React.useMemo(() => {
      return listings.filter(listing => {
      // Exclude listings where current user is the seller
      if (user && listing.sellerId && user.uid === listing.sellerId) {
        return false
      }
      
      // Exclude locked/closed listings
      if (listing.status === 'locked') {
        return false
      }
      
      // Exclude expired listings
      const timer = countdownTimers[listing.id]
      if (timer && timer.isExpired) {
        return false
      }
      
      // Also check expiration directly as fallback
      if (listing.endDateTime) {
        const now = new Date()
        let endTime
        
        // Handle different date formats from Firebase
        if (listing.endDateTime.toDate && typeof listing.endDateTime.toDate === 'function') {
          endTime = listing.endDateTime.toDate()
        } else if (listing.endDateTime instanceof Date) {
          endTime = listing.endDateTime
        } else if (typeof listing.endDateTime === 'string') {
          endTime = new Date(listing.endDateTime)
        } else if (listing.endDateTime.seconds) {
          endTime = new Date(listing.endDateTime.seconds * 1000)
        } else {
          endTime = new Date(listing.endDateTime)
        }
        
        if (!isNaN(endTime.getTime()) && endTime <= now) {
          return false
        }
      }
      
      let matchesTab = false
      
      switch (activeTab) {
        case 'all':
          matchesTab = true
          break
        case 'msl':
          matchesTab = listing?.priceType === 'msl'
          break
        case 'bidding':
          matchesTab = listing?.priceType === 'bidding'
          break
        case 'following':
          // Filter listings from users that the current user follows
          matchesTab = following.includes(listing?.sellerId) || following.includes(listing?.userId)
          break
        default:
          matchesTab = true
      }
      
      const matchesSearch = !searchQuery || 
                           listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           listing.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           listing.brand.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesTab && matchesSearch
      })
    }, [listings, user, countdownTimers, activeTab, searchQuery, following])

    // Helper functions
    const isOwnListing = (listing) => {
      return listing && listing.sellerId && user && user.uid === listing.sellerId;
    };

    const getTimerUrgency = (listingId) => {
      const timer = countdownTimers[listingId];
      
      if (!timer || timer.isExpired) return 'expired';
      
      const { days, hours, minutes } = timer;
      const totalMinutes = (days * 24 * 60) + (hours * 60) + minutes;
      
      if (totalMinutes <= 5) return 'critical'; // Last 5 minutes
      if (totalMinutes <= 30) return 'warning'; // Last 30 minutes
      if (totalMinutes <= 60) return 'caution'; // Last hour
      return 'safe'; // More than 1 hour
    };

    const formatTimeLeft = (listingId) => {
      const timer = countdownTimers[listingId];
      
      if (!timer) {
        return 'Loading...';
      }
      
      if (timer.isExpired) {
        return 'EXPIRED';
      }
      
      // Check for NaN values
      if (isNaN(timer.days) || isNaN(timer.hours) || isNaN(timer.minutes) || isNaN(timer.seconds)) {
        return 'Invalid Date';
      }
      
      const { days, hours, minutes, seconds } = timer;
      
      if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    }

    const getDisplayPrice = (listing) => {
      if (listing?.priceType === 'msl') {
        return `PHP ${listing.minePrice}`
      } else {
        return `PHP ${listing.currentBid || listing.startingPrice}`
      }
    }

    const getStatusText = (listing) => {
      return listing?.priceType === 'msl' ? 'M-S-L' : 'Bidding'
    }

    const onRefresh = async () => {
      setRefreshing(true)
      try {
        // Refresh favorites, following, and unread count
        await Promise.all([fetchFavorites(), fetchFollowing(), fetchUnreadCount()])
      } catch (error) {
        console.error('Error refreshing data:', error)
      } finally {
        setRefreshing(false)
      }
    }

    const handleChatPress = () => {
      if (navigation) {
        // Reset unread count when opening messages
        setUnreadCount(0);
        navigation.navigate('messages')
      }
    }

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
              placeholder="Search Item" 
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

        {/* Navigation Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabScrollContainer}
          contentContainerStyle={styles.tabContainer}
        >
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>Top picks</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'bidding' && styles.activeTab]}
            onPress={() => setActiveTab('bidding')}
          >
            <Text style={[styles.tabText, activeTab === 'bidding' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Bidding</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'msl' && styles.activeTab]}
            onPress={() => setActiveTab('msl')}
          >
            <Text style={[styles.tabText, activeTab === 'msl' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>MSL</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'following' && styles.activeTab]}
            onPress={() => setActiveTab('following')}
          >
            <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Following</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Product Grid */}
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
              <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Loading listings...
              </Text>
            </View>
          ) : filteredListings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={64} color="#83AFA7" />
              <Text style={[styles.emptyText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                {searchQuery ? 'No listings found for your search' : 
                 activeTab === 'following' ? 'No listings from people you follow' :
                 'No listings available'}
              </Text>
              <Text style={[styles.emptySubtext, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                {searchQuery ? 'Try adjusting your search terms' : 
                 activeTab === 'following' ? 'Follow some users to see their listings here!' :
                 'Be the first to post a listing!'}
              </Text>
            </View>
          ) : (
          <View style={styles.productGrid}>
              {filteredListings.map((listing) => (
                <TouchableOpacity 
                  key={listing.id} 
                  style={styles.productCard}
                  onPress={() => onListingPress && onListingPress(listing)}
                >
                <View style={styles.productImageContainer}>
                    <Image 
                      source={{ uri: listing.images && listing.images[0] ? listing.images[0] : 'https://via.placeholder.com/200x200?text=No+Image' }} 
                      style={styles.productImage} 
                    />
                  <TouchableOpacity 
                    style={styles.favoriteButton}
                    onPress={() => toggleFavorite(listing.id)}
                  >
                    <Ionicons 
                      name={isFavorited(listing.id) ? "heart" : "heart-outline"} 
                      size={20} 
                      color={isFavorited(listing.id) ? "#FF6B6B" : "#83AFA7"} 
                    />
                  </TouchableOpacity>
                  {isOwnListing(listing) && (
                    <View style={styles.ownListingBadge}>
                      <Text style={[styles.ownListingText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                        OWN
                      </Text>
                  </View>
                  )}
                  <Animated.View style={[
                    styles.timeLeftBadge,
                    getTimerUrgency(listing.id) === 'critical' && styles.timerBadgeCritical,
                    getTimerUrgency(listing.id) === 'warning' && styles.timerBadgeWarning,
                    getTimerUrgency(listing.id) === 'caution' && styles.timerBadgeCaution,
                    getTimerUrgency(listing.id) === 'expired' && styles.timerBadgeExpired,
                    getTimerUrgency(listing.id) === 'critical' && pulseAnimations[listing.id] && {
                      transform: [{ scale: pulseAnimations[listing.id] }]
                    }
                  ]}>
                      <Text style={[
                        styles.timeLeftText, 
                        { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined },
                        getTimerUrgency(listing.id) === 'critical' && styles.timerTextCritical,
                        getTimerUrgency(listing.id) === 'warning' && styles.timerTextWarning,
                        getTimerUrgency(listing.id) === 'caution' && styles.timerTextCaution,
                        getTimerUrgency(listing.id) === 'expired' && styles.timerTextExpired
                      ]}>
                        {formatTimeLeft(listing.id)}
                      </Text>
                  </Animated.View>
                </View>

                <View style={styles.productInfo}>
                    <Text style={[styles.productTitle, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      {listing.title}
                    </Text>
                  <View style={styles.priceRow}>
                      <Text style={[styles.price, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                        {getDisplayPrice(listing)}
                      </Text>
                      <Text style={[styles.status, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        • {getStatusText(listing)}
                      </Text>
                  </View>

                  <View style={styles.userRow}>
                      <View style={styles.userAvatarPlaceholder}>
                        <Text style={[styles.userAvatarText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                          {listing.sellerName ? listing.sellerName.charAt(0).toUpperCase() : 'A'}
                        </Text>
                      </View>
                      <View style={styles.userNameContainer}>
                        <Text style={[styles.userName, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                          {listing.sellerName || 'Anonymous'}
                        </Text>
                        {isOwnListing(listing) && (
                          <View style={styles.ownListingIndicator}>
                            <Text style={[styles.ownListingIndicatorText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                              You
                            </Text>
                          </View>
                        )}
                      </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          )}
        </ScrollView>
      </View>
    )
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      ...(Platform.OS === "android" && {
        // Ensure proper handling on Android when app goes to background and returns
        elevation: 0,
      }),
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: "#DFECE2",
      ...(Platform.OS === "android" && {
        elevation: 2,
        shadowColor: "#000",
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
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "white",
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
      color: "#333",
      fontFamily: "Poppins-Regular",
      paddingHorizontal: 0,
      paddingVertical: 0,
      margin: 0,
      textAlignVertical: "center",
      ...(Platform.OS === 'ios' && {
        height: 36,
        paddingTop: 2,
        paddingBottom: 2,
      }),
    },
    headerIcons: {
      flexDirection: "row",
    },
    iconButton: {
      marginLeft: 8,
    },
    tabScrollContainer: {
      backgroundColor: "#DFECE2",
      maxHeight: 50,
      marginTop: -10,
    },
    tabContainer: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 8,
      paddingBottom: 5,
      alignItems: "center",
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 16,
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: "#F68652",
    },
    tabText: {
      fontSize: 14,
      color: "#83AFA7",
      fontFamily: "Poppins-Medium",
    },
    activeTabText: {
      color: "#F68652",
      fontFamily: "Poppins-SemiBold",
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    productGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    productCard: {
      width: "48%",
      backgroundColor: "white",
      borderRadius: 12,
      marginBottom: 16,
      overflow: "hidden",
    },
    productImageContainer: {
      position: "relative",
    },
    productImage: {
      width: "100%",
      height: 120,
      resizeMode: "cover",
    },
    favoriteButton: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      borderRadius: 20,
      padding: 6,
    },
    timeLeftBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: "#F68652",
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    timeLeftText: {
      color: "white",
      fontSize: 10,
      fontFamily: "Poppins-SemiBold",
    },
    // Timer urgency styles
    timerBadgeCritical: {
      backgroundColor: "#E53E3E",
      shadowColor: "#E53E3E",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 5,
    },
    timerBadgeWarning: {
      backgroundColor: "#F59E0B",
      shadowColor: "#F59E0B",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 5,
    },
    timerBadgeCaution: {
      backgroundColor: "#F97316",
      shadowColor: "#F97316",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    timerBadgeExpired: {
      backgroundColor: "#6B7280",
    },
    timerTextCritical: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 11,
    },
    timerTextWarning: {
      color: "#FFFFFF",
      fontWeight: "600",
      fontSize: 11,
    },
    timerTextCaution: {
      color: "#FFFFFF",
      fontWeight: "600",
      fontSize: 10,
    },
    timerTextExpired: {
      color: "#FFFFFF",
      fontWeight: "600",
      fontSize: 10,
    },
    ownListingBadge: {
      position: "absolute",
      bottom: 8,
      right: 8,
      backgroundColor: "#83AFA7",
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      zIndex: 2,
    },
    ownListingText: {
      color: "#FFFFFF",
      fontSize: 8,
      fontWeight: "600",
    },
    userNameContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    ownListingIndicator: {
      backgroundColor: "#83AFA7",
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 1,
      marginLeft: 4,
    },
    ownListingIndicatorText: {
      color: "#FFFFFF",
      fontSize: 8,
      fontWeight: "500",
    },
    productInfo: {
      padding: 12,
    },
    productTitle: {
      fontSize: 12,
      color: "#333",
      marginBottom: 6,
      lineHeight: 16,
      fontFamily: "Poppins-Medium",
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    price: {
      fontSize: 14,
      fontFamily: "Poppins-SemiBold",
      color: "#F68652",
    },
    status: {
      fontSize: 12,
      color: "#83AFA7",
      marginLeft: 4,
      fontFamily: "Poppins-Regular",
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    userAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 6,
    },
    userName: {
      flex: 1,
      fontSize: 12,
      color: "#666",
      fontFamily: "Poppins-Regular",
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
    userAvatarPlaceholder: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#83AFA7',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    userAvatarText: {
      fontSize: 10,
      color: 'white',
    },
    badge: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: '#FF4444',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
      fontFamily: 'Poppins-SemiBold',
    },
  })
  
  export default Marketplace
  