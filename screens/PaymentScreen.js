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
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../config/cloudinary';
import PaymentTimeoutService from '../services/PaymentTimeoutService';
import StandardModal from '../components/StandardModal';

const PaymentScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { listingId, actionType, price, amount, paymentId, existingPaymentData } = route?.params || {};
  const actualPrice = price || amount;
  
  // Core state
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Payment form state
  const [paymentProof, setPaymentProof] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [sellerPaymentMethods, setSellerPaymentMethods] = useState([]);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showPaymentExpiredModal, setShowPaymentExpiredModal] = useState(false);
  const [displayPrice, setDisplayPrice] = useState(actualPrice);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(180);
  const [timerActive, setTimerActive] = useState(true);
  const [existingPayment, setExistingPayment] = useState(null);
  
  // UI state
  const [stateLoaded, setStateLoaded] = useState(false);
  const [paymentRecordLoaded, setPaymentRecordLoaded] = useState(false);

  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Create payment record for Lock action
  const createPaymentRecordForLockAction = useCallback(async () => {
    try {
      
      const expirationTime = new Date(Date.now() + (3 * 60 * 1000));
      
      const paymentData = {
        listingId: listingId,
        buyerId: user.uid,
        buyerName: user.displayName || user.email,
        sellerId: listing?.sellerId || '',
        actionType: actionType,
        amount: displayPrice,
        status: 'pending_payment',
        expirationTime: expirationTime,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      };
      
      const paymentRef = await addDoc(collection(db, 'payments'), paymentData);
      
      setExistingPayment({ id: paymentRef.id, ...paymentData });
      
      const now = new Date();
      const timeLeft = Math.max(0, Math.floor((expirationTime - now) / 1000));
      setTimeRemaining(timeLeft);
      
      return paymentRef.id;
    } catch (error) {
      console.error('❌ Error creating payment record for Lock action:', error);
      throw error;
    }
  }, [user.uid, listingId, listing?.sellerId, actionType, displayPrice]);

  // Load existing payment record
  const loadExistingPayment = useCallback(async () => {
    try {
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('listingId', '==', listingId),
        where('buyerId', '==', user.uid),
        where('status', '==', 'pending_payment')
      );
      
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      if (!paymentsSnapshot.empty) {
        const paymentDoc = paymentsSnapshot.docs[0];
        const paymentData = { id: paymentDoc.id, ...paymentDoc.data() };
        setExistingPayment(paymentData);
        
        if (paymentData.expirationTime) {
          const expirationTime = paymentData.expirationTime.toDate ? 
            paymentData.expirationTime.toDate() : 
            new Date(paymentData.expirationTime);
          
          const now = new Date();
          const timeLeft = Math.max(0, Math.floor((expirationTime - now) / 1000));
          
          setTimeRemaining(timeLeft);
          
          if (timeLeft <= 0) {
            setTimerActive(false);
            Alert.alert(
              'Payment Expired',
              'This payment opportunity has expired.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error loading existing payment:', error);
      return false;
    }
  }, [listingId, user.uid, navigation]);

  // Initialize payment data
  const initializePaymentData = useCallback(async () => {
    try {
      
      // Load listing
      const listingRef = doc(db, 'listings', listingId);
      const listingDoc = await getDoc(listingRef);
      if (listingDoc.exists()) {
        const listingData = { id: listingDoc.id, ...listingDoc.data() };
        setListing(listingData);
        
        const finalPrice = actualPrice || listingData.price || 0;
        setDisplayPrice(finalPrice);
        
        // Load seller payment methods
        if (listingData.sellerId) {
          const sellerRef = doc(db, 'users', listingData.sellerId);
          const sellerDoc = await getDoc(sellerRef);
          if (sellerDoc.exists()) {
            const sellerData = sellerDoc.data();
            setSellerPaymentMethods(sellerData.paymentMethods || []);
          }
        }
      }
      
      // Handle existing payment data
      if (existingPaymentData) {
        setExistingPayment(existingPaymentData);
        
        // Pre-fill form data
        if (existingPaymentData.paymentMethod) {
          setSelectedPaymentMethod(existingPaymentData.paymentMethodDetails);
        }
        if (existingPaymentData.referenceNumber) {
          setReferenceNumber(existingPaymentData.referenceNumber);
        }
        if (existingPaymentData.notes) {
          setNotes(existingPaymentData.notes);
        }
        if (existingPaymentData.paymentProofUrl) {
          setPaymentProof({ uri: existingPaymentData.paymentProofUrl });
        }
        
        // Set timer
        if (existingPaymentData.expirationTime) {
          const expirationTime = existingPaymentData.expirationTime.toDate ? 
            existingPaymentData.expirationTime.toDate() : 
            new Date(existingPaymentData.expirationTime);
          
          const now = new Date();
          const timeLeft = Math.max(0, Math.floor((expirationTime - now) / 1000));
          setTimeRemaining(timeLeft);
        }
      } else {
        // Load existing payment or create new one
        const found = await loadExistingPayment();
        if (!found && actionType === 'Locked') {
          await createPaymentRecordForLockAction();
        }
      }
      
      setPaymentRecordLoaded(true);
    } catch (error) {
      console.error('❌ Error initializing payment data:', error);
      Alert.alert('Error', 'Failed to load payment data');
    } finally {
      setLoading(false);
      setStateLoaded(true);
    }
  }, [listingId, actualPrice, existingPaymentData, actionType, loadExistingPayment, createPaymentRecordForLockAction]);

  // Initialize on mount
  useEffect(() => {
    if (listingId && !stateLoaded) {
      initializePaymentData();
    }
  }, [listingId, stateLoaded, initializePaymentData]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          Alert.alert(
            'Time Up!',
            'Your payment time has expired. The opportunity has been passed to the next buyer.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerActive, timeRemaining, navigation]);

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  const handleImagePicker = () => {
    Alert.alert(
      'Add Payment Proof',
      'Choose how you want to add payment proof',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setPaymentProof(result.assets[0]);
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is needed to select images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setPaymentProof(result.assets[0]);
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const removeImage = () => {
    setPaymentProof(null);
  };

  const handleSubmitPayment = async () => {
    
    // Check if payment timer has expired
    if (!timerActive || timeRemaining <= 0) {
      setShowPaymentExpiredModal(true);
      return;
    }
    
    if (!listingId) {
      Alert.alert('Error', 'Listing ID is missing. Please try again.');
      return;
    }
    
    if (!paymentProof) {
      Alert.alert('Error', 'Please upload payment proof');
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    if (!referenceNumber.trim()) {
      Alert.alert('Error', 'Please enter reference number');
      return;
    }

    setSubmitting(true);

    try {
      let paymentProofUrl;
      
      try {
        paymentProofUrl = await uploadImageToCloudinary(paymentProof.uri);
      } catch (uploadError) {
        console.error('❌ Cloudinary upload failed:', uploadError);
        
        const shouldContinue = await new Promise((resolve) => {
          Alert.alert(
            'Upload Failed',
            'Failed to upload payment proof image. Would you like to submit the payment without the image?',
            [
              { text: 'Cancel', onPress: () => resolve(false) },
              { text: 'Submit Without Image', onPress: () => resolve(true) }
            ]
          );
        });
        
        if (!shouldContinue) {
          setSubmitting(false);
          return;
        }
        
        paymentProofUrl = paymentProof.uri;
      }

      let paymentRef;
      
      if (existingPayment) {
        const paymentData = {
          paymentMethod: selectedPaymentMethod.bankName,
          paymentMethodDetails: selectedPaymentMethod,
          referenceNumber: referenceNumber.trim(),
          paymentProofUrl,
          notes: notes.trim(),
          status: 'submitted',
          submittedAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        };
        
        await updateDoc(doc(db, 'payments', existingPayment.id), paymentData);
        paymentRef = { id: existingPayment.id };
        
      } else {
        const paymentData = {
          listingId,
          buyerId: user.uid,
          buyerName: user.displayName || user.email,
          sellerId: listing?.sellerId || '',
          actionType,
          amount: displayPrice,
          paymentMethod: selectedPaymentMethod.bankName,
          paymentMethodDetails: selectedPaymentMethod,
          referenceNumber: referenceNumber.trim(),
          paymentProofUrl,
          notes: notes.trim(),
          status: 'submitted',
          submittedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        };

        paymentRef = await addDoc(collection(db, 'payments'), paymentData);
      }

      await updateDoc(doc(db, 'listings', listingId), {
        paymentSubmitted: true,
        paymentId: paymentRef.id,
        paymentSubmittedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });

      await addDoc(collection(db, 'activityLogs'), {
        listingId,
        userId: user.uid,
        userName: user.displayName || user.email,
        action: 'Payment Submitted',
        details: `Payment proof submitted for ${actionType} action (₱${displayPrice})`,
        timestamp: serverTimestamp(),
      });

      await PaymentTimeoutService.onPaymentSubmitted(listingId);
      
      setTimerActive(false);

      Alert.alert(
        'Payment Submitted!',
        'Your payment proof has been submitted successfully. The seller will review and confirm your payment.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('❌ Error submitting payment:', error);
      Alert.alert('Error', 'Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  if (loading || !listing || !stateLoaded) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
            {!stateLoaded ? 'Loading form data...' : 'Loading...'}
          </Text>
        </View>
      </View>
    );
  }

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#83AFA7" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
          Submit Payment
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Listing Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Payment Details
          </Text>
          
          <View style={styles.listingCard}>
            <Image 
              source={{ uri: listing?.images?.[0] || listing?.imageUrls?.[0] || 'https://via.placeholder.com/60x60' }} 
              style={styles.listingImage} 
            />
            <View style={styles.listingInfo}>
              <Text style={[styles.listingTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                {listing?.title || 'Loading...'}
              </Text>
              <Text style={[styles.actionType, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                {actionType} Action
              </Text>
              <Text style={[styles.amount, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                ₱{displayPrice || '0'}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Form */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Payment Information
          </Text>

          {/* Payment Proof */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Payment Proof *
            </Text>
            {paymentProof ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: paymentProof.uri }} style={styles.paymentImage} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Ionicons name="close" size={20} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.imagePickerButton,
                  (!timerActive || timeRemaining <= 0) && styles.disabledInput
                ]} 
                onPress={() => {
                  if (timerActive && timeRemaining > 0) {
                    handleImagePicker();
                  }
                }}
                disabled={!timerActive || timeRemaining <= 0}
              >
                <Ionicons name="camera" size={24} color="#83AFA7" />
                <Text style={[styles.imagePickerText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Add Payment Proof
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Payment Method Selector */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Select Payment Method *
            </Text>
            <TouchableOpacity 
              style={[
                styles.paymentMethodSelector,
                (!timerActive || timeRemaining <= 0) && styles.disabledInput
              ]}
              onPress={() => {
                if (timerActive && timeRemaining > 0) {
                  setShowPaymentMethodModal(true);
                }
              }}
              disabled={!timerActive || timeRemaining <= 0}
            >
              <Text style={[
                styles.paymentMethodText, 
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                !selectedPaymentMethod && styles.placeholderText
              ]}>
                {selectedPaymentMethod 
                  ? `${selectedPaymentMethod.bankName} - ${selectedPaymentMethod.accountNumber}`
                  : 'Select seller\'s payment method'
                }
              </Text>
              <Ionicons name="chevron-down" size={20} color="#83AFA7" />
            </TouchableOpacity>
          </View>

          {/* Reference Number */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Reference Number *
            </Text>
            <TextInput
              style={[
                styles.textInput, 
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                (!timerActive || timeRemaining <= 0) && styles.disabledInput
              ]}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="Enter transaction reference number"
              placeholderTextColor="#999"
              editable={timerActive && timeRemaining > 0}
            />
          </View>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Additional Notes
            </Text>
            <TextInput
              style={[
                styles.textArea, 
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                (!timerActive || timeRemaining <= 0) && styles.disabledInput
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional information about the payment..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              editable={timerActive && timeRemaining > 0}
            />
          </View>
        </View>

      </ScrollView>

      {/* Submit Button Container with Timer */}
      <View style={[styles.submitButtonContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        {/* Payment Timer */}
        <View style={styles.timerInContainer}>
          <Ionicons 
            name="time-outline" 
            size={20} 
            color="#F68652" 
          />
          <Text style={[
            styles.timerTimeInContainer,
            { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined },
            timeRemaining <= 30 && styles.timerTimeDanger
          ]}>
            {Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:{(timeRemaining % 60).toString().padStart(2, '0')}:00
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton, 
            (submitting || !timerActive || timeRemaining <= 0) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmitPayment}
          disabled={submitting || !timerActive || timeRemaining <= 0}
        >
          <Text style={[styles.submitButtonText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            {!timerActive || timeRemaining <= 0 
              ? 'Payment Expired' 
              : submitting 
                ? 'Submitting...' 
                : 'Submit Payment Proof'
            }
          </Text>
        </TouchableOpacity>
      </View>

      {/* Payment Method Selection Modal */}
      <Modal
        visible={showPaymentMethodModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPaymentMethodModal(false)}>
                <Text style={[styles.modalCancelText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Select Payment Method
              </Text>
              <View style={styles.modalSpacer} />
            </View>
            
            <ScrollView style={styles.paymentMethodsList}>
              {sellerPaymentMethods.length > 0 ? (
                sellerPaymentMethods.map((method, index) => (
                  <TouchableOpacity
                    key={method.id || index}
                    style={[
                      styles.paymentMethodItem,
                      selectedPaymentMethod?.id === method.id && styles.selectedPaymentMethod
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethod(method);
                      setShowPaymentMethodModal(false);
                    }}
                  >
                    <View style={styles.paymentMethodInfo}>
                      <Text style={[styles.paymentMethodName, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                        {method.bankName}
                      </Text>
                      <Text style={[styles.paymentMethodAccount, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {method.accountNumber}
                      </Text>
                      <Text style={[styles.paymentMethodAccountName, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {method.accountName}
                      </Text>
                    </View>
                    {selectedPaymentMethod?.id === method.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#83AFA7" />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noPaymentMethods}>
                  <Text style={[styles.noPaymentMethodsText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    No payment methods available for this seller
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Expired Modal */}
      <StandardModal
        visible={showPaymentExpiredModal}
        onClose={() => setShowPaymentExpiredModal(false)}
        title="Payment Expired"
        message="Your payment time has expired. The opportunity has been passed to the next buyer."
        confirmText="OK"
        onConfirm={() => navigation.goBack()}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#83AFA7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#DFECE2',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: '#83AFA7',
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
  sectionTitle: {
    fontSize: 16,
    color: '#83AFA7',
    marginBottom: 16,
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  actionType: {
    fontSize: 14,
    color: '#F68652',
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    color: '#83AFA7',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imagePickerButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  imagePickerText: {
    fontSize: 14,
    color: '#83AFA7',
    marginTop: 8,
  },
  imageContainer: {
    position: 'relative',
  },
  paymentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#83AFA7',
    paddingVertical: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    minHeight: 60,
    ...(Platform.OS === 'android' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  submitButton: {
    backgroundColor: '#F68652',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'android' && {
      elevation: 4,
    }),
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
    elevation: 1,
    shadowOpacity: 0.05,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Timer in Container Styles
  timerInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
    flex: 1,
  },
  timerTimeInContainer: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  timerTimeDanger: {
    color: '#FFCDD2',
  },
  // Payment Method Selector Styles
  paymentMethodSelector: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  disabledInput: {
    backgroundColor: '#F0F0F0',
    opacity: 0.6,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#83AFA7',
  },
  modalTitle: {
    fontSize: 18,
    color: '#333',
  },
  modalSpacer: {
    width: 60,
  },
  paymentMethodsList: {
    maxHeight: 400,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedPaymentMethod: {
    backgroundColor: '#E8F5F3',
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  paymentMethodAccount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  paymentMethodAccountName: {
    fontSize: 12,
    color: '#999',
  },
  noPaymentMethods: {
    padding: 40,
    alignItems: 'center',
  },
  noPaymentMethodsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default PaymentScreen;