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
  Modal,
  Dimensions,
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState('');

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

  // Handle view details
  const handleViewDetails = (sale) => {
    setSelectedSale(sale);
    setShowDetailsModal(true);
  };

  // Handle zoom image
  const handleZoomImage = (imageUrl) => {
    setZoomImageUrl(imageUrl);
    setShowZoomModal(true);
  };

  // Fetch sales data
  const fetchSalesData = async () => {
    if (!user) {
      console.log('❌ MySalesScreen - No user found');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 MySalesScreen - Fetching data for seller:', user.uid);
      
      // Get all payments for this seller
      const paymentsRef = collection(db, 'payments');
      const paymentsQuery = query(paymentsRef, where('sellerId', '==', user.uid));
      
      // Get all listings for this seller
      const listingsRef = collection(db, 'listings');
      const listingsQuery = query(listingsRef, where('sellerId', '==', user.uid));
      
      // Listen to payments
      const paymentsUnsubscribe = onSnapshot(paymentsQuery, async (paymentsSnapshot) => {
        const payments = [];
        paymentsSnapshot.forEach((doc) => {
          payments.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('📊 MySalesScreen - Total payments found:', payments.length);
        
        // Listen to listings
        const listingsUnsubscribe = onSnapshot(listingsQuery, async (listingsSnapshot) => {
          const listings = [];
          listingsSnapshot.forEach((doc) => {
            listings.push({ id: doc.id, ...doc.data() });
          });
          
          console.log('📊 MySalesScreen - Total listings found:', listings.length);

          // Calculate sales statistics
          const totalPayments = payments.length;
          const approvedPayments = payments.filter(payment => payment.status === 'approved');
          const soldPayments = payments.filter(payment => payment.status === 'sold');
          const submittedPayments = payments.filter(payment => payment.status === 'submitted');
          
          // Calculate listing statistics
          const activeListings = listings.filter(listing => listing.status === 'active');
          const soldListings = listings.filter(listing => listing.status === 'sold');
          const expiredListings = listings.filter(listing => listing.status === 'expired');

          console.log('📈 MySalesScreen - Status breakdown:');
          console.log('  - Total payments:', totalPayments);
          console.log('  - Approved payments:', approvedPayments.length);
          console.log('  - Sold payments:', soldPayments.length);
          console.log('  - Submitted payments:', submittedPayments.length);
          console.log('  - Active listings:', activeListings.length);
          console.log('  - Sold listings:', soldListings.length);
          console.log('  - Expired listings:', expiredListings.length);

          // Calculate total revenue from sold items
          let totalRevenue = 0;
          soldPayments.forEach(payment => {
            totalRevenue += payment.amount || 0;
          });

          const averagePrice = soldPayments.length > 0 ? totalRevenue / soldPayments.length : 0;

          console.log('💰 MySalesScreen - Revenue calculation (SOLD):');
          console.log('  - Total revenue:', totalRevenue);
          console.log('  - Average price:', averagePrice);

          setSalesData({
            totalSales: soldPayments.length,
            totalRevenue: totalRevenue,
            activeListings: activeListings.length,
            soldItems: soldListings.length,
            expiredItems: expiredListings.length,
            averagePrice: averagePrice,
          });

          // Get recent sales (last 10 sold payments)
          const recentSalesList = soldPayments
            .sort((a, b) => {
              const aTime = a.soldAt?.toDate?.() || new Date(a.soldAt);
              const bTime = b.soldAt?.toDate?.() || new Date(b.soldAt);
              return bTime - aTime;
            })
            .slice(0, 10);

          console.log('📋 MySalesScreen - Recent sales list:', recentSalesList.length);
          setRecentSales(recentSalesList);
          setLoading(false);
        });
      });

      return () => {
        paymentsUnsubscribe();
        // Note: listingsUnsubscribe is handled inside the payments listener
      };
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
              <Ionicons name="receipt-outline" size={64} color="#83AFA7" />
              <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                No Sales Yet
              </Text>
              <Text style={[styles.emptyDescription, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Your sold items will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.salesList}>
              {recentSales.map((sale, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.saleCard,
                    styles.compactCard,
                    { borderLeftColor: '#4CAF50' }
                  ]}
                  onPress={() => handleViewDetails(sale)}
                  activeOpacity={0.7}
                >
                  {/* Compact Sale Info */}
                  <View style={styles.compactHeader}>
                    <View style={styles.compactLeft}>
                      {sale.listingImage && (
                        <Image 
                          source={{ uri: sale.listingImage }} 
                          style={styles.compactImage} 
                        />
                      )}
                      <View style={styles.compactInfo}>
                        <Text style={[styles.compactTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                          {sale.listingTitle || 'Unknown Item'}
                        </Text>
                 <Text style={[styles.compactId, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                   Sold on {formatDate(sale.soldAt)}
                 </Text>
                      </View>
                    </View>
                    <View style={styles.compactRight}>
                    <Text style={[styles.compactAmount, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                      {formatCurrency(sale.amount || 0)}
                    </Text>
                    </View>
                  </View>

                </TouchableOpacity>
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

      {/* Sale Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModal}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: '#E0E0E0' }]}>
              <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Sale Details
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowDetailsModal(false)}
              >
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {selectedSale && (
                <>
                  {/* Product Information */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      Product Information
                    </Text>
                    {selectedSale.listingImage && (
                      <Image source={{ uri: selectedSale.listingImage }} style={styles.detailProductImage} />
                    )}
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Item Name:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedSale.listingTitle || 'Unknown Item'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Buyer:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedSale.buyerName || 'Unknown Buyer'}
                      </Text>
                    </View>
                  </View>

                  {/* Sale Information */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      Sale Information
                    </Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Sale Price:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined, color: '#4CAF50' }]}>
                        {formatCurrency(selectedSale.amount || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Action Type:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedSale.actionType || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Payment Method:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedSale.paymentMethod || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Reference Number:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedSale.referenceNumber || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Sold Date:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {formatDate(selectedSale.soldAt)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Status:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined, color: '#4CAF50' }]}>
                        Sold
                      </Text>
                    </View>
                    {selectedSale.notes && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                          Notes:
                        </Text>
                        <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                          {selectedSale.notes}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Payment Proof */}
                  {selectedSale.paymentProofUrl && (
                    <View style={styles.detailSection}>
                      <Text style={[styles.detailSectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                        Payment Proof
                      </Text>
                      <TouchableOpacity 
                        style={styles.imageContainer}
                        onPress={() => handleZoomImage(selectedSale.paymentProofUrl)}
                      >
                        <Image 
                          source={{ uri: selectedSale.paymentProofUrl }} 
                          style={styles.detailProofImage}
                          resizeMode="contain"
                        />
                        <View style={styles.zoomOverlay}>
                          <Ionicons name="expand" size={24} color="white" />
                          <Text style={styles.zoomText}>Tap to zoom</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Zoom Modal */}
      <Modal
        visible={showZoomModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowZoomModal(false)}
      >
        <View style={styles.zoomModalOverlay}>
          <View style={styles.zoomModalContainer}>
            <TouchableOpacity 
              style={styles.zoomCloseButton}
              onPress={() => setShowZoomModal(false)}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <ScrollView 
              style={styles.zoomScrollView}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image 
                source={{ uri: zoomImageUrl }} 
                style={styles.zoomImage}
                resizeMode="contain"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#83AFA7',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
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
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  salesList: {
    gap: 8,
  },
  saleCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compactCard: {
    backgroundColor: '#F8F8F8',
    borderLeftWidth: 3,
    opacity: 0.9,
  },
  // Compact styles
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  compactId: {
    fontSize: 11,
    color: '#666',
  },
  compactRight: {
    alignItems: 'flex-end',
  },
  compactAmount: {
    fontSize: 16,
    color: '#4CAF50',
  },
  actionIcons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  detailsModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 500,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#83AFA7',
  },
  detailProductImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '400',
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  imageContainer: {
    width: '100%',
    marginTop: 6,
  },
  detailProofImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  // Zoom overlay styles
  zoomOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  zoomText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    fontFamily: 'Poppins-Medium',
  },
  // Zoom modal styles
  zoomModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomModalContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    position: 'relative',
  },
  zoomCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomScrollView: {
    flex: 1,
  },
  zoomImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

export default MySalesScreen;