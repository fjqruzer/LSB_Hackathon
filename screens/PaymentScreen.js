import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../config/cloudinary';
import PaymentTimeoutService from '../services/PaymentTimeoutService';
import NotificationManager from '../services/NotificationManager';
import StandardModal from '../components/StandardModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatService from '../services/ChatService';
const PSGCService = require('../services/PSGCService');

const PaymentScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { listingId, actionType, price, amount, paymentId, existingPaymentData, isExpired } = route?.params || {};
  const actualPrice = price || amount;
  
  // Core state
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Payment form state
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofSet, setPaymentProofSet] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [sellerPaymentMethods, setSellerPaymentMethods] = useState([]);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showPaymentExpiredModal, setShowPaymentExpiredModal] = useState(false);
  const [displayPrice, setDisplayPrice] = useState(actualPrice);
  
  // Address state
  const [userAddresses, setUserAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [existingPayment, setExistingPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending_payment');
  
  // UI state
  const [stateLoaded, setStateLoaded] = useState(false);
  const [paymentRecordLoaded, setPaymentRecordLoaded] = useState(false);
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState('');
  
  // Ref to track initialization to prevent multiple calls
  const initializationRef = useRef(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Helper function to format price with decimal places
  const formatPrice = (price) => {
    if (!price) return '0.00';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return numPrice.toFixed(2);
  };

  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Storage key for payment proof
  const getStorageKey = () => `payment_proof_${listingId}_${actionType}`;

  // Save payment proof to AsyncStorage
  const savePaymentProof = async (imageData) => {
    try {
      const storageKey = getStorageKey();
      await AsyncStorage.setItem(storageKey, JSON.stringify(imageData));
      console.log('💾 Payment proof saved to storage');
    } catch (error) {
      console.error('❌ Error saving payment proof:', error);
    }
  };

  // Load payment proof from AsyncStorage
  const loadPaymentProof = async () => {
    try {
      const storageKey = getStorageKey();
      const savedData = await AsyncStorage.getItem(storageKey);
      
      if (savedData) {
        const imageData = JSON.parse(savedData);
        setPaymentProof(imageData);
        setPaymentProofSet(true);
        console.log('📱 Payment proof loaded from storage');
      }
    } catch (error) {
      console.error('❌ Error loading payment proof:', error);
    }
  };

  // Load user addresses and set default
  const loadUserAddresses = async () => {
    try {
      setLoadingAddresses(true);
      console.log('🏠 Loading user addresses...');
      
      const addressesQuery = query(
        collection(db, 'addresses'),
        where('userId', '==', user.uid)
      );
      const addressesSnapshot = await getDocs(addressesQuery);
      
      const addresses = [];
      let defaultAddress = null;
      
      addressesSnapshot.docs.forEach((doc) => {
        const addressData = { id: doc.id, ...doc.data() };
        addresses.push(addressData);
        
        // Set default address
        if (addressData.isDefault) {
          defaultAddress = addressData;
        }
      });
      
      setUserAddresses(addresses);
      
      // Set default address or first address
      if (defaultAddress) {
        setSelectedAddress(defaultAddress);
        console.log('🏠 Default address set:', defaultAddress.name);
      } else if (addresses.length > 0) {
        setSelectedAddress(addresses[0]);
        console.log('🏠 First address set as default:', addresses[0].name);
      } else {
        console.log('🏠 No addresses found for user');
      }
      
    } catch (error) {
      console.error('❌ Error loading user addresses:', error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  // Clear payment proof from AsyncStorage
  const clearPaymentProof = async () => {
    try {
      const storageKey = getStorageKey();
      await AsyncStorage.removeItem(storageKey);
      console.log('🗑️ Payment proof cleared from storage');
    } catch (error) {
      console.error('❌ Error clearing payment proof:', error);
    }
  };

  // Test function to verify listing data fetch
  const testListingFetch = async (testListingId) => {
    try {
      console.log('🧪 TESTING LISTING FETCH FOR ID:', testListingId);
      const listingRef = doc(db, 'listings', testListingId);
      const listingDoc = await getDoc(listingRef);
      
      if (!listingDoc.exists()) {
        console.log('❌ Listing not found');
        return;
      }
      
      const listingData = { id: listingDoc.id, ...listingDoc.data() };
      console.log('✅ TEST LISTING DATA:', {
        id: listingData.id,
        title: listingData.title,
        sellerId: listingData.sellerId,
        allFields: Object.keys(listingData)
      });
      
      return listingData;
    } catch (error) {
      console.error('❌ TEST ERROR:', error);
    }
  };

  // Check if payment form should be disabled
  const isPaymentFormDisabled = () => {
    return paymentStatus !== 'pending_payment';
  };

  // Create payment record for Lock action
  const createPaymentRecordForLockAction = useCallback(async () => {
    try {
      
      const expirationTime = new Date(Date.now() + (3 * 60 * 1000));
      
      // Get listing data to ensure we have sellerId
      const listingRef = doc(db, 'listings', listingId);
      const listingDoc = await getDoc(listingRef);
      if (!listingDoc.exists()) {
        throw new Error('Listing not found');
      }
      const listingData = { id: listingDoc.id, ...listingDoc.data() };
      
      console.log('🔍 DEBUGGING LOCK LISTING DATA:');
      console.log('📋 Listing ID:', listingId);
      console.log('📋 Raw listing data:', listingDoc.data());
      console.log('📋 Processed listing data:', listingData);
      console.log('📋 Title field value:', listingData.title);
      console.log('📋 All listing fields:', Object.keys(listingData));
      console.log('📋 Title type:', typeof listingData.title);
      console.log('📋 Title length:', listingData.title ? listingData.title.length : 'undefined');
      console.log('📋 Final listingTitle to be stored:', listingData.title || 'Unknown Item');

      const paymentData = {
        listingId: listingId,
        buyerId: user.uid,
        buyerName: user.displayName || user.email,
        sellerId: listingData.sellerId || listingData.userId || '',
        listingTitle: listingData.title || 'Unknown Item',
        listingImage: listingData.images && listingData.images.length > 0 ? listingData.images[0] : null,
        actionType: actionType,
        amount: displayPrice,
        status: 'pending_payment',
        expirationTime: expirationTime,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      };

      console.log('💳 Creating Lock payment with data:', {
        listingId,
        buyerId: user.uid,
        sellerId: listingData.sellerId || listingData.userId || '',
        listingData: {
          sellerId: listingData.sellerId,
          userId: listingData.userId,
          sellerName: listingData.sellerName,
          title: listingData.title,
          name: listingData.name,
          itemName: listingData.itemName,
          allFields: Object.keys(listingData)
        }
      });
      
      const paymentRef = await addDoc(collection(db, 'payments'), paymentData);
      
      setExistingPayment({ id: paymentRef.id, ...paymentData });
      
      const now = new Date();
      const timeLeft = Math.max(0, Math.floor((expirationTime - now) / 1000));
      setTimeRemaining(timeLeft);
      
      // Activate timer if there's time remaining
      if (timeLeft > 0) {
        setTimerActive(true);
      } else {
        setTimerActive(false);
      }
      
      return paymentRef.id;
    } catch (error) {
      console.error('❌ Error creating payment record for Lock action:', error);
      throw error;
    }
  }, [user.uid, listingId, actionType]);

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
        setPaymentStatus(paymentData.status || 'pending_payment');
        
        if (paymentData.expirationTime) {
          const expirationTime = paymentData.expirationTime.toDate ? 
            paymentData.expirationTime.toDate() : 
            new Date(paymentData.expirationTime);
          
          const now = new Date();
          const timeLeft = Math.max(0, Math.floor((expirationTime - now) / 1000));
          
          setTimeRemaining(timeLeft);
          
          // Activate timer if there's time remaining and payment is pending
          if (timeLeft > 0 && paymentData.status === 'pending_payment') {
            setTimerActive(true);
          } else {
            setTimerActive(false);
          }
          
          if (timeLeft <= 0) {
            setTimerActive(false);
            if (!isExpired && paymentData.status !== 'cancelled' && paymentData.status !== 'sold') {
              Alert.alert(
                'Payment Expired',
                'This payment opportunity has expired.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            }
          }
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error loading existing payment:', error);
      return false;
    }
  }, [listingId, user.uid]);

  // Initialize payment data - stable function without dependencies
  const initializePaymentData = useCallback(async () => {
    try {
      
      // Test the listing fetch to verify data structure
      await testListingFetch(listingId);
      
      // Load listing
      const listingRef = doc(db, 'listings', listingId);
      const listingDoc = await getDoc(listingRef);
      if (listingDoc.exists()) {
        const listingData = { id: listingDoc.id, ...listingDoc.data() };
        setListing(listingData);
        
        // Use actualPrice from notification if available, otherwise calculate from listing data
        let finalPrice = actualPrice;
        if (!finalPrice) {
          // Extract numeric value from ChatService.getDisplayPrice result
          const chatServicePrice = ChatService.getDisplayPrice(listingData);
          finalPrice = parseFloat(chatServicePrice.replace('₱', '')) || 0;
        }
        
        console.log('🔍 PaymentScreen - Price calculation:', {
          actualPrice,
          chatServicePrice: ChatService.getDisplayPrice(listingData),
          finalPrice,
          listingData: {
            priceType: listingData.priceType,
            minePrice: listingData.minePrice,
            stealPrice: listingData.stealPrice,
            lockPrice: listingData.lockPrice,
            currentBid: listingData.currentBid,
            startingPrice: listingData.startingPrice,
            price: listingData.price
          }
        });
        
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
        // Only load from existing payment data if no saved proof in AsyncStorage
        if (existingPaymentData.paymentProofUrl && !paymentProofSet) {
          // Check if we have a saved proof first
          const storageKey = getStorageKey();
          const savedData = await AsyncStorage.getItem(storageKey);
          if (!savedData) {
            setPaymentProof({ uri: existingPaymentData.paymentProofUrl });
            setPaymentProofSet(true);
          }
        }
        
        // Set timer
        if (existingPaymentData.expirationTime) {
          const expirationTime = existingPaymentData.expirationTime.toDate ? 
            existingPaymentData.expirationTime.toDate() : 
            new Date(existingPaymentData.expirationTime);
          
          const now = new Date();
          const timeLeft = Math.max(0, Math.floor((expirationTime - now) / 1000));
          setTimeRemaining(timeLeft);
          
          // Activate timer if there's time remaining and payment is pending
          if (timeLeft > 0 && existingPaymentData.status === 'pending_payment') {
            setTimerActive(true);
          } else {
            setTimerActive(false);
          }
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
  }, []);


  // Initialize on mount - only run once when listingId changes
  useEffect(() => {
    if (listingId && !initializationRef.current && !isInitializing) {
      initializationRef.current = true;
      setIsInitializing(true);
      initializePaymentData().finally(() => {
        setIsInitializing(false);
        // Load saved payment proof after initialization is complete
        setTimeout(() => {
          loadPaymentProof();
        }, 100);
      });
    }
    
    // Reset initialization ref when component unmounts
    return () => {
      initializationRef.current = false;
      setIsInitializing(false);
    };
  }, [listingId]);

  // Real-time payment status listener
  useEffect(() => {
    if (!paymentId) return;
    
    const paymentRef = doc(db, 'payments', paymentId);
    const unsubscribe = onSnapshot(paymentRef, (doc) => {
      if (doc.exists()) {
        const paymentData = doc.data();
        
        // Update payment status
        setPaymentStatus(paymentData.status || 'pending_payment');
        
        // Check if payment has been cancelled
        if (paymentData.status === 'cancelled') {
          setTimerActive(false);
          // Don't show alerts for cancelled payments when viewing them
          if (!isExpired) {
            setShowPaymentExpiredModal(true);
          Alert.alert(
              'Payment Cancelled',
              paymentData.cancelledReason || 'Your payment has been automatically cancelled.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        }
      }
    }, (error) => {
      console.error('Error listening to payment updates:', error);
    });
    
    return () => unsubscribe();
  }, [paymentId, navigation]);

  // Real-time payment timer listener
  useEffect(() => {
    if (!paymentId) return;

    const paymentRef = doc(db, 'payments', paymentId);
    const unsubscribe = onSnapshot(paymentRef, (doc) => {
      if (doc.exists()) {
        const paymentData = doc.data();
        
        // Update payment status if it changed
        if (paymentData.status !== paymentStatus) {
          setPaymentStatus(paymentData.status);
        }
        
        // Update timer if expiration time changed
        if (paymentData.expirationTime) {
          const expirationTime = paymentData.expirationTime.toDate ? 
            paymentData.expirationTime.toDate() : 
            new Date(paymentData.expirationTime);
          
          const now = new Date();
          const timeLeft = Math.max(0, Math.floor((expirationTime - now) / 1000));
          
          console.log(`🔄 Real-time timer update: ${timeLeft} seconds remaining`);
          setTimeRemaining(timeLeft);
          
          // Activate timer if there's time remaining and payment is not completed
          if (timeLeft > 0 && paymentData.status === 'pending_payment') {
            setTimerActive(true);
          } else {
            setTimerActive(false);
          }
          
          // If time expired, stop timer and show alert (only if not viewing expired payment)
          if (timeLeft <= 0) {
            setTimerActive(false);
            if (!isExpired && paymentData.status !== 'cancelled' && paymentData.status !== 'sold') {
              Alert.alert(
                'Payment Expired',
                'This payment opportunity has expired.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            }
          }
        }
      }
    }, (error) => {
      console.error('Error listening to payment timer updates:', error);
    });

    return () => unsubscribe();
  }, [paymentId, paymentStatus, navigation]);

  // Timer countdown - only decrements when timer is active
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          if (paymentStatus !== 'cancelled' && paymentStatus !== 'sold') {
            Alert.alert(
              'Time Up!',
              'Your payment time has expired. The opportunity has been passed to the next buyer.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerActive, paymentStatus, navigation]);

  // Load user addresses on mount
  useEffect(() => {
    if (user?.uid) {
      loadUserAddresses();
    }
  }, [user?.uid]);

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  const handleImagePicker = useCallback(() => {
    Alert.alert(
      'Add Payment Proof',
      'Choose how you want to add payment proof',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [takePhoto, pickImage]);

  const takePhoto = useCallback(async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera permissions to make this work!',
        [{ text: 'OK' }]
      );
        return;
      }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('📸 Image selected successfully:', {
          uri: result.assets[0].uri,
          width: result.assets[0].width,
          height: result.assets[0].height,
          fileSize: result.assets[0].fileSize,
          type: result.assets[0].type
        });
        // Use setTimeout to prevent immediate re-render
        setTimeout(() => {
        setPaymentProof(result.assets[0]);
          setPaymentProofSet(true);
          // Save to AsyncStorage
          savePaymentProof(result.assets[0]);
        }, 0);
      } else {
        console.log('📸 Image selection cancelled or failed');
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to make this work!',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  }, []);

  const pickImage = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('📸 Image selected successfully:', {
          uri: result.assets[0].uri,
          width: result.assets[0].width,
          height: result.assets[0].height,
          fileSize: result.assets[0].fileSize,
          type: result.assets[0].type
        });
        // Use setTimeout to prevent immediate re-render
        setTimeout(() => {
        setPaymentProof(result.assets[0]);
          setPaymentProofSet(true);
          // Save to AsyncStorage
          savePaymentProof(result.assets[0]);
        }, 0);
      } else {
        console.log('📸 Image selection cancelled or failed');
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  }, []);

  const removeImage = useCallback(() => {
    setPaymentProof(null);
    setPaymentProofSet(false);
    // Clear from AsyncStorage
    clearPaymentProof();
  }, []);

  const handleZoomImage = (imageUrl) => {
    setZoomImageUrl(imageUrl);
    setShowZoomModal(true);
  };

  // Notify seller about payment submission
  const notifySellerPaymentSubmitted = async (listingData, buyer, actionType, amount) => {
    try {
      const sellerId = listingData.sellerId || listingData.userId;
      if (!sellerId) {
        console.error('❌ Cannot notify seller: sellerId is missing');
        return;
      }

      const title = `💰 Payment Submitted!`;
      const body = `${buyer.displayName || buyer.email} has submitted payment proof for "${listingData.title || 'your item'}" (${actionType} - ₱${amount}). Please review and confirm the payment.`;
      
      const notificationData = {
        type: 'payment_submitted',
        listingId: listingData.id,
        paymentId: paymentId,
        actionType: actionType,
        amount: amount,
        buyerId: buyer.uid,
        buyerName: buyer.displayName || buyer.email,
        isPaymentNotification: true
      };
      
      // Remove undefined values
      Object.keys(notificationData).forEach(key => {
        if (notificationData[key] === undefined) {
          delete notificationData[key];
        }
      });
      
      await NotificationManager.createNotification(
        sellerId,
        title,
        body,
        notificationData
      );
      
      console.log(`📱 Payment submission notification sent to seller: ${sellerId}`);
      
    } catch (error) {
      console.error('❌ Error notifying seller about payment submission:', error);
    }
  };

  const handleSubmitPayment = async () => {
    
    // Check if payment form is disabled
    if (isPaymentFormDisabled()) {
      Alert.alert(
        'Payment Not Available',
        'This payment is no longer available for submission.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!listingId) {
      Alert.alert('Error', 'Listing ID is missing. Please try again.');
      return;
    }
    
    // Payment proof is now required
    if (!paymentProof) {
      Alert.alert('Error', 'Please upload payment proof');
      return;
    }

    // Validate payment proof image
    if (!paymentProof.uri) {
      Alert.alert('Invalid Payment Proof', 'The selected image is invalid. Please try selecting another image.');
      return;
    }

    console.log('📸 Payment proof validation passed:', {
      hasProof: !!paymentProof,
      uri: paymentProof?.uri,
      type: paymentProof?.type,
      fileSize: paymentProof?.fileSize
    });

    if (!selectedPaymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    if (!referenceNumber.trim()) {
      Alert.alert('Error', 'Please enter reference number');
      return;
    }

    if (!selectedAddress) {
      Alert.alert('Error', 'Please select a delivery address');
      return;
    }

    setSubmitting(true);

    try {
      let paymentProofUrl = null;
      
      // Only upload if payment proof is provided
      if (paymentProof && paymentProof.uri) {
        try {
          console.log('📤 Starting payment proof upload...');
          console.log('📤 Image details:', {
            uri: paymentProof.uri,
            type: paymentProof.type,
            fileSize: paymentProof.fileSize
          });
          
          paymentProofUrl = await uploadImageToCloudinary(paymentProof.uri);
      console.log('✅ Payment proof uploaded successfully:', paymentProofUrl);
        } catch (uploadError) {
          console.error('❌ Cloudinary upload failed:', uploadError);
          
          const shouldContinue = await new Promise((resolve) => {
            Alert.alert(
              'Upload Failed',
              `Failed to upload payment proof image: ${uploadError.message}\n\nWould you like to submit the payment without the image?`,
              [
                { text: 'Cancel', onPress: () => resolve(false) },
                { text: 'Retry Upload', onPress: async () => {
                  try {
                    console.log('🔄 Retrying payment proof upload...');
                    paymentProofUrl = await uploadImageToCloudinary(paymentProof.uri);
                    console.log('✅ Retry successful:', paymentProofUrl);
                    resolve(true);
                  } catch (retryError) {
                    console.error('❌ Retry failed:', retryError);
                    resolve(false);
                  }
                }},
                { text: 'Submit Without Image', onPress: () => resolve(true) }
              ]
            );
          });
          
          if (!shouldContinue) {
            setSubmitting(false);
            return;
          }
          
          paymentProofUrl = null; // Set to null if user chooses to submit without image
        }
      } else {
        console.log('📸 No payment proof provided - submitting without image');
      }

      let paymentRef;
      
      if (existingPayment) {
        const paymentData = {
          paymentMethod: selectedPaymentMethod.bankName,
          paymentMethodDetails: selectedPaymentMethod,
          referenceNumber: referenceNumber.trim(),
          paymentProofUrl,
          notes: notes.trim(),
          deliveryAddress: selectedAddress,
          status: 'submitted',
          submittedAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        };
        
        await updateDoc(doc(db, 'payments', existingPayment.id), paymentData);
        paymentRef = { id: existingPayment.id };
        
        // Get listing data for notification
        const listingRef = doc(db, 'listings', listingId);
        const listingDoc = await getDoc(listingRef);
        const listingData = { id: listingDoc.id, ...listingDoc.data() };
        
        // Notify seller about payment update
        await notifySellerPaymentSubmitted(listingData, user, actionType, displayPrice);
        
      } else {
        // Get listing data to ensure we have sellerId
        const listingRef = doc(db, 'listings', listingId);
        const listingDoc = await getDoc(listingRef);
        if (!listingDoc.exists()) {
          throw new Error('Listing not found');
        }
        const listingData = { id: listingDoc.id, ...listingDoc.data() };
        
        console.log('🔍 DEBUGGING LISTING DATA:');
        console.log('📋 Listing ID:', listingId);
        console.log('📋 Raw listing data:', listingDoc.data());
        console.log('📋 Processed listing data:', listingData);
        console.log('📋 Title field value:', listingData.title);
        console.log('📋 All listing fields:', Object.keys(listingData));
        console.log('📋 Title type:', typeof listingData.title);
        console.log('📋 Title length:', listingData.title ? listingData.title.length : 'undefined');
        console.log('📋 Final listingTitle to be stored:', listingData.title || 'Unknown Item');

        const paymentData = {
          listingId,
          buyerId: user.uid,
          buyerName: user.displayName || user.email,
          sellerId: listingData.sellerId || listingData.userId || '',
          listingTitle: listingData.title || 'Unknown Item',
          listingImage: listingData.images && listingData.images.length > 0 ? listingData.images[0] : null,
          actionType,
          amount: displayPrice,
          paymentMethod: selectedPaymentMethod.bankName,
          paymentMethodDetails: selectedPaymentMethod,
          referenceNumber: referenceNumber.trim(),
          paymentProofUrl,
          notes: notes.trim(),
          deliveryAddress: selectedAddress,
          status: 'submitted',
          submittedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        };

        console.log('💳 Creating payment with data:', {
          listingId,
          buyerId: user.uid,
          sellerId: listingData.sellerId || listingData.userId || '',
          listingData: {
            sellerId: listingData.sellerId,
            userId: listingData.userId,
            sellerName: listingData.sellerName,
            title: listingData.title,
            listingTitle: listingData.listingTitle,
            name: listingData.name,
            itemName: listingData.itemName,
            allFields: Object.keys(listingData)
          }
        });

        paymentRef = await addDoc(collection(db, 'payments'), paymentData);
        
        // Notify seller about payment submission
        await notifySellerPaymentSubmitted(listingData, user, actionType, displayPrice);
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
        details: `Payment proof submitted for ${actionType} action (₱${formatPrice(displayPrice)})`,
        timestamp: serverTimestamp(),
      });

      await PaymentTimeoutService.onPaymentSubmitted(listingId);
      
      setTimerActive(false);

      // Clear saved payment proof after successful submission
      clearPaymentProof();

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
                ₱{formatPrice(displayPrice)}
              </Text>
            </View>
          </View>
        </View>

        {/* Conditional UI based on payment status */}
        {paymentStatus === 'pending_payment' ? (
          /* Payment Form for Pending Payments */
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
                <Image 
                  source={{ uri: paymentProof.uri }} 
                  style={styles.paymentImage}
                />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Ionicons name="close" size={20} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.imagePickerButton,
                  isPaymentFormDisabled() && styles.disabledInput
                ]} 
                onPress={() => {
                  if (!isPaymentFormDisabled()) {
                    handleImagePicker();
                  }
                }}
                disabled={isPaymentFormDisabled()}
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
                isPaymentFormDisabled() && styles.disabledInput
              ]}
              onPress={() => {
                if (!isPaymentFormDisabled()) {
                  setShowPaymentMethodModal(true);
                }
              }}
              disabled={isPaymentFormDisabled()}
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

          {/* Delivery Address Selector */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Delivery Address *
            </Text>
            <TouchableOpacity 
              style={[
                styles.paymentMethodSelector,
                isPaymentFormDisabled() && styles.disabledInput
              ]}
              onPress={() => {
                if (!isPaymentFormDisabled()) {
                  setShowAddressModal(true);
                }
              }}
              disabled={isPaymentFormDisabled()}
            >
              <Text style={[
                styles.paymentMethodText, 
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                !selectedAddress && styles.placeholderText
              ]}>
                {selectedAddress 
                  ? `${selectedAddress.name} - ${selectedAddress.cityName || selectedAddress.city}`
                  : 'Select delivery address'
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
                isPaymentFormDisabled() && styles.disabledInput
              ]}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              editable={!isPaymentFormDisabled()}
              placeholder="Enter transaction reference number"
              placeholderTextColor="#999"
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
                isPaymentFormDisabled() && styles.disabledInput
              ]}
              value={notes}
              onChangeText={setNotes}
              editable={!isPaymentFormDisabled()}
              placeholder="Any additional information about the payment..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
        ) : (
          /* Read-only Status View for Non-Pending Payments */
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              Payment Status
            </Text>
            
            {/* Status Card */}
            <View style={[
              styles.statusCard,
              { 
                backgroundColor: paymentStatus === 'submitted' ? '#E3F2FD' :
                                paymentStatus === 'approved' ? '#E8F5E8' :
                                paymentStatus === 'sold' ? '#E8F5E8' :
                                paymentStatus === 'rejected' ? '#FFEBEE' :
                                paymentStatus === 'cancelled' ? '#F5F5F5' : '#F5F5F5'
              }
            ]}>
              <View style={styles.statusHeader}>
                <Ionicons 
                  name={
                    paymentStatus === 'submitted' ? 'time-outline' :
                    paymentStatus === 'approved' ? 'checkmark-circle' :
                    paymentStatus === 'sold' ? 'trophy' :
                    paymentStatus === 'rejected' ? 'close-circle' :
                    paymentStatus === 'cancelled' ? 'ban' : 'help-circle'
                  } 
                  size={24} 
                  color={
                    paymentStatus === 'submitted' ? '#2196F3' :
                    paymentStatus === 'approved' ? '#4CAF50' :
                    paymentStatus === 'sold' ? '#2E7D32' :
                    paymentStatus === 'rejected' ? '#F44336' :
                    paymentStatus === 'cancelled' ? '#9E9E9E' : '#9E9E9E'
                  } 
                />
                <Text style={[
                  styles.statusTitle, 
                  { 
                    fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined,
                    color: paymentStatus === 'submitted' ? '#2196F3' :
                           paymentStatus === 'approved' ? '#4CAF50' :
                           paymentStatus === 'sold' ? '#2E7D32' :
                           paymentStatus === 'rejected' ? '#F44336' :
                           paymentStatus === 'cancelled' ? '#9E9E9E' : '#9E9E9E'
                  }
                ]}>
                  {paymentStatus === 'submitted' ? 'Payment Submitted' :
                   paymentStatus === 'approved' ? 'Payment Approved' :
                   paymentStatus === 'sold' ? 'Transaction Sold' :
                   paymentStatus === 'rejected' ? 'Payment Rejected' :
                   paymentStatus === 'cancelled' ? 'Payment Cancelled' : 'Unknown Status'}
                </Text>
              </View>
              
              <Text style={[
                styles.statusMessage,
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
              ]}>
                {paymentStatus === 'submitted' ? 'Your payment proof has been submitted and is awaiting seller approval.' :
                 paymentStatus === 'approved' ? 'Your payment has been approved by the seller. You can now proceed with the transaction.' :
                 paymentStatus === 'sold' ? 'Transaction completed successfully! The item has been sold and delivered.' :
                 paymentStatus === 'rejected' ? 'Your payment was rejected by the seller. Please contact them for more information.' :
                 paymentStatus === 'cancelled' ? 'This payment has been cancelled and is no longer valid.' : 'Status unknown.'}
              </Text>
              
              {/* Payment Details */}
              <View style={styles.paymentDetails}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    Amount:
                  </Text>
                  <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                    ₱{formatPrice(displayPrice)}
                  </Text>
                </View>
                
                {existingPayment?.paymentMethod && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      Payment Method:
                    </Text>
                    <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      {existingPayment.paymentMethod}
                    </Text>
                  </View>
                )}
                
                {existingPayment?.referenceNumber && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      Reference Number:
                    </Text>
                    <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      {existingPayment.referenceNumber}
                    </Text>
                  </View>
                )}
                
                {existingPayment?.submittedAt && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      Submitted:
                    </Text>
                    <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      {existingPayment.submittedAt.toDate ? 
                        existingPayment.submittedAt.toDate().toLocaleString() : 
                        new Date(existingPayment.submittedAt).toLocaleString()}
                    </Text>
                  </View>
                )}
                
                {/* Payment Proof Image */}
                {existingPayment?.paymentProofUrl && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      Payment Proof:
                    </Text>
                    <TouchableOpacity 
                      style={styles.proofImageContainer}
                      onPress={() => handleZoomImage(existingPayment.paymentProofUrl)}
                    >
                      <Image 
                        source={{ uri: existingPayment.paymentProofUrl }} 
                        style={styles.proofImage}
                        resizeMode="contain"
                      />
                      <View style={styles.zoomOverlay}>
                        <Ionicons name="expand" size={24} color="white" />
                        <Text style={styles.zoomText}>Tap to zoom</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Submit Button Container with Timer - Only show for pending payments */}
      {paymentStatus === 'pending_payment' && (
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
            (submitting || isPaymentFormDisabled()) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmitPayment}
          disabled={submitting || isPaymentFormDisabled()}
        >
          <Text style={[styles.submitButtonText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            {isPaymentFormDisabled()
              ? 'Payment Not Available' 
              : submitting 
                ? 'Submitting...' 
                : 'Submit Payment Proof'
            }
          </Text>
        </TouchableOpacity>
      </View>
      )}

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

      {/* Address Selection Modal */}
      <Modal
        visible={showAddressModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Text style={[styles.modalCancelText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Select Delivery Address
              </Text>
              <View style={styles.modalSpacer} />
            </View>
            
            <ScrollView style={styles.paymentMethodsList}>
              {loadingAddresses ? (
                <View style={styles.noPaymentMethods}>
                  <Text style={[styles.noPaymentMethodsText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    Loading addresses...
                  </Text>
                </View>
              ) : userAddresses.length > 0 ? (
                userAddresses.map((address, index) => (
                  <TouchableOpacity
                    key={address.id || index}
                    style={[
                      styles.paymentMethodItem,
                      selectedAddress?.id === address.id && styles.selectedPaymentMethod
                    ]}
                    onPress={() => {
                      setSelectedAddress(address);
                      setShowAddressModal(false);
                    }}
                  >
                    <View style={styles.paymentMethodInfo}>
                      <Text style={[styles.paymentMethodName, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                        {address.name}
                        {address.isDefault && (
                          <Text style={[styles.defaultBadge, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                            {' '}(Default)
                          </Text>
                        )}
                      </Text>
                      <Text style={[styles.paymentMethodAccount, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {address.phone}
                      </Text>
                      <Text style={[styles.paymentMethodAccountName, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {address.address}, {address.barangayName || address.barangay}, {address.cityName || address.city}, {address.provinceName || address.province}
                      </Text>
                    </View>
                    {selectedAddress?.id === address.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#83AFA7" />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noPaymentMethods}>
                  <Text style={[styles.noPaymentMethodsText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    No addresses found. Please add an address first.
                  </Text>
                </View>
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
  statusCard: {
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    marginLeft: 12,
    fontWeight: '600',
  },
  statusMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    color: '#666',
  },
  paymentDetails: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
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
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#83AFA7',
  },
  modalTitle: {
    fontSize: 16,
    color: '#333',
  },
  modalSpacer: {
    width: 60,
  },
  paymentMethodsList: {
    maxHeight: 300,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 14,
    color: '#333',
    marginBottom: 3,
  },
  paymentMethodAccount: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  paymentMethodAccountName: {
    fontSize: 11,
    color: '#999',
  },
  noPaymentMethods: {
    padding: 30,
    alignItems: 'center',
  },
  noPaymentMethodsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  defaultBadge: {
    color: '#83AFA7',
    fontSize: 10,
  },
  proofImageContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  proofImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
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
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  zoomScrollView: {
    flex: 1,
  },
  zoomImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

export default PaymentScreen;