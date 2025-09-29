import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import StandardModal from '../components/StandardModal';

const MySalesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const [salesData, setSalesData] = useState({
    totalSales: 0,
    totalRevenue: 0,
    activeListings: 0,
    soldItems: 0,
    expiredItems: 0,
    averagePrice: 0,
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Helper function to show error modal
  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  // Fetch sales data
  const fetchSalesData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get all listings for this seller
      const listingsRef = collection(db, 'listings');
      const q = query(listingsRef, where('sellerId', '==', user.uid));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const listings = [];
        snapshot.forEach((doc) => {
          listings.push({ id: doc.id, ...doc.data() });
        });

        // Calculate sales statistics
        const totalListings = listings.length;
        const soldListings = listings.filter(listing => listing.status === 'sold');
        const activeListings = listings.filter(listing => listing.status === 'active');
        const expiredListings = listings.filter(listing => listing.status === 'expired');

        // Calculate total revenue from sold items
        let totalRevenue = 0;
        soldListings.forEach(listing => {
          if (listing.finalPrice) {
            totalRevenue += listing.finalPrice;
          } else if (listing.priceType === 'msl' && listing.lockPrice) {
            totalRevenue += listing.lockPrice;
          } else if (listing.priceType === 'bidding' && listing.currentBid) {
            totalRevenue += listing.currentBid;
          }
        });

        const averagePrice = soldListings.length > 0 ? totalRevenue / soldListings.length : 0;

        setSalesData({
          totalSales: soldListings.length,
          totalRevenue: totalRevenue,
          activeListings: activeListings.length,
          soldItems: soldListings.length,
          expiredItems: expiredListings.length,
          averagePrice: averagePrice,
        });

        // Get recent sales (last 10 sold items)
        const recentSalesList = soldListings
          .sort((a, b) => {
            const aTime = a.soldAt?.toDate?.() || new Date(a.soldAt);
            const bTime = b.soldAt?.toDate?.() || new Date(b.soldAt);
            return bTime - aTime;
          })
          .slice(0, 10);

        setRecentSales(recentSalesList);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching sales data:', error);
      showError('Failed to load sales data. Please try again.');
      setLoading(false);
    }
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSalesData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) {
      fetchSalesData();
    }
  }, [user]);

  if (!fontsLoaded) {
    return null;
  }

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  const formatCurrency = (amount) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const salesStats = [
    {
      title: 'Total Sales',
      value: salesData.totalSales,
      icon: 'trending-up',
      color: '#4CAF50',
      bgColor: '#E8F5E8',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(salesData.totalRevenue),
      icon: 'cash',
      color: '#2196F3',
      bgColor: '#E3F2FD',
    },
    {
      title: 'Active Listings',
      value: salesData.activeListings,
      icon: 'eye',
      color: '#FF9800',
      bgColor: '#FFF3E0',
    },
    {
      title: 'Average Price',
      value: formatCurrency(salesData.averagePrice),
      icon: 'analytics',
      color: '#9C27B0',
      bgColor: '#F3E5F5',
    },
  ];

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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
          My Sales
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
            colors={['#83AFA7']}
            tintColor="#83AFA7"
          />
        }
      >
        {/* Sales Overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Sales Overview
          </Text>
          
          <View style={styles.statsGrid}>
            {salesStats.map((stat, index) => (
              <View key={index} style={[styles.statCard, { backgroundColor: stat.bgColor }]}>
                <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                  <Ionicons name={stat.icon} size={24} color={stat.color} />
                </View>
                <Text style={[styles.statValue, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined, color: stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  {stat.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Sales */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              Recent Sales
            </Text>
            <Text style={[styles.sectionSubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              {recentSales.length} items sold
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Loading sales data...
              </Text>
            </View>
          ) : recentSales.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color="#CCC" />
              <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                No Sales Yet
              </Text>
              <Text style={[styles.emptyDescription, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Your sold items will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.salesList}>
              {recentSales.map((sale, index) => (
                <View key={index} style={styles.saleItem}>
                  <Image 
                    source={{ 
                      uri: sale.images && sale.images[0] 
                        ? sale.images[0] 
                        : 'https://via.placeholder.com/80x80?text=No+Image' 
                    }} 
                    style={styles.saleImage} 
                  />
                  <View style={styles.saleInfo}>
                    <Text style={[styles.saleTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      {sale.title}
                    </Text>
                    <Text style={[styles.salePrice, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                      {formatCurrency(sale.finalPrice || sale.lockPrice || sale.currentBid || 0)}
                    </Text>
                    <Text style={[styles.saleDate, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      Sold on {formatDate(sale.soldAt)}
                    </Text>
                  </View>
                  <View style={styles.saleStatus}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Quick Actions
          </Text>
          
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('MyShop')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#83AFA7' + '20' }]}>
                <Ionicons name="storefront" size={24} color="#83AFA7" />
              </View>
              <Text style={[styles.actionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Manage Listings
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('PostListing')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' + '20' }]}>
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
              </View>
              <Text style={[styles.actionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Post New Item
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#333',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  salesList: {
    gap: 12,
  },
  saleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  saleImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  saleInfo: {
    flex: 1,
  },
  saleTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  salePrice: {
    fontSize: 18,
    color: '#4CAF50',
    marginBottom: 4,
  },
  saleDate: {
    fontSize: 12,
    color: '#666',
  },
  saleStatus: {
    marginLeft: 12,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
});

export default MySalesScreen;
