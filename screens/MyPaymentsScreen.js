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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import StandardModal from '../components/StandardModal';
import NotificationManager from '../services/NotificationManager';

const MyPaymentsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, pending, submitted, approved, rejected
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

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
    
    // Check if payment is expired
    const isExpired = payment.expirationTime ? (() => {
      const expirationTime = payment.expirationTime.toDate ? 
        payment.expirationTime.toDate() : 
        new Date(payment.expirationTime);
      
      const now = new Date();
      return now > expirationTime;
    })() : false;
    
    // Navigate to PaymentScreen with payment details (for both active and expired payments)
    navigation.navigate('Payment', {
      listingId: payment.listingId,
      actionType: payment.actionType,
      price: payment.amount,
      amount: payment.amount,
      paymentId: payment.id,
      existingPaymentData: payment,
      isExpired: isExpired // Flag to indicate if this is expired
    });
  };

  // Handle complete transaction
  const handleCompleteTransaction = (payment) => {
    setSelectedPayment(payment);
    setRating(5); // Default to 5 stars
    setRatingComment('');
    setShowRatingModal(true);
  };

  const handleCancelPayment = (payment) => {
    setSelectedPayment(payment);
    setShowCancelModal(true);
  };

  const confirmCancelPayment = async () => {
    if (!selectedPayment) return;
    
    try {
      const paymentRef = doc(db, 'payments', selectedPayment.id);
      await updateDoc(paymentRef, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: user.uid,
      });

      // Send notification to seller
      await sendNotificationToSeller('payment_cancelled', selectedPayment);

      setShowCancelModal(false);
      setSelectedPayment(null);
      fetchPayments();
      Alert.alert('Success', 'Payment has been cancelled successfully.');
    } catch (error) {
      console.error('Error cancelling payment:', error);
      Alert.alert('Error', 'Failed to cancel payment. Please try again.');
    }
  };

  const sendNotificationToSeller = async (notificationType, payment) => {
    try {
      console.log('🔔 Sending notification to seller:', notificationType, payment.sellerId);
      
      // Get listing details for notification
      const listingDoc = await getDoc(doc(db, 'listings', payment.listingId));
      const listingData = listingDoc.exists() ? listingDoc.data() : null;
      
      // Prepare notification content
      const title = '⚠️ Payment Cancelled';
      const body = `Payment for "${listingData?.title || 'item'}" has been cancelled by the buyer.`;
      
      // Prepare notification data
      const notificationData = {
        type: notificationType,
        listingId: payment.listingId,
        paymentId: payment.id,
        actionType: payment.actionType,
        amount: payment.amount,
        buyerId: payment.buyerId,
        buyerName: user.displayName || user.email,
      };
      
      // Use NotificationManager.createNotification
      await NotificationManager.createNotification(
        payment.sellerId,
        title,
        body,
        notificationData
      );
      
      console.log('✅ Notification sent successfully to seller:', payment.sellerId);
      
    } catch (error) {
      console.error('❌ Error sending notification to seller:', error);
    }
  };

  // Submit rating and complete transaction
  const submitRatingAndComplete = async () => {
    if (!selectedPayment) return;

    try {
      // Update payment status to sold
      const paymentRef = doc(db, 'payments', selectedPayment.id);
      await updateDoc(paymentRef, {
        status: 'sold',
        soldAt: new Date(),
        soldBy: user.uid,
      });

      // Update listing status to sold
      const listingRef = doc(db, 'listings', selectedPayment.listingId);
      await updateDoc(listingRef, {
        status: 'sold',
        soldAt: new Date(),
        soldTo: user.uid,
        finalPrice: selectedPayment.amount,
      });

      // Create rating document
      await addDoc(collection(db, 'ratings'), {
        sellerId: selectedPayment.sellerId,
        buyerId: user.uid,
        listingId: selectedPayment.listingId,
        paymentId: selectedPayment.id,
        rating: rating,
        comment: ratingComment,
        createdAt: new Date(),
        buyerName: user.displayName || user.email,
      });

      // Update seller's rating stats
      await updateSellerRatingStats(selectedPayment.sellerId, rating);

      // Close modal and refresh payments
      setShowRatingModal(false);
      setSelectedPayment(null);
      fetchPayments();

      Alert.alert('Success', 'Transaction completed and seller rated successfully!');
    } catch (error) {
      console.error('Error completing transaction:', error);
      Alert.alert('Error', 'Failed to complete transaction. Please try again.');
    }
  };

  // Update seller's rating statistics
  const updateSellerRatingStats = async (sellerId, newRating) => {
    try {
      const sellerRef = doc(db, 'users', sellerId);
      const sellerDoc = await getDoc(sellerRef);
      
      if (sellerDoc.exists()) {
        const sellerData = sellerDoc.data();
        const currentStats = sellerData.ratingStats || { totalRatings: 0, averageRating: 0 };
        
        const newTotalRatings = currentStats.totalRatings + 1;
        const newAverageRating = ((currentStats.averageRating * currentStats.totalRatings) + newRating) / newTotalRatings;
        
        await updateDoc(sellerRef, {
          ratingStats: {
            totalRatings: newTotalRatings,
            averageRating: Math.round(newAverageRating * 10) / 10, // Round to 1 decimal place
            lastUpdated: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error updating seller rating stats:', error);
    }
  };

  // Filter payments based on selected filter
  const getFilteredPayments = () => {
    if (selectedFilter === 'all') {
      return payments;
    }
    return payments.filter(payment => payment.status === selectedFilter);
  };

  // Get status color - keep different colors for different statuses
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_payment': return '#FF9800';
      case 'submitted': return '#2196F3';
      case 'approved': return '#4CAF50';
      case 'sold': return '#2E7D32';
      case 'rejected': return '#F44336';
      case 'cancelled': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending_payment': return 'time-outline';
      case 'submitted': return 'checkmark-circle-outline';
      case 'approved': return 'checkmark-done-outline';
      case 'sold': return 'trophy-outline';
      case 'rejected': return 'close-circle-outline';
      case 'cancelled': return 'ban-outline';
      default: return 'help-circle-outline';
    }
  };

  // Get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'pending_payment': return 'Pending Payment';
      case 'submitted': return 'Payment Submitted';
      case 'approved': return 'Payment Approved';
      case 'sold': return 'Transaction Sold';
      case 'rejected': return 'Payment Rejected';
      case 'cancelled': return 'Payment Cancelled';
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
    { key: 'cancelled', label: 'Cancelled', count: payments.filter(p => p.status === 'cancelled').length },
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
            <Ionicons name="card-outline" size={64} color="#83AFA7" />
            <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
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
              style={[
                styles.paymentCard,
                styles.compactCard,
                { borderLeftColor: getStatusColor(payment.status) } // Different border colors per status
              ]}
              onPress={() => handlePaymentPress(payment)}
            >
              {/* Compact Payment Info */}
              <View style={styles.compactHeader}>
                <View style={styles.compactLeft}>
                  {payment.listing && (
                    <Image 
                      source={{ 
                        uri: payment.listing.images?.[0] || payment.listing.imageUrls?.[0] || 'https://via.placeholder.com/40x40' 
                      }} 
                      style={styles.compactImage} 
                    />
                  )}
                  <View style={styles.compactInfo}>
                    <Text style={[styles.compactTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      {payment.listing?.title || 'Unknown Item'}
                  </Text>
                    <Text style={[styles.compactId, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      #{payment.id.slice(-6).toUpperCase()}
                  </Text>
                </View>
                </View>
                <View style={styles.compactRight}>
                  <Text style={[styles.compactAmount, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                    ₱{payment.amount}
                  </Text>
                  <View style={[styles.compactStatus, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
                  <Ionicons 
                    name={getStatusIcon(payment.status)} 
                      size={12} 
                    color={getStatusColor(payment.status)} 
                  />
                  <Text style={[
                      styles.compactStatusText, 
                    { 
                      fontFamily: fontsLoaded ? "Poppins-Medium" : undefined,
                      color: getStatusColor(payment.status)
                    }
                  ]}>
                    {getStatusText(payment.status)}
                  </Text>
                </View>
              </View>
                </View>
                
                {/* Action Buttons for Approved Payments */}
                {payment.status === 'approved' && (
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity 
                      style={styles.cancelButtonSmall}
                      onPress={() => handleCancelPayment(payment)}
                    >
                      <Ionicons name="close-circle" size={16} color="#F44336" />
                      <Text style={[styles.cancelButtonTextSmall, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.completeButton}
                      onPress={() => handleCompleteTransaction(payment)}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="white" />
                      <Text style={[styles.completeButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Received
                      </Text>
                    </TouchableOpacity>
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

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalContainer}>
            <View style={styles.ratingModalHeader}>
              <Text style={[styles.ratingModalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Rate Seller
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowRatingModal(false)}
              >
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.ratingModalContent}>
              <Text style={[styles.ratingModalSubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                How was your experience?
              </Text>
              
              {/* Star Rating */}
              <View style={styles.starRatingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}
                  >
                    <Ionicons
                      name={star <= rating ? "star" : "star-outline"}
                      size={24}
                      color={star <= rating ? "#FFD700" : "#DDD"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={[styles.ratingText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                {rating === 1 ? "Poor" : 
                 rating === 2 ? "Fair" : 
                 rating === 3 ? "Good" : 
                 rating === 4 ? "Very Good" : "Excellent"}
              </Text>
              
              {/* Comment Input */}
              <Text style={[styles.commentLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Comment (optional)
              </Text>
              <TextInput
                style={[styles.commentInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                placeholder="Share your experience..."
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </ScrollView>
            
            <View style={styles.ratingModalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={[styles.cancelButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={submitRatingAndComplete}
              >
                <Text style={[styles.submitButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Submit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Payment Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalContainer}>
            {/* Modal Header */}
            <View style={styles.ratingModalHeader}>
              <Text style={[styles.ratingModalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Cancel Payment
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCancelModal(false)}
              >
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <View style={styles.ratingModalContent}>
              <View style={styles.warningIconContainer}>
                <Ionicons name="warning" size={48} color="#F44336" />
              </View>
              
              <Text style={[styles.ratingModalSubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Are you sure you want to cancel this payment?
              </Text>
              
              <Text style={[styles.warningText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                This action cannot be undone. The seller will be notified of the cancellation.
              </Text>

              {/* Modal Footer */}
              <View style={styles.ratingModalFooter}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowCancelModal(false)}
                >
                  <Text style={[styles.cancelButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    Keep Payment
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.submitButton}
                  onPress={confirmCancelPayment}
                >
                  <Text style={[styles.submitButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    Cancel Payment
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(131, 175, 167, 0.1)',
  },
  filterTabActive: {
    backgroundColor: '#83AFA7',
  },
  filterTabText: {
    fontSize: 12,
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
  },
  paymentCard: {
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
    color: '#83AFA7',
    marginBottom: 4,
  },
  compactStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  compactStatusText: {
    fontSize: 10,
    marginLeft: 2,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  cancelButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cancelButtonTextSmall: {
    color: '#F44336',
    fontSize: 12,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingModalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '85%',
    maxHeight: '65%',
    overflow: 'hidden',
  },
  ratingModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  ratingModalTitle: {
    fontSize: 16,
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  ratingModalContent: {
    padding: 16,
  },
  ratingModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  starRatingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  commentLabel: {
    fontSize: 13,
    color: '#333',
    marginBottom: 6,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#333',
    minHeight: 60,
  },
  ratingModalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 13,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#83AFA7',
    marginLeft: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 13,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
});

export default MyPaymentsScreen;
