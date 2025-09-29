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
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import StandardModal from '../components/StandardModal';

const MyPaymentsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, pending, submitted, approved, rejected

  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Fetch user's payments
  const fetchPayments = async () => {
    try {
      console.log('💳 Fetching payments for user:', user.uid);
      
      // First, get all payments for the user (without orderBy to avoid index requirement)
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('buyerId', '==', user.uid)
      );
      
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsList = [];
      
      for (const paymentDoc of paymentsSnapshot.docs) {
        const paymentData = { id: paymentDoc.id, ...paymentDoc.data() };
        
        // Get listing details
        try {
          const listingDoc = await getDoc(doc(db, 'listings', paymentData.listingId));
          if (listingDoc.exists()) {
            paymentData.listing = { id: listingDoc.id, ...listingDoc.data() };
          }
        } catch (error) {
          console.error('Error fetching listing details:', error);
        }
        
        paymentsList.push(paymentData);
      }
      
      // Sort payments by createdAt in JavaScript (newest first)
      paymentsList.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA; // Newest first
      });
      
      console.log('💳 Found payments:', paymentsList.length);
      setPayments(paymentsList);
    } catch (error) {
      console.error('❌ Error fetching payments:', error);
      setErrorMessage('Failed to load payments. Please try again.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load payments on mount
  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  // Handle payment card press
  const handlePaymentPress = (payment) => {
    console.log('💳 Payment card pressed:', payment.id);
    
    // Navigate to PaymentScreen with payment details
    navigation.navigate('Payment', {
      listingId: payment.listingId,
      actionType: payment.actionType,
      price: payment.amount,
      amount: payment.amount,
      paymentId: payment.id,
      existingPaymentData: payment
    });
  };

  // Filter payments based on selected filter
  const getFilteredPayments = () => {
    if (selectedFilter === 'all') {
      return payments;
    }
    return payments.filter(payment => payment.status === selectedFilter);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_payment': return '#FF9800';
      case 'submitted': return '#2196F3';
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending_payment': return 'time-outline';
      case 'submitted': return 'checkmark-circle-outline';
      case 'approved': return 'checkmark-done-outline';
      case 'rejected': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  // Get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'pending_payment': return 'Pending Payment';
      case 'submitted': return 'Payment Submitted';
      case 'approved': return 'Payment Approved';
      case 'rejected': return 'Payment Rejected';
      default: return 'Unknown Status';
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown Date';
    
    let date;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter options
  const filterOptions = [
    { key: 'all', label: 'All', count: payments.length },
    { key: 'pending_payment', label: 'Pending', count: payments.filter(p => p.status === 'pending_payment').length },
    { key: 'submitted', label: 'Submitted', count: payments.filter(p => p.status === 'submitted').length },
    { key: 'approved', label: 'Approved', count: payments.filter(p => p.status === 'approved').length },
    { key: 'rejected', label: 'Rejected', count: payments.filter(p => p.status === 'rejected').length },
  ];

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);
  const filteredPayments = getFilteredPayments();

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar 
        style="dark" 
        backgroundColor="#DFECE2"
        translucent={Platform.OS === "android"}
        barStyle="dark-content"
        animated={true}
        hidden={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#83AFA7" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
          My Payments
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.filterTab,
                selectedFilter === option.key && styles.filterTabActive
              ]}
              onPress={() => setSelectedFilter(option.key)}
            >
              <Text style={[
                styles.filterTabText,
                { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                selectedFilter === option.key && styles.filterTabTextActive
              ]}>
                {option.label} ({option.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Loading payments...
            </Text>
          </View>
        ) : filteredPayments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color="#CCC" />
            <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              No Payments Found
            </Text>
            <Text style={[styles.emptySubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              {selectedFilter === 'all' 
                ? "You haven't made any payments yet."
                : `No ${selectedFilter.replace('_', ' ')} payments found.`
              }
            </Text>
          </View>
        ) : (
          filteredPayments.map((payment) => (
            <TouchableOpacity 
              key={payment.id} 
              style={styles.paymentCard}
              onPress={() => handlePaymentPress(payment)}
            >
              {/* Payment Header */}
              <View style={styles.paymentHeader}>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentId, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    Payment #{payment.id.slice(-8).toUpperCase()}
                  </Text>
                  <Text style={[styles.paymentDate, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    {formatDate(payment.createdAt)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
                  <Ionicons 
                    name={getStatusIcon(payment.status)} 
                    size={16} 
                    color={getStatusColor(payment.status)} 
                  />
                  <Text style={[
                    styles.statusText, 
                    { 
                      fontFamily: fontsLoaded ? "Poppins-Medium" : undefined,
                      color: getStatusColor(payment.status)
                    }
                  ]}>
                    {getStatusText(payment.status)}
                  </Text>
                </View>
              </View>

              {/* Listing Info */}
              {payment.listing && (
                <View style={styles.listingInfo}>
                  <Image 
                    source={{ 
                      uri: payment.listing.images?.[0] || payment.listing.imageUrls?.[0] || 'https://via.placeholder.com/60x60' 
                    }} 
                    style={styles.listingImage} 
                  />
                  <View style={styles.listingDetails}>
                    <Text style={[styles.listingTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      {payment.listing.title}
                    </Text>
                    <Text style={[styles.actionType, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      {payment.actionType} Action
                    </Text>
                  </View>
                  <Text style={[styles.amount, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                    ₱{payment.amount}
                  </Text>
                </View>
              )}

              {/* Payment Details */}
              <View style={styles.paymentDetails}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    Payment Method:
                  </Text>
                  <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    {payment.paymentMethod || 'N/A'}
                  </Text>
                </View>
                
                {payment.referenceNumber && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      Reference Number:
                    </Text>
                    <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      {payment.referenceNumber}
                    </Text>
                  </View>
                )}

                {payment.notes && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      Notes:
                    </Text>
                    <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      {payment.notes}
                    </Text>
                  </View>
                )}

                {payment.submittedAt && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      Submitted:
                    </Text>
                    <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      {formatDate(payment.submittedAt)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Payment Proof Image */}
              {payment.paymentProofUrl && (
                <View style={styles.paymentProofContainer}>
                  <Text style={[styles.paymentProofLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    Payment Proof:
                  </Text>
                  <Image 
                    source={{ uri: payment.paymentProofUrl }} 
                    style={styles.paymentProofImage} 
                  />
                </View>
              )}
            </TouchableOpacity>
          ))
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DFECE2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#DFECE2',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: '#83AFA7',
  },
  headerSpacer: {
    width: 32,
  },
  filterContainer: {
    backgroundColor: '#DFECE2',
    paddingBottom: 16,
  },
  filterScroll: {
    paddingHorizontal: 20,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(131, 175, 167, 0.1)',
  },
  filterTabActive: {
    backgroundColor: '#83AFA7',
  },
  filterTabText: {
    fontSize: 14,
    color: '#83AFA7',
  },
  filterTabTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#83AFA7',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  paymentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentId: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 12,
    color: '#666',
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
  listingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listingImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  listingDetails: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  actionType: {
    fontSize: 12,
    color: '#F68652',
  },
  amount: {
    fontSize: 16,
    color: '#83AFA7',
  },
  paymentDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  paymentProofContainer: {
    marginTop: 8,
  },
  paymentProofLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  paymentProofImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
});

export default MyPaymentsScreen;
