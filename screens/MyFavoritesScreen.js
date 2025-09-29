import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import StandardModal from '../components/StandardModal';

const MyFavoritesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const [favoriteListings, setFavoriteListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [listingToRemove, setListingToRemove] = useState(null);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const fetchFavoriteListings = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get user's favorite listing IDs
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setFavoriteListings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const userData = userDoc.data();
      const favoriteIds = userData.favorites || [];

      if (favoriteIds.length === 0) {
        setFavoriteListings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch listings that are in favorites
      const listingsRef = collection(db, 'listings');
      const q = query(listingsRef, where('__name__', 'in', favoriteIds));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const listings = [];
        snapshot.forEach((doc) => {
          const listingData = { id: doc.id, ...doc.data() };
          listings.push(listingData);
        });

        // Sort by creation date (newest first)
        listings.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return bTime - aTime;
        });

        setFavoriteListings(listings);
        setLoading(false);
        setRefreshing(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching favorite listings:', error);
      showError('Failed to load favorites. Please try again.');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFavoriteListings();
  }, [user]);

  const showRemoveConfirmation = (listing) => {
    setListingToRemove(listing);
    setShowRemoveModal(true);
  };

  const confirmRemoveFromFavorites = async () => {
    if (!user || !listingToRemove) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        favorites: arrayRemove(listingToRemove.id)
      });
      
      // Update local state
      setFavoriteListings(prev => prev.filter(listing => listing.id !== listingToRemove.id));
      setShowRemoveModal(false);
      setListingToRemove(null);
    } catch (error) {
      console.error('Error removing from favorites:', error);
      showError('Failed to remove from favorites. Please try again.');
    }
  };

  const cancelRemove = () => {
    setShowRemoveModal(false);
    setListingToRemove(null);
  };

  const formatTimeRemaining = (expiresAt) => {
    if (!expiresAt) return 'Expired';
    
    const now = new Date();
    const expiry = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getDisplayPrice = (listing) => {
    if (listing.priceType === 'msl') {
      return `₱${listing.lockPrice?.toLocaleString() || '0'}`;
    } else if (listing.priceType === 'bidding') {
      return `₱${listing.currentBid?.toLocaleString() || listing.startingPrice?.toLocaleString() || '0'}`;
    }
    return '₱0';
  };

  const getStatusText = (listing) => {
    if (listing.status === 'sold') return 'Sold';
    if (listing.status === 'expired') return 'Expired';
    return listing.priceType === 'msl' ? 'M-S-L' : 'Bidding';
  };

  const getStatusColor = (listing) => {
    if (listing.status === 'sold') return '#4CAF50';
    if (listing.status === 'expired') return '#F44336';
    return '#83AFA7';
  };

  useEffect(() => {
    if (user) {
      fetchFavoriteListings();
    }
  }, [user]);

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  if (!fontsLoaded) {
    return null;
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
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
          My Favorites
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#83AFA7"
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#83AFA7" />
            <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              Loading favorites...
            </Text>
          </View>
        ) : favoriteListings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={60} color="#CCC" />
            <Text style={[styles.emptyText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              No Favorites Yet
            </Text>
            <Text style={[styles.emptyDescription, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              Items you heart will appear here
            </Text>
            <TouchableOpacity 
              style={styles.browseButton} 
              onPress={() => navigation.navigate('marketplace')}
            >
              <Text style={[styles.browseButtonText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Browse Marketplace
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Favorites Count */}
            <View style={styles.countSection}>
              <Text style={[styles.countText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                {favoriteListings.length} {favoriteListings.length === 1 ? 'item' : 'items'} saved
              </Text>
            </View>

            {/* Favorites List */}
            <View style={styles.listingsContainer}>
              {favoriteListings.map((listing, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.listingCard}
                  onPress={() => navigation.navigate('ListingDetails', { listing: listing })}
                >
                  <Image
                    source={{ 
                      uri: listing.images && listing.images[0] 
                        ? listing.images[0] 
                        : 'https://via.placeholder.com/200x200?text=No+Image' 
                    }}
                    style={styles.listingImage}
                  />
                  
                  <View style={styles.listingContent}>
                    <Text style={[styles.listingTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      {listing.title}
                    </Text>
                    <Text style={[styles.listingPrice, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                      {getDisplayPrice(listing)}
                    </Text>
                    <View style={styles.listingMeta}>
                      <Text style={[styles.listingStatus, { 
                        fontFamily: fontsLoaded ? "Poppins-Medium" : undefined,
                        color: getStatusColor(listing)
                      }]}>
                        {getStatusText(listing)}
                      </Text>
                      {listing.expiresAt && listing.status === 'active' && (
                        <Text style={[styles.listingTime, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                          {formatTimeRemaining(listing.expiresAt)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => showRemoveConfirmation(listing)}
                  >
                    <Ionicons name="heart" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Error Modal */}
      <StandardModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message={errorMessage}
        confirmText="OK"
        onConfirm={() => setShowErrorModal(false)}
        showCancel={false}
        confirmButtonStyle="primary"
      />

      {/* Remove Confirmation Modal */}
      <StandardModal
        visible={showRemoveModal}
        onClose={cancelRemove}
        title="Remove from Favorites"
        message={`Are you sure you want to remove "${listingToRemove?.title}" from your favorites?`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={confirmRemoveFromFavorites}
        showCancel={true}
        confirmButtonStyle="danger"
      />
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
    paddingVertical: Platform.OS === 'android' ? 12 : 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Platform.OS === 'android' ? 16 : 18,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: '#83AFA7',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
  },
  countSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  countText: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#666',
  },
  listingsContainer: {
    marginBottom: 24,
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  listingImage: {
    width: Platform.OS === 'android' ? 80 : 100,
    height: Platform.OS === 'android' ? 80 : 100,
    borderRadius: 12,
    margin: 12,
    resizeMode: 'cover',
  },
  listingContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  listingTitle: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#333',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: Platform.OS === 'android' ? 16 : 18,
    color: '#83AFA7',
    marginBottom: 4,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listingStatus: {
    fontSize: Platform.OS === 'android' ? 11 : 12,
  },
  listingTime: {
    fontSize: Platform.OS === 'android' ? 10 : 11,
    color: '#666',
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
});

export default MyFavoritesScreen;
