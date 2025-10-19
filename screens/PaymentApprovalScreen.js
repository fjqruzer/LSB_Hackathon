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
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import StandardModal from '../components/StandardModal';
import NotificationManager from '../services/NotificationManager';

const PaymentApprovalScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null); // { latitude, longitude }
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5995, // Default to Manila
    longitude: 120.9842,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [gettingLocation, setGettingLocation] = useState(false);
  const [requiresMeetupLocation, setRequiresMeetupLocation] = useState(false);
  const [currentListing, setCurrentListing] = useState(null);

  // Load Poppins fonts
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

  const fetchPayments = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      
      const paymentsRef = collection(db, 'payments');
      const allPaymentsQuery = query(
        paymentsRef,
        where('sellerId', '==', user.uid)
      );
      
      const allPaymentsUnsubscribe = onSnapshot(allPaymentsQuery, (allSnapshot) => {
        const allPayments = [];
        allSnapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          allPayments.push(data);
        });
        
        // Filter for submitted payments
        const submittedPayments = allPayments.filter(payment => 
          payment.sellerId === user.uid && payment.status === 'submitted'
        );
        
        // Sort by creation date (newest first)
        submittedPayments.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return bTime - aTime;
        });

        setPayments(submittedPayments);
        setLoading(false);
        setRefreshing(false);
      });

      return () => {
        allPaymentsUnsubscribe();
      };
    } catch (error) {
      console.error('Error fetching payments:', error);
      showError('Failed to load payments. Please try again.');
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  const handleApprove = async (payment) => {
    setSelectedPayment(payment);
    try {
      // Prefer deal method from payment if present to avoid fetch
      let isMeetup = payment.listingDealMethod === 'meetup';
      let listingData = null;

      if (payment.listingDealMethod == null) {
        // Fetch listing to check dealMethod when not embedded in payment
        const listingRef = doc(db, 'listings', payment.listingId);
        const listingSnap = await getDoc(listingRef);
        listingData = listingSnap.exists() ? { id: listingSnap.id, ...listingSnap.data() } : null;
        isMeetup = listingData?.dealMethod === 'meetup';
      }

      setCurrentListing(listingData);
      setRequiresMeetupLocation(!!isMeetup);

      if (isMeetup) {
        setShowLocationModal(true);
        // Try to center map to user's current location
        (async () => {
          try {
            setGettingLocation(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              setMapRegion((prev) => ({
                ...prev,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }));
            }
          } catch (e) {
            // graceful fallback to default region
          } finally {
            setGettingLocation(false);
          }
        })();
      } else {
    setShowApproveModal(true);
      }
    } catch (err) {
      console.error('Error loading listing for approval:', err);
      setShowApproveModal(true);
    }
  };

  const handleReject = (payment) => {
    setSelectedPayment(payment);
    setShowRejectModal(true);
  };

  const handleViewDetails = (payment) => {
    console.log('Payment data for modal:', {
      id: payment.id,
      paymentProofUrl: payment.paymentProofUrl,
      hasProof: !!payment.paymentProofUrl,
      allFields: Object.keys(payment)
    });
    setSelectedPayment(payment);
    setShowDetailsModal(true);
  };

  const handleZoomImage = (imageUrl) => {
    setZoomImageUrl(imageUrl);
    setShowZoomModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedPayment) return;

    try {
      // If meetup is required, ensure a location is selected
      if (requiresMeetupLocation && !selectedLocation) {
        showError('Please select a meetup location on the map before approving.');
        return;
      }

      const paymentRef = doc(db, 'payments', selectedPayment.id);
      await updateDoc(paymentRef, {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: user.uid,
        ...(requiresMeetupLocation && selectedLocation
          ? { meetupLocation: { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude } }
          : {}),
      });

      // Send notification to buyer
      await sendNotificationToBuyer('payment_approved', selectedPayment);

      setShowApproveModal(false);
      setShowLocationModal(false);
      setRequiresMeetupLocation(false);
      setSelectedLocation(null);
      setCurrentListing(null);
      setSelectedPayment(null);
    } catch (error) {
      console.error('Error approving payment:', error);
      showError('Failed to approve payment. Please try again.');
    }
  };

  const confirmReject = async () => {
    if (!selectedPayment) return;

    try {
      const paymentRef = doc(db, 'payments', selectedPayment.id);
      await updateDoc(paymentRef, {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: user.uid,
      });

      // Send notification to buyer
      await sendNotificationToBuyer('payment_rejected', selectedPayment);

      setShowRejectModal(false);
      setSelectedPayment(null);
    } catch (error) {
      console.error('Error rejecting payment:', error);
      showError('Failed to reject payment. Please try again.');
    }
  };

  // Send notification to buyer about payment approval/rejection
  const sendNotificationToBuyer = async (notificationType, payment) => {
    try {
      console.log('🔔 Sending notification to buyer:', notificationType, payment.buyerId);
      
      // Get listing details for notification
      const listingDoc = await getDoc(doc(db, 'listings', payment.listingId));
      const listingData = listingDoc.exists() ? listingDoc.data() : null;
      
      // Prepare notification content
      const isApproved = notificationType === 'payment_approved';
      const title = isApproved ? '🎉 Payment Approved!' : '❌ Payment Rejected';
      const body = isApproved 
        ? `Your payment for "${listingData?.title || 'item'}" has been approved by the seller.`
        : `Your payment for "${listingData?.title || 'item'}" was rejected. Please contact the seller.`;
      
      // Prepare notification data
      const notificationData = {
        type: notificationType,
        listingId: payment.listingId,
        paymentId: payment.id,
        actionType: payment.actionType,
        amount: payment.amount,
        sellerId: payment.sellerId,
        sellerName: user.displayName || user.email,
      };
      
      // Use NotificationManager.createNotification (same as other functions in the app)
      await NotificationManager.createNotification(
        payment.buyerId,
        title,
        body,
        notificationData
      );
      
      console.log('✅ Notification sent successfully to buyer:', payment.buyerId);
      
    } catch (error) {
      console.error('❌ Error sending notification to buyer:', error);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted':
      case 'pending':
        return '#FF9800';
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      case 'cancelled':
        return '#9E9E9E';
      default:
        return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'submitted':
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  if (!fontsLoaded) {
    return null;
  }

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
          Payment Approval
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#83AFA7']}
            tintColor="#83AFA7"
          />
        }
      >
        {/* Payment Overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Payment Overview
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' + '20' }]}>
                <Ionicons name="receipt-outline" size={24} color="#FF9800" />
              </View>
              <Text style={[styles.statValue, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined, color: '#FF9800' }]}>
                {payments.length}
              </Text>
              <Text style={[styles.statLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined, color: colors.text }]}>
                Pending Payments
              </Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: '#E8F5E8' }]}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' + '20' }]}>
                <Ionicons name="cash-outline" size={24} color="#4CAF50" />
              </View>
              <Text style={[styles.statValue, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined, color: '#4CAF50' }]}>
                {formatCurrency(payments.reduce((total, payment) => total + (payment.amount || 0), 0))}
              </Text>
              <Text style={[styles.statLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined, color: colors.text }]}>
                Projected Revenue
              </Text>
            </View>
          </View>
        </View>
        {/* Payments List Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Submitted Payments
          </Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#83AFA7" />
            <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined, color: colors.textSecondary }]}>
              Loading payments...
            </Text>
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#83AFA7" />
            <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              No Pending Payments
            </Text>
            <Text style={[styles.emptySubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              You don't have any payments waiting for approval.
            </Text>
          </View>
        ) : (
          <View style={styles.paymentsList}>
            {payments.map((payment) => (
              <TouchableOpacity 
                key={payment.id} 
                style={[
                  styles.paymentCard,
                  styles.compactCard,
                  { borderLeftColor: getStatusColor(payment.status) }
                ]}
                onPress={() => navigation.navigate('PaymentDetail', { payment })}
                activeOpacity={0.7}
              >
                {/* Compact Payment Info */}
                <View style={styles.compactHeader}>
                  <View style={styles.compactLeft}>
                    {payment.listingImage && (
                      <Image 
                        source={{ uri: payment.listingImage }} 
                        style={styles.compactImage} 
                      />
                    )}
                    <View style={styles.compactInfo}>
                      <Text style={[styles.compactTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                        {payment.listingTitle || 'Unknown Item'}
                      </Text>
                      <Text style={[styles.compactId, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {payment.buyerName || 'Unknown Buyer'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.compactRight}>
                    <Text style={[styles.compactAmount, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                      {formatCurrency(payment.amount || 0)}
                    </Text>
                    {payment.paymongoPaid && (
                      <View style={styles.paymongoBadge}>
                        <Ionicons name="card" size={14} color="#4CAF50" />
                        <Text style={[styles.paymongoBadgeText, { fontFamily: fontsLoaded ? 'Poppins-Medium' : undefined }]}>Paid</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Action Icons */}
                <View style={styles.actionIcons}>
                  <TouchableOpacity 
                    style={styles.actionIcon}
                    onPress={() => handleViewDetails(payment)}
                  >
                    <Ionicons name="eye-outline" size={20} color="#83AFA7" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionIcon}
                    onPress={() => handleReject(payment)}
                  >
                    <Ionicons name="close" size={20} color="#F44336" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionIcon}
                    onPress={() => handleApprove(payment)}
                  >
                    <Ionicons name="checkmark" size={20} color="#4CAF50" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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

      {/* Approve Confirmation Modal */}
      <StandardModal
        visible={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Payment"
        message={`Are you sure you want to approve this payment of ${selectedPayment ? formatCurrency(selectedPayment.amount || 0) : ''}?${requiresMeetupLocation ? '\n\nDeal method is meetup. The selected location will be saved.' : ''}`}
        confirmText="Approve"
        cancelText="Cancel"
        onConfirm={confirmApprove}
        showCancel={true}
        confirmButtonStyle="success"
      />

      {/* Reject Confirmation Modal */}
      <StandardModal
        visible={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Payment"
        message={`Are you sure you want to reject this payment of ${selectedPayment ? formatCurrency(selectedPayment.amount || 0) : ''}?`}
        confirmText="Reject"
        cancelText="Cancel"
        onConfirm={confirmReject}
        showCancel={true}
        confirmButtonStyle="danger"
      />

      {/* Meetup Location Picker Modal */}
      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowLocationModal(false);
          setRequiresMeetupLocation(false);
          setSelectedLocation(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.locationModal}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: '#E0E0E0' }]}>
              <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>Select Meetup Location</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowLocationModal(false);
                  setRequiresMeetupLocation(false);
                  setSelectedLocation(null);
                }}
              >
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={mapRegion}
                region={mapRegion}
                onRegionChangeComplete={setMapRegion}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setSelectedLocation({ latitude, longitude });
                }}
              >
                {selectedLocation && (
                  <Marker coordinate={selectedLocation} />
                )}
              </MapView>
              {gettingLocation && (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator size="large" color="#83AFA7" />
                  <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? 'Poppins-Regular' : undefined }]}>Fetching your location…</Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={[styles.modalActions, { borderTopColor: '#E0E0E0' }]}> 
              <TouchableOpacity
                style={[styles.modalActionButton, styles.rejectButton]}
                onPress={async () => {
                  // Recenters to current location if permission granted
                  try {
                    setGettingLocation(true);
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                      setMapRegion((prev) => ({
                        ...prev,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                      }));
                    }
                  } catch (e) {
                    // ignore
                  } finally {
                    setGettingLocation(false);
                  }
                }}
              >
                <Ionicons name="locate" size={16} color="white" />
                <Text style={[styles.modalActionText, { fontFamily: fontsLoaded ? 'Poppins-Medium' : undefined }]}>Use My Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!selectedLocation}
                style={[styles.modalActionButton, styles.approveButton, { opacity: selectedLocation ? 1 : 0.5 }]}
                onPress={confirmApprove}
              >
                <Ionicons name="checkmark" size={16} color="white" />
                <Text style={[styles.modalActionText, { fontFamily: fontsLoaded ? 'Poppins-Medium' : undefined }]}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Details Modal */}
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
                Payment Details
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
              {selectedPayment && (
                <>
                  {/* Product Information */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      Product Information
                    </Text>
                    {selectedPayment.listingImage && (
                      <Image source={{ uri: selectedPayment.listingImage }} style={styles.detailProductImage} />
                    )}
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Item Name:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedPayment.listingTitle || 'Unknown Item'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Action Type:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedPayment.actionType || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  {/* Buyer Information */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      Buyer Information
                    </Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Name:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedPayment.buyerName || 'Unknown Buyer'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Submitted:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {formatDate(selectedPayment.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Payment Information */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      Payment Information
                    </Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Amount:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined, color: '#83AFA7' }]}>
                        {formatCurrency(selectedPayment.amount || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Payment Method:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedPayment.paymentMethod || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        Reference Number:
                      </Text>
                      <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {selectedPayment.referenceNumber || 'N/A'}
                      </Text>
                    </View>
                    {selectedPayment.notes && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                          Notes:
                        </Text>
                        <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                          {selectedPayment.notes}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Payment Proof */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      Payment Proof
                    </Text>
                    {selectedPayment.paymentProofUrl ? (
                      <TouchableOpacity 
                        style={styles.imageContainer}
                        onPress={() => handleZoomImage(selectedPayment.paymentProofUrl)}
                      >
                        <Image 
                          source={{ uri: selectedPayment.paymentProofUrl }} 
                          style={styles.detailProofImage}
                          resizeMode="contain"
                        />
                        <View style={styles.zoomOverlay}>
                          <Ionicons name="expand" size={24} color="white" />
                          <Text style={styles.zoomText}>Tap to zoom</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.noProofContainer}>
                        <Ionicons name="image-outline" size={32} color="#999" />
                        <Text style={styles.noProofText}>No payment proof provided</Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={[styles.modalActions, { borderTopColor: '#E0E0E0' }]}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.rejectButton]}
                onPress={() => {
                  setShowDetailsModal(false);
                  handleReject(selectedPayment);
                }}
              >
                <Ionicons name="close" size={16} color="white" />
                <Text style={[styles.modalActionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Reject
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.approveButton]}
                onPress={() => {
                  setShowDetailsModal(false);
                  handleApprove(selectedPayment);
                }}
              >
                <Ionicons name="checkmark" size={16} color="white" />
                <Text style={[styles.modalActionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Approve
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingVertical: Platform.OS === 'android' ? 12 : 16,
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
    color: '#83AFA7',
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
    fontSize: 12,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
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
  paymentsList: {
    paddingBottom: 20,
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
  },
  paymongoBadge: {
    marginTop: 4,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  paymongoBadgeText: {
    color: '#2E7D32',
    fontSize: 11,
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
  locationModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  mapContainer: {
    height: 350,
    width: '100%',
    backgroundColor: '#EEE',
  },
  map: {
    flex: 1,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)'
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
  noProofContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginTop: 6,
  },
  noProofText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontFamily: 'Poppins-Regular',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: 'white',
    gap: 10,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modalActionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  rejectButton: {
    backgroundColor: '#F68652',
  },
  approveButton: {
    backgroundColor: '#83AFA7',
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

export default PaymentApprovalScreen;

