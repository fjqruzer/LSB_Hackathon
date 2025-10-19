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
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import StandardModal from '../components/StandardModal';

const MyShopScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // State management
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [listingToDelete, setListingToDelete] = useState(null);
  const [countdownTimers, setCountdownTimers] = useState({});

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  // Fetch seller's listings from Firestore
  useEffect(() => {
    if (!user) return;

    const fetchMyListings = () => {
      try {
        // Query without orderBy to avoid composite index requirement
        const q = query(
          collection(db, 'listings'),
          where('sellerId', '==', user.uid)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const listingsData = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .sort((a, b) => {
              // Sort in JavaScript instead of Firestore
              const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
              const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
              return bTime - aTime; // Descending order (newest first)
            });
          
          setListings(listingsData);
          setLoading(false);
          setRefreshing(false);
        }, (error) => {
          console.error('Error fetching my listings:', error);
          setLoading(false);
          setRefreshing(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Error setting up listings listener:', error);
        setLoading(false);
        setRefreshing(false);
      }
    };
    
    const unsubscribe = fetchMyListings();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Update countdown timers for listings
  useEffect(() => {
    if (listings.length === 0) return;

    const updateTimers = () => {
      const now = new Date();
      const newTimers = {};

      listings.forEach(listing => {
        if (listing.status === 'active' && listing.expirationTime) {
          const expirationTime = listing.expirationTime.toDate ? 
            listing.expirationTime.toDate() : 
            new Date(listing.expirationTime);
          
          const timeLeft = Math.max(0, Math.floor((expirationTime - now) / 1000));
          newTimers[listing.id] = timeLeft;
        }
      });

      setCountdownTimers(newTimers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [listings]);

  // Filter listings based on active tab
  const getFilteredListings = () => {
    switch (activeTab) {
      case 'active':
        return listings.filter(listing => listing.status === 'active');
      case 'expired':
        return listings.filter(listing => listing.status === 'expired');
      case 'sold':
        return listings.filter(listing => listing.status === 'sold');
      default:
        return listings;
    }
  };

  // Handle listing deletion
  const handleDeleteListing = (listing) => {
    setListingToDelete(listing);
    setShowDeleteModal(true);
  };

  const confirmDeleteListing = async () => {
    if (!listingToDelete) return;

    try {
      await deleteDoc(doc(db, 'listings', listingToDelete.id));
      setShowDeleteModal(false);
      setListingToDelete(null);
      Alert.alert('Success', 'Listing deleted successfully!');
    } catch (error) {
      console.error('Error deleting listing:', error);
      Alert.alert('Error', 'Failed to delete listing. Please try again.');
    }
  };

  // Handle listing status update
  const handleUpdateListingStatus = async (listingId, newStatus) => {
    try {
      await updateDoc(doc(db, 'listings', listingId), {
        status: newStatus,
        lastUpdated: new Date()
      });
      Alert.alert('Success', `Listing ${newStatus} successfully!`);
    } catch (error) {
      console.error('Error updating listing status:', error);
      Alert.alert('Error', 'Failed to update listing. Please try again.');
    }
  };

  // Check if user has payment methods before allowing to post listing
  const checkPaymentMethodsAndNavigate = async () => {
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const paymentMethods = userData.paymentMethods || [];
        if (paymentMethods.length === 0) {
          Alert.alert(
            'Payment Method Required',
            'You need to add at least one payment method to post listings. Go to Profile > My Payment Methods to add one.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Add Payment Method', 
                onPress: () => navigation.navigate('PaymentMethods')
              }
            ]
          );
          return;
        }
      }
      // If payment methods exist, navigate to PostListing
      navigation.navigate('PostListing');
    } catch (error) {
      console.error('Error checking payment methods:', error);
      Alert.alert('Error', 'Unable to verify payment methods. Please try again.');
    }
  };

  // Format countdown timer
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'expired': return '#FF9800';
      case 'sold': return '#2196F3';
      default: return '#666';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return 'checkmark-circle';
      case 'expired': return 'time-outline';
      case 'sold': return 'checkmark-done-circle';
      default: return 'help-circle';
    }
  };

  // Get display price based on price type
  const getDisplayPrice = (listing) => {
    if (listing?.priceType === 'msl') {
      return `₱${listing.minePrice}`;
    } else if (listing?.priceType === 'bidding') {
      return `₱${listing.currentBid || listing.startingPrice}`;
    } else {
      return `₱${listing.price || 0}`;
    }
  };

  // Render listing card
  const renderListingCard = (listing) => {
    const timeLeft = countdownTimers[listing.id] || 0;
    const isExpiring = timeLeft < 3600 && timeLeft > 0; // Less than 1 hour

    return (
      <TouchableOpacity
        key={listing.id}
        style={styles.listingCard}
        onPress={() => navigation.navigate('ListingDetails', { 
          listing: { ...listing, fromShop: true } 
        })}
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
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(listing.status) + '20' }]}>
              <Ionicons 
                name={getStatusIcon(listing.status)} 
                size={12} 
                color={getStatusColor(listing.status)} 
              />
              <Text style={[styles.statusText, { color: getStatusColor(listing.status) }]}>
                {listing.status.toUpperCase()}
              </Text>
            </View>
            
            {listing.status === 'active' && timeLeft > 0 && (
              <View style={[styles.timerBadge, isExpiring && styles.timerBadgeDanger]}>
                <Ionicons name="time" size={12} color={isExpiring ? '#FF5252' : '#666'} />
                <Text style={[styles.timerText, isExpiring && styles.timerTextDanger]}>
                  {formatTime(timeLeft)}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.listingActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('ListingDetails', { 
                listing: { ...listing, fromShop: true } 
              })}
            >
              <Ionicons name="eye-outline" size={16} color="#83AFA7" />
              <Text style={styles.actionText}>View</Text>
            </TouchableOpacity>
            
            {listing.status === 'active' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => navigation.navigate('PostListing', { editListingId: listing.id })}
              >
                <Ionicons name="create-outline" size={16} color="#FF9800" />
                <Text style={[styles.actionText, { color: '#FF9800' }]}>Edit</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteListing(listing)}
            >
              <Ionicons name="trash-outline" size={16} color="#B71C1C" />
              <Text style={[styles.actionText, { color: '#B71C1C' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  const filteredListings = getFilteredListings();

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: colors.primary }]}>
      <StatusBar 
        style="dark" 
        backgroundColor={colors.primary}
        translucent={Platform.OS === "android"}
        barStyle="dark-content"
        animated={true}
        hidden={false}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
          My Shop
        </Text>
        <TouchableOpacity onPress={checkPaymentMethodsAndNavigate}>
          <Ionicons name="add" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
            {listings.filter(l => l.status === 'active').length}
          </Text>
          <Text style={[styles.statLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            Active
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
            {listings.filter(l => l.status === 'sold').length}
          </Text>
          <Text style={[styles.statLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            Sold
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
            {listings.filter(l => l.status === 'expired').length}
          </Text>
          <Text style={[styles.statLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            Expired
          </Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          {[
            { key: 'all', label: 'All', count: listings.length },
            { key: 'active', label: 'Active', count: listings.filter(l => l.status === 'active').length },
            { key: 'expired', label: 'Expired', count: listings.filter(l => l.status === 'expired').length },
            { key: 'sold', label: 'Sold', count: listings.filter(l => l.status === 'sold').length }
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
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Listings */}
      <ScrollView
        style={styles.listingsContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(true)}
            colors={['#83AFA7']}
            tintColor="#83AFA7"
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#83AFA7" />
            <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              Loading your listings...
            </Text>
          </View>
        ) : filteredListings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={64} color="#83AFA7" />
            <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              No listings found
            </Text>
            <Text style={[styles.emptySubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              {activeTab === 'all' 
                ? "You haven't created any listings yet" 
                : `No ${activeTab} listings found`
              }
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={checkPaymentMethodsAndNavigate}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={[styles.createButtonText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Create Your First Listing
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredListings.map(renderListingCard)
        )}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <StandardModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Listing"
        message={`Are you sure you want to delete "${listingToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteListing}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Platform.OS === 'android' ? 16 : 20,
    marginBottom: Platform.OS === 'android' ? 16 : 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Platform.OS === 'android' ? 12 : 16,
    marginHorizontal: Platform.OS === 'android' ? 2 : 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: Platform.OS === 'android' ? 20 : 24,
    color: '#83AFA7',
    marginBottom: Platform.OS === 'android' ? 2 : 4,
  },
  statLabel: {
    fontSize: Platform.OS === 'android' ? 10 : 12,
    color: '#666',
  },
  tabContainer: {
    backgroundColor: '#DFECE2',
    paddingBottom: 16,
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
  listingsContainer: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'android' ? 16 : 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
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
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#83AFA7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
  },
  listingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: Platform.OS === 'android' ? 12 : 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  listingImage: {
    width: '100%',
    height: Platform.OS === 'android' ? 150 : 200,
    resizeMode: 'cover',
  },
  listingContent: {
    padding: Platform.OS === 'android' ? 12 : 16,
  },
  listingTitle: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#333',
    marginBottom: Platform.OS === 'android' ? 6 : 8,
  },
  listingPrice: {
    fontSize: Platform.OS === 'android' ? 16 : 18,
    color: '#83AFA7',
    marginBottom: Platform.OS === 'android' ? 8 : 12,
  },
  listingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 12 : 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
  },
  timerBadgeDanger: {
    backgroundColor: '#FFEBEE',
  },
  timerText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  timerTextDanger: {
    color: '#FF5252',
  },
  listingActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Platform.OS === 'android' ? 8 : 12,
    paddingVertical: Platform.OS === 'android' ? 6 : 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  editButton: {
    backgroundColor: '#FFF3E0',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  actionText: {
    fontSize: Platform.OS === 'android' ? 10 : 12,
    color: '#83AFA7',
    marginLeft: Platform.OS === 'android' ? 3 : 4,
  },
});

export default MyShopScreen;