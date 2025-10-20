import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
  Alert,
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import CustomPopup from '../components/CustomPopup';
import StandardModal from '../components/StandardModal';
import NotificationManager from '../services/NotificationManager';
import ExpirationNotificationService from '../services/ExpirationNotificationService';
import PaymentTimeoutService from '../services/PaymentTimeoutService';
import RealTimeActionListener from '../services/RealTimeActionListener';
import ChatService from '../services/ChatService';
import StreamingService from '../services/StreamingService';
import { PanGestureHandler, GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { db } from '../config/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs, getDoc, serverTimestamp, increment } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const ListingDetailsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const { listing: initialListing } = route.params || {};
  const [listing, setListing] = useState(initialListing);
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 ListingDetailsScreen - Initial listing:', initialListing);
    console.log('🔍 ListingDetailsScreen - Route params:', route.params);
  }, [initialListing, route.params]);
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState('');
  const [showBidModal, setShowBidModal] = useState(false);
  const [activeButton, setActiveButton] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successTitle, setSuccessTitle] = useState('');
  const [successAction, setSuccessAction] = useState(null);
  const [instructionsOpacity] = useState(new Animated.Value(0));

  // Helper function to show error modal
  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  // Helper function to show success modal
  const showSuccess = (title, message, action = null) => {
    setSuccessTitle(title);
    setSuccessMessage(message);
    setSuccessAction(action);
    setShowSuccessModal(true);
  };
  const [imageTranslateX] = useState(new Animated.Value(0));
  const [imageOpacity] = useState(new Animated.Value(1));
  const [lockFloatAnim] = useState(new Animated.Value(0));
  const [activityLogs, setActivityLogs] = useState([]);
  const [bids, setBids] = useState([]);
  const [currentBid, setCurrentBid] = useState(null);
  const [realtimeLocked, setRealtimeLocked] = useState(false);

  // Interpolate the floating animation for lock button
  const lockFloatingStyle = {
    transform: [
      {
        translateY: lockFloatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -12], // Move up by 12 pixels
        }),
      },
    ],
  };
  const [actionSuccess, setActionSuccess] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userActions, setUserActions] = useState([]); // Track user's actions on this listing
  const [isExpired, setIsExpired] = useState(false); // Track if listing has expired
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 }); // Countdown timer
  const [showActionHistory, setShowActionHistory] = useState(false); // Show Action History modal
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false); // Drawer expanded state
  const [drawerHeight] = useState(new Animated.Value(60)); // Drawer height animation
  const [timerPulseAnim] = useState(new Animated.Value(1)); // Timer pulsing animation
  const [popup, setPopup] = useState({
    visible: false,
    type: '',
    title: '',
    subtitle: '',
    showButton: false,
    buttonText: '',
    onPress: null,
  });

  // Seller data state
  const [sellerData, setSellerData] = useState(null);
  const [sellerAddress, setSellerAddress] = useState(null);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [liveStream, setLiveStream] = useState(null);

  // Show instructions with smooth fade-in, then hide after 2.5 seconds with smooth fade-out
  useEffect(() => {
    // Fade in immediately
    Animated.timing(instructionsOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Fade out after 2.5 seconds
    const timer = setTimeout(() => {
      Animated.timing(instructionsOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setShowInstructions(false);
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []); // Remove instructionsOpacity dependency to prevent re-running on every render

  // Lock button floating animation
  useEffect(() => {
    const startFloating = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(lockFloatAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(lockFloatAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startFloating();
  }, []); // Remove lockFloatAnim dependency to prevent re-running on every render

  // Initialize real-time action listener
  useEffect(() => {
    const initializeServices = async () => {
      RealTimeActionListener.setCurrentUser(user?.uid);
    };

    initializeServices();
  }, [user?.uid]);

  // Add listing to action listener when component mounts
  useEffect(() => {
    if (listing?.id && user?.uid) {
      RealTimeActionListener.addListingInterest(listing.id);
      // Track listing view
      trackListingView(listing.id, user.uid);
    }

    // Cleanup when component unmounts
    return () => {
      if (listing?.id) {
        RealTimeActionListener.removeListingInterest(listing.id);
      }
    };
  }, [listing?.id, user?.uid]);

  // Check for live streams
  const checkLiveStream = async () => {
    try {
      if (listing?.id) {
        const streams = await StreamingService.getActiveStreams(listing.id);
        if (streams.length > 0) {
          setIsLiveStreaming(true);
          setLiveStream(streams[0]);
        } else {
          setIsLiveStreaming(false);
          setLiveStream(null);
        }
      }
    } catch (error) {
      console.error('Error checking live stream:', error);
    }
  };

  // Load seller data and address
  const loadSellerData = async () => {
    if (!listing?.sellerId) return;
    
    try {
      console.log('👤 Loading seller data for:', listing.sellerId);
      
      // Get seller profile data
      const sellerDoc = await getDoc(doc(db, 'users', listing.sellerId));
      if (sellerDoc.exists()) {
        setSellerData(sellerDoc.data());
        console.log('👤 Seller data loaded:', sellerDoc.data());
      }
      
      // Get seller's default address
      const addressesQuery = query(
        collection(db, 'addresses'),
        where('userId', '==', listing.sellerId),
        where('isDefault', '==', true)
      );
      const addressesSnapshot = await getDocs(addressesQuery);
      
      if (!addressesSnapshot.empty) {
        const defaultAddress = addressesSnapshot.docs[0].data();
        setSellerAddress(defaultAddress);
        console.log('🏠 Seller default address loaded:', defaultAddress);
      } else {
        // Fallback to first address if no default
        const allAddressesQuery = query(
          collection(db, 'addresses'),
          where('userId', '==', listing.sellerId)
        );
        const allAddressesSnapshot = await getDocs(allAddressesQuery);
        
        if (!allAddressesSnapshot.empty) {
          const firstAddress = allAddressesSnapshot.docs[0].data();
          setSellerAddress(firstAddress);
          console.log('🏠 Seller first address loaded:', firstAddress);
        }
      }
    } catch (error) {
      console.error('❌ Error loading seller data:', error);
    }
  };

  // Load seller data when listing changes
  useEffect(() => {
    if (listing?.sellerId) {
      loadSellerData();
    }
    if (listing?.id) {
      checkLiveStream();
    }
  }, [listing?.sellerId, listing?.id]);

  // Load activity logs from Firebase
  useEffect(() => {
    if (!listing?.id) return;

    const q = query(
      collection(db, 'activityLogs'),
      where('listingId', '==', listing.id)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const logs = [];
      querySnapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
        });
      });
      // Sort by timestamp in descending order locally
      logs.sort((a, b) => b.timestamp - a.timestamp);
      setActivityLogs(logs);
    });

    return () => unsubscribe();
  }, [initialListing?.id]);

  // Load user's actions on this listing
  useEffect(() => {
    if (!listing?.id || !user?.uid) return;

    const q = query(
      collection(db, 'activityLogs'),
      where('listingId', '==', listing.id),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userLogs = [];
      querySnapshot.forEach((doc) => {
        userLogs.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
        });
      });
      // Sort by timestamp in descending order locally
      userLogs.sort((a, b) => b.timestamp - a.timestamp);
      setUserActions(userLogs);
    });

    return () => unsubscribe();
  }, [initialListing?.id, user?.uid]);

  // Real-time listener for listing status changes (especially when locked)
  useEffect(() => {
    if (!initialListing?.id) return;

    const listingRef = doc(db, 'listings', initialListing.id);
    const unsubscribe = onSnapshot(listingRef, (doc) => {
      if (doc.exists()) {
        const updatedListing = { id: doc.id, ...doc.data() };
        
        // Use setTimeout to defer state updates to next tick
        setTimeout(() => {
        // Update the listing state to reflect real-time changes
        setListing(updatedListing);
        
        // If listing is locked, show immediate feedback
        if (updatedListing.status === 'locked') {
          setRealtimeLocked(true);
          
            // Defer alert to next tick
            setTimeout(() => {
          Alert.alert(
            '🔒 Item Locked!',
            'This item has been locked by another user and is no longer available.',
            [{ text: 'OK' }]
          );
            }, 100);
          
          // Auto-hide the real-time lock notification after 3 seconds
          setTimeout(() => setRealtimeLocked(false), 3000);
        }
        }, 0);
      } else {
        }
    }, (error) => {
      console.error('❌ Error listening to listing updates:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [initialListing?.id]);

  // Load bids for this listing
  useEffect(() => {
    if (!listing?.id) return;

    const q = query(
      collection(db, 'bids'),
      where('listingId', '==', listing.id)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const bidsList = [];
      querySnapshot.forEach((doc) => {
        bidsList.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
        });
      });
      
      // Sort by amount in descending order locally
      bidsList.sort((a, b) => b.amount - a.amount);
      setBids(bidsList);
      
      // Set current bid (highest bid)
      if (bidsList.length > 0) {
        setCurrentBid(bidsList[0]);
      } else {
        setCurrentBid(null);
      }
    });

    return () => unsubscribe();
  }, [initialListing?.id]);

  // Check if listing has expired and update countdown in real-time
  useEffect(() => {
    if (!listing?.endDateTime) return;

    const updateTimer = () => {
      const now = new Date();
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
        setTimeout(() => {
        setIsExpired(true);
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }, 0);
        return;
      }

      const timeDiff = endTime - now;

      if (timeDiff <= 0) {
        // Listing has expired
        setTimeout(() => {
        setIsExpired(true);
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }, 0);
      } else {
        // Calculate time remaining
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        setTimeout(() => {
        setIsExpired(false);
        setTimeRemaining({ days, hours, minutes, seconds });
        }, 0);
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [listing?.endDateTime]);

  // Timer pulsing animation for critical periods
  useEffect(() => {
    const startPulsing = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(timerPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    const stopPulsing = () => {
      timerPulseAnim.stopAnimation();
      Animated.timing(timerPulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    };

    if (timerUrgency === 'critical') {
      startPulsing();
    } else {
      stopPulsing();
    }

    return () => stopPulsing();
  }, [timerUrgency]); // Remove timerPulseAnim dependency to prevent re-running on every render

  // Validation functions
  const validateMSLAction = (actionType, price) => {
    // 1. User Authentication
    if (!user || !user.uid) {
      return {
        isValid: false,
        message: 'Please log in to perform this action'
      };
    }

    // 2. Self-listing Check - Prevent users from acting on their own listings
    if (listing && listing.userId && user.uid === listing.userId) {
      return {
        isValid: false,
        message: 'You cannot perform actions on your own listing'
      };
    }

    // 3. Listing Status - Check if listing is active
    if (!listing || !listing.id) {
      return {
        isValid: false,
        message: 'Listing not found or inactive'
      };
    }

    // 4. Check if listing is locked/closed
    if (listing.status === 'locked') {
      return {
        isValid: false,
        message: 'This listing has been locked and is no longer available'
      };
    }

    // 3. Time Validation - Check if listing is still within valid time period
    if (isExpired) {
      return {
        isValid: false,
        message: 'This listing has expired'
      };
    }

    // 4. Already Performed - Check if user already performed this action
    const hasPerformedAction = userActions.some(action => {
      const actionTypeMap = {
        'Mined': 'mine',
        'Stole': 'steal', 
        'Locked': 'lock'
      };
      const mappedAction = actionTypeMap[action.action] || action.action.toLowerCase();
      return mappedAction === actionType;
    });
    
    if (hasPerformedAction) {
      return {
        isValid: false,
        message: `You have already performed ${actionType} action on this listing`
      };
    }

    // 5. Prevent lower actions - Check if this action is lower than previous actions
    const actionHierarchy = { 'mine': 1, 'steal': 2, 'lock': 3 };
    const currentActionLevel = actionHierarchy[actionType];
    
    const hasHigherAction = userActions.some(action => {
      const actionTypeMap = {
        'Mined': 'mine',
        'Stole': 'steal', 
        'Locked': 'lock'
      };
      const mappedAction = actionTypeMap[action.action] || action.action.toLowerCase();
      const actionLevel = actionHierarchy[mappedAction];
      return actionLevel > currentActionLevel;
    });

    if (hasHigherAction) {
      return {
        isValid: false,
        message: `You cannot perform ${actionType} after performing a higher action`
      };
    }

    return {
      isValid: true,
      message: 'Action is valid'
    };
  };

  // Check if an action is disabled
  const isActionDisabled = (actionType) => {
    // First check if expired (fastest check)
    if (isExpired) return true;
    
    const validation = validateMSLAction(actionType, 0);
    return !validation.isValid;
  };

  const isBidDisabled = () => {
    // Check if user is trying to bid on their own listing
    if (listing && listing.userId && user && user.uid === listing.userId) {
      return true;
    }
    
    // Check if expired
    if (isExpired) return true;
    
    // Check if listing is locked/closed
    if (listing && listing.status === 'locked') {
      return true;
    }
    
    // Check if user is not logged in
    if (!user || !user.uid) {
      return true;
    }
    
    return false;
  };

  // Toggle drawer expansion
  const toggleDrawer = () => {
    const newExpandedState = !isDrawerExpanded;
    setIsDrawerExpanded(newExpandedState);
    
    Animated.timing(drawerHeight, {
      toValue: newExpandedState ? 300 : 60, // Expand to 300px, collapse to 60px
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  const showPopup = (type, title, subtitle, showButton = false, buttonText = '', onPress = null) => {
    setPopup({
      visible: true,
      type,
      title,
      subtitle,
      showButton,
      buttonText,
      onPress,
    });
  };

  const hidePopup = () => {
    setPopup(prev => ({ ...prev, visible: false }));
  };

  const onSwipeGesture = (event, buttonType) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
      
      // Determine swipe direction based on translation and velocity
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);
      const absVelX = Math.abs(velocityX);
      const absVelY = Math.abs(velocityY);
      
      // Minimum swipe distance and velocity thresholds
      const minDistance = 30;
      const minVelocity = 300;
      
      if (absX > absY && absX > minDistance && absVelX > minVelocity) {
        // Horizontal swipe
        if (translationX > 0) {
          // Swipe right
          setSwipeDirection('right');
          if (buttonType === 'mine') {
            handleMine();
          }
        } else {
          // Swipe left
          setSwipeDirection('left');
          if (buttonType === 'steal') {
            handleSteal();
          }
        }
      } else if (absY > absX && absY > minDistance && absVelY > minVelocity) {
        // Vertical swipe
        if (translationY < 0) {
          // Swipe up
          setSwipeDirection('up');
          if (buttonType === 'lock') {
            handleLock();
          }
        }
      }
      
      // Reset swipe direction after a short delay
      setTimeout(() => setSwipeDirection(null), 1000);
    }
  };

  const handleMine = async () => {
    const price = listing.minePrice || listing.price;
    
    // Validate price is defined
    if (!price || isNaN(price)) {
      console.error('❌ Invalid price for mine action:', price);
      showError('Invalid price for mine action. Please try again.');
      return;
    }
    
    const validation = validateMSLAction('mine', price);
    
    if (!validation.isValid) {
      showError(validation.message);
      return;
    }

    setTimeout(() => {
    setActiveButton('mine');
    }, 0);
    await addActivityLog('Mined', price, user);
    
    // Send notifications via NotificationManager (includes push notifications)
    await NotificationManager.createNotification(
      listing.sellerId,
      '⛏️ Item Mined!',
      `${user.displayName || user.email} mined "${listing.title}" for ₱${price}`,
      {
        type: 'action_performed',
        listingId: listing.id,
        actionType: 'Mined',
        performerId: user.uid,
        performerName: user.displayName || user.email,
        price: price
      }
    );
    // Create chat with seller
    console.log('🔄 Creating chat from Mine action for users:', user.uid, listing.sellerId || listing.userId);
    await ChatService.createChatFromAction(listing.id, 'mine', user.uid, user.displayName || user.email, listing);
    
    setTimeout(() => {
    setActionSuccess('Mined');
    setTimeout(() => setActionSuccess(null), 2000);
    }, 0);
    
    // Show success modal
    setTimeout(() => {
      showSuccess(
        '🎉 Mined!',
        `You successfully mined this item for ₱${price}!`,
        () => {
          setTimeout(() => {
            setShowSuccessModal(false);
            setActiveButton(null);
            setActionSuccess('Mine');
            setTimeout(() => setActionSuccess(null), 2000);
          }, 0);
        }
      );
    }, 0);
  };

  const handleSteal = async () => {
    const price = listing.stealPrice;
    
    // Validate price is defined
    if (!price || isNaN(price)) {
      console.error('❌ Invalid price for steal action:', price);
      showError('Invalid price for steal action. Please try again.');
      return;
    }
    
    const validation = validateMSLAction('steal', price);
    
    if (!validation.isValid) {
      showError(validation.message);
      return;
    }

    setTimeout(() => {
    setActiveButton('steal');
    }, 0);
    await addActivityLog('Stole', price, user);
    
    // Send notifications via NotificationManager (includes push notifications)
    await NotificationManager.createNotification(
      listing.sellerId,
      '⚡ Item Stolen!',
      `${user.displayName || user.email} stole "${listing.title}" for ₱${price}`,
      {
        type: 'action_performed',
        listingId: listing.id,
        actionType: 'Stole',
        performerId: user.uid,
        performerName: user.displayName || user.email,
        price: price
      }
    );
    
    // Create chat with seller
    console.log('🔄 Creating chat from Steal action for users:', user.uid, listing.sellerId || listing.userId);
    await ChatService.createChatFromAction(listing.id, 'steal', user.uid, user.displayName || user.email, listing);
    
    setTimeout(() => {
    setActionSuccess('Stole');
    setTimeout(() => setActionSuccess(null), 2000);
    }, 0);
    
    // Show success modal
    setTimeout(() => {
      showSuccess(
        '⚡ Stole!',
        `You successfully stole this item for ₱${price}!`,
        () => {
          setTimeout(() => {
            setShowSuccessModal(false);
            setActiveButton(null);
            setActionSuccess('Steal');
            setTimeout(() => setActionSuccess(null), 2000);
          }, 0);
        }
      );
    }, 0);
  };


  // Trigger payment flow for expired listings (NOT for lock actions)
  const triggerPaymentFlow = async (listingId, actionType, price, user) => {
    try {
      // Triggering payment flow for expired listing
      
      // Create payment notification for the user who locked
      const title = `🎉 You Won! Payment Required`;
      const body = `Congratulations! You locked "${listing.title}" and won the item. Please submit your payment proof to complete the purchase.`;
      
      await NotificationManager.createNotification(
        user.uid,
        title,
        body,
        {
          type: 'payment_required',
          listingId: listingId,
          actionType: actionType,
          amount: price,
          sellerId: listing.sellerId,
        }
      );
      
      // Notify seller about the winner
      const sellerTitle = `🏆 Winner Determined!`;
      const sellerBody = `Your listing "${listing.title}" has been locked. ${user.displayName || user.email} won with Lock action. They will submit payment proof soon.`;
      
      await NotificationManager.createNotification(
        listing.sellerId,
        sellerTitle,
        sellerBody,
        {
          type: 'winner_determined',
          listingId: listingId,
          winnerId: user.uid,
          winnerName: user.displayName || user.email,
          actionType: actionType,
        }
      );
      
      // Create activity log
      await addDoc(collection(db, 'activityLogs'), {
        listingId: listingId,
        userId: user.uid,
        userName: user.displayName || user.email,
        action: 'Lock Action - Payment Required',
        details: `Listing locked. ${user.displayName || user.email} won with Lock action and needs to submit payment.`,
        timestamp: serverTimestamp(),
        systemGenerated: true,
      });
      
      // Note: Payment record will be created when user submits payment in PaymentScreen
      // No need to create payment record here for Lock actions
      
      // Payment flow triggered successfully
    } catch (error) {
      console.error('❌ Error triggering payment flow:', error);
    }
  };

  const handleMessageSeller = async () => {
    try {
      console.log('🔄 Navigating to chat screen for users:', user.uid, listing.sellerId);
      console.log('🔄 Seller data:', {
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        sellerData: sellerData
      });
      
      // Get the correct display price based on listing type
      const displayPrice = ChatService.getDisplayPrice(listing);
      
      // Navigate to chat screen without creating chat yet
      // Chat will be created when user sends their first message
      navigation.navigate('Chat', {
        chatId: null, // No chat ID yet - will be created on first message
        otherUser: {
          id: listing.sellerId, // Use sellerId directly
          name: listing.sellerName || sellerData?.displayName || 'Seller',
          avatar: sellerData?.avatar || listing.sellerAvatar,
        },
        listing: {
          id: listing.id,
          title: listing.title || listing.listingTitle,
          price: displayPrice,
          image: listing.images?.[0] || listing.image,
        }
      });
    } catch (error) {
      console.error('❌ Error navigating to chat:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const handleLock = async () => {
    console.log('🔒 handleLock called - START');
    const price = listing.lockPrice;
    
    // Validate price is defined
    if (!price || isNaN(price)) {
      console.error('❌ Invalid price for lock action:', price);
      showError('Invalid price for lock action. Please try again.');
      return;
    }
    
    const validation = validateMSLAction('lock', price);
    
    if (!validation.isValid) {
      showError(validation.message);
      return;
    }

    setTimeout(() => {
    setActiveButton('lock');
    }, 0);
    
    try {
      // Update listing status to 'locked' to close it
      await updateDoc(doc(db, 'listings', listing.id), {
        status: 'locked',
        lockedBy: user.uid,
        lockedAt: serverTimestamp(),
        lockedPrice: price
      });
      
      // Listing locked and closed
      
      await addActivityLog('Locked', price, user);
      
      // Send notifications via NotificationManager (includes push notifications)
      // Note: Notifications are sent in triggerPaymentFlow function

      // Create chat with seller
      console.log('🔄 Creating chat from Lock action for users:', user.uid, listing.sellerId || listing.userId);
      await ChatService.createChatFromAction(listing.id, 'lock', user.uid, user.displayName || user.email, listing);

      // Send payment notification immediately for lock action (no need for triggerPaymentFlow)
      setTimeout(async () => {
        console.log('🔔 Sending lock notification to user:', user.uid);
        await NotificationManager.createNotification(
          user.uid,
          '🎉 You Won! Payment Required',
          `Congratulations! You locked "${listing.title}" and won the item. Please submit your payment proof to complete the purchase.`,
          {
            type: 'payment_required',
            listingId: listing.id,
            actionType: 'Locked',
            amount: price,
            sellerId: listing.sellerId,
          }
        );
        console.log('🔔 Lock notification sent to user:', user.uid);
        
        // Notify seller about the winner
        await NotificationManager.createNotification(
          listing.sellerId,
          '🏆 Winner Determined!',
          `Your listing "${listing.title}" has been locked. ${user.displayName || user.email} won with Lock action. They will submit payment proof soon.`,
          {
            type: 'winner_determined',
            listingId: listing.id,
            winnerId: user.uid,
            winnerName: user.displayName || user.email,
            actionType: 'Locked',
          }
        );
      }, 0);
      
      setTimeout(() => {
      setActionSuccess('Locked');
      setTimeout(() => setActionSuccess(null), 2000);
      }, 0);
      
      // Show success modal with payment option
      setTimeout(() => {
        showSuccess(
          '🔒 Locked!',
          `You successfully locked this item for ₱${price}! The listing is now closed. You can now submit your payment proof.`,
          () => {
            setTimeout(() => {
              setShowSuccessModal(false);
          // Navigate to payment screen
          navigation.navigate('Payment', {
            listingId: listing.id,
            actionType: 'Locked',
            price: price,
          });
            }, 0);
          }
        );
      }, 0);
    } catch (error) {
      console.error('❌ Error locking listing:', error);
      showError('Failed to lock the listing. Please try again.');
    }
  };

  const handleBid = async () => {
    setTimeout(() => {
    setActiveButton('bid');
    setShowBidModal(true);
    }, 0);
  };

  const submitBid = async () => {
    // Validate listing data
    if (!listing || !listing.id) {
      showPopup('error', 'Invalid Listing', 'Listing data is missing');
      return;
    }

    // Check if user is trying to bid on their own listing
    if (listing && listing.userId && user && user.uid === listing.userId) {
      showPopup('error', 'Cannot Bid', 'You cannot bid on your own listing');
      return;
    }

    if (!bidAmount || isNaN(bidAmount) || parseFloat(bidAmount) <= 0) {
      showPopup('error', 'Invalid Bid', 'Please enter a valid bid amount');
      return;
    }

    const bid = parseFloat(bidAmount);
    
    // Validate bid amount is defined and valid
    if (!bidAmount || isNaN(bid) || bid <= 0) {
      console.error('❌ Invalid bid amount:', bidAmount);
      showPopup('error', 'Invalid Bid', 'Please enter a valid bid amount');
      return;
    }
    
    const currentPrice = currentBid?.amount || listing.startingPrice;
    const minimumIncrement = listing.minimumBidIncrement || 1;
    
    if (bid <= currentPrice) {
      showPopup('error', 'Bid Too Low', `Your bid must be higher than ₱${currentPrice}`);
      return;
    }

    if (bid < currentPrice + minimumIncrement) {
      showPopup('error', 'Bid Too Low', `Your bid must be at least ₱${currentPrice + minimumIncrement} (minimum increment: ₱${minimumIncrement})`);
      return;
    }

    // Check if expired
    if (isExpired) {
      showPopup('error', 'Auction Expired', 'This auction has ended');
      return;
    }

    // Check if listing is locked/closed
    if (listing.status === 'locked') {
      showPopup('error', 'Listing Locked', 'This listing has been locked and is no longer available');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Create bid document
      const bidData = {
        listingId: listing.id,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email,
        amount: bid,
        timestamp: serverTimestamp(),
        status: 'active'
      };

      // Save bid to Firebase
      const bidRef = await addDoc(collection(db, 'bids'), bidData);
      // Update listing with new current bid
      const listingRef = doc(db, 'listings', listing.id);
      const updateData = {
        currentBid: bid,
        currentBidder: user.uid,
        currentBidderName: user.displayName || user.email,
        lastBidTime: serverTimestamp(),
        bidCount: (listing.bidCount || 0) + 1
      };
      await updateDoc(listingRef, updateData);
      // Add activity log
      await addActivityLog('Bid', bid, user);
      // Send notifications via NotificationManager (includes push notifications)
      await NotificationManager.createNotification(
        listing.sellerId,
        '💰 New Bid Placed!',
        `${user.displayName || user.email} placed a bid of ₱${bid} on "${listing.title}"`,
        {
          type: 'new_bid',
          listingId: listing.id,
          bidderId: user.uid,
          bidderName: user.displayName || user.email,
          bidAmount: bid
        }
      );
      
      // Create chat with seller
      console.log('🔄 Creating chat from Bid action for users:', user.uid, listing.sellerId || listing.userId);
      await ChatService.createChatFromAction(listing.id, 'bid', user.uid, user.displayName || user.email, listing);
      
      // Show success
      setTimeout(() => {
        showSuccess(
        'Bid Submitted!',
        `Your bid of ₱${bid} has been placed successfully`,
        () => {
            setTimeout(() => {
              setShowSuccessModal(false);
          setShowBidModal(false);
          setBidAmount('');
          setActiveButton(null);
          setActionSuccess('Bid');
          setTimeout(() => setActionSuccess(null), 2000);
            }, 0);
        }
      );
      }, 0);

    } catch (error) {
      console.error('Error submitting bid:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      showPopup('error', 'Bid Failed', `Error: ${error.message}. Please try again.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const changeImage = (direction) => {
    if (!listing.images || listing.images.length <= 1) return;
    
    const newIndex = direction === 'next' 
      ? Math.min(currentImageIndex + 1, listing.images.length - 1)
      : Math.max(currentImageIndex - 1, 0);
    
    if (newIndex === currentImageIndex) return;
    
    // Animate out current image
    Animated.parallel([
      Animated.timing(imageTranslateX, {
        toValue: direction === 'next' ? -300 : 300,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(imageOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Change image
      setCurrentImageIndex(newIndex);
      
      // Reset position and animate in
      imageTranslateX.setValue(direction === 'next' ? 300 : -300);
      imageOpacity.setValue(0);
      
      Animated.parallel([
        Animated.timing(imageTranslateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    });
  };

  const addActivityLog = async (action, price, userObj = null) => {
    try {
      const userName = userObj?.displayName || userObj?.email || 'Anonymous User';
      const userId = userObj?.uid || 'anonymous';
      
      // Validate price is defined and valid
      if (!price || isNaN(price)) {
        console.error('❌ Invalid price for activity log:', { action, price, userName });
        throw new Error(`Invalid price for ${action} action: ${price}`);
      }
      
      const newLog = {
        listingId: listing.id,
        action,
        price: parseFloat(price), // Ensure it's a number
        userName: userName,
        userId,
        details: `${action} for ₱${price}`,
        timestamp: new Date(),
      };
      
      // Save to Firebase
      await addDoc(collection(db, 'activityLogs'), newLog);
      } catch (error) {
      console.error('Error saving activity log:', error);
      // Don't throw error, just log it - activity log is not critical for bid functionality
    }
  };

  // Track listing view
  const trackListingView = async (listingId, userId) => {
    try {
      // Check if user has already viewed this listing recently (within last hour)
      const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
      const existingViewQuery = query(
        collection(db, 'listingViews'),
        where('listingId', '==', listingId),
        where('userId', '==', userId)
      );
      
      const existingViewSnapshot = await getDocs(existingViewQuery);
      
      // Check if there's a recent view
      const recentView = existingViewSnapshot.docs.find(doc => {
        const data = doc.data();
        const viewTime = data.viewedAt?.toDate?.() || new Date(data.viewedAt);
        return viewTime >= oneHourAgo;
      });
      
      if (recentView) {
        console.log(`👀 User ${userId} already viewed listing ${listingId} recently`);
        return;
      }
      
      // Create new view record
      const viewData = {
        listingId,
        userId,
        viewedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'listingViews'), viewData);
      console.log(`👀 Tracked view for user ${userId} on listing ${listingId}`);
      
      // Update listing view count
      const listingRef = doc(db, 'listings', listingId);
      await updateDoc(listingRef, {
        views: increment(1),
        lastViewedAt: serverTimestamp()
      });
      
    } catch (error) {
      console.error('❌ Error tracking listing view:', error);
      // Don't throw error, just log it - view tracking is not critical
    }
  };

  const isMSL = listing?.priceType === 'msl';
  const isBidding = listing?.priceType === 'bidding';
  const isOwnListing = listing && listing.userId && user && user.uid === listing.userId;
  
  // Get timer urgency level - memoized to prevent render issues
  const timerUrgency = useMemo(() => {
    if (isExpired) return 'expired';
    
    const { days, hours, minutes, seconds } = timeRemaining;
    const totalMinutes = (days * 24 * 60) + (hours * 60) + minutes;
    
    if (totalMinutes <= 5) return 'critical'; // Last 5 minutes
    if (totalMinutes <= 30) return 'warning'; // Last 30 minutes
    if (totalMinutes <= 60) return 'caution'; // Last hour
    return 'safe'; // More than 1 hour
  }, [isExpired, timeRemaining]);

  // Get timer display text - memoized to prevent render issues
  const timerDisplayText = useMemo(() => {
    if (isExpired) {
      return 'EXPIRED';
    }
    
    // Show countdown timer
    const { days, hours, minutes, seconds } = timeRemaining;
    
    // Check for NaN values
    if (isNaN(days) || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return 'Invalid Date';
    }
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, [isExpired, timeRemaining]);

  // Early return if listing is null or invalid
  if (!listing || !listing.id) {
  return (
      <View style={[styles.container, { paddingTop: topPadding, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: 'Poppins-Regular', color: '#666', textAlign: 'center' }}>
          Listing not found or invalid data
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 20, padding: 10, backgroundColor: '#83AFA7', borderRadius: 8 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: 'white', fontFamily: 'Poppins-Medium' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overlay Header */}
        <View style={styles.overlayHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Animated.View style={[
              styles.headerTimer,
              timerUrgency === 'critical' && styles.timerCritical,
              timerUrgency === 'warning' && styles.timerWarning,
              timerUrgency === 'caution' && styles.timerCaution,
              timerUrgency === 'expired' && styles.timerExpired,
              timerUrgency === 'critical' && {
                transform: [{ scale: timerPulseAnim }]
              }
            ]}>
              <View style={[
                styles.timerIconContainer,
                timerUrgency === 'critical' && styles.timerIconCritical,
                timerUrgency === 'warning' && styles.timerIconWarning,
                timerUrgency === 'caution' && styles.timerIconCaution,
                timerUrgency === 'expired' && styles.timerIconExpired
              ]}>
                <Ionicons 
                  name={isExpired ? "time" : "time-outline"} 
                  size={14} 
                  color="#FFFFFF"
                />
              </View>
              <Text style={[
                styles.headerTimerText,
                { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                timerUrgency === 'critical' && styles.timerTextCritical,
                timerUrgency === 'warning' && styles.timerTextWarning,
                timerUrgency === 'caution' && styles.timerTextCaution,
                timerUrgency === 'expired' && styles.timerTextExpired
              ]}>
                {timerDisplayText}
              </Text>
            </Animated.View>
          </View>
          {!isOwnListing && (
            <TouchableOpacity style={styles.messageButton} onPress={handleMessageSeller}>
              <Ionicons name="chatbubble-outline" size={24} color="white" />
          </TouchableOpacity>
          )}
        </View>

        {/* Image Carousel */}
        <View style={styles.imageContainer}>
          <PanGestureHandler
            onHandlerStateChange={(event) => {
              if (event.nativeEvent.state === State.END) {
                const { translationX, velocityX } = event.nativeEvent;
                
                // Swipe left (next image)
                if (translationX < -50 || velocityX < -500) {
                  changeImage('next');
                }
                // Swipe right (previous image)
                else if (translationX > 50 || velocityX > 500) {
                  changeImage('prev');
                }
              }
            }}
          >
            <Animated.View 
              style={[
                styles.imageWrapper,
                {
                  transform: [{ translateX: imageTranslateX }],
                  opacity: imageOpacity,
                }
              ]}
            >
              {listing.images && listing.images.length > 0 ? (
                <Image 
                  source={{ uri: listing.images[currentImageIndex] }} 
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="image-outline" size={80} color="#CCC" />
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
            </Animated.View>
          </PanGestureHandler>
          
          {listing.images && listing.images.length > 1 && (
            <View style={styles.imageDots}>
              {listing.images.map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.dot, 
                    { backgroundColor: index === currentImageIndex ? '#83AFA7' : '#E0E0E0' }
                  ]} 
                />
              ))}
            </View>
          )}
        </View>

        {/* Locked Status Banner */}
        {listing.status === 'locked' && (
          <View style={styles.lockedBanner}>
            <Ionicons name="lock-closed" size={20} color="#F68652" />
            <Text style={[styles.lockedText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              🔒 This item has been locked and is no longer available
            </Text>
          </View>
        )}

        {/* Real-time Lock Notification */}
        {realtimeLocked && (
          <View style={styles.realtimeLockBanner}>
            <Ionicons name="flash" size={20} color="#FF5722" />
            <Text style={[styles.realtimeLockText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              ⚡ Just locked by another user!
            </Text>
          </View>
        )}

        {/* Item Info */}
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            {listing.title || listing.listingTitle || 'Untitled Listing'}
          </Text>
          
          <View style={styles.priceContainer}>
            {isMSL ? (
              <View style={styles.mslPrices}>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    Mine
                  </Text>
                  <Text style={[styles.priceValue, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                    ₱{listing.minePrice || listing.price}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    Steal
                  </Text>
                  <Text style={[styles.priceValue, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                    ₱{listing.stealPrice}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    Lock
                  </Text>
                  <Text style={[styles.priceValue, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                    ₱{listing.lockPrice}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.biddingPrices}>
                <Text style={[styles.currentBid, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                  Current Bid: ₱{currentBid?.amount || listing.startingPrice}
                </Text>
                <Text style={[styles.startingBid, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                  Starting: ₱{listing.startingPrice}
                </Text>
                <Text style={[styles.bidIncrement, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                  Min. Increment: ₱{listing.minimumBidIncrement}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.description, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            {listing.description}
          </Text>

          {/* Item Details */}
          <View style={styles.detailsSection}>
            <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              Item Details
            </Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Type:</Text>
                <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>{listing.type || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Category:</Text>
                <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>{listing.category || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Brand:</Text>
                <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>{listing.brand || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Condition:</Text>
                <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>{listing.condition || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Size:</Text>
                <Text style={[styles.detailValue, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>{listing.size || 'N/A'}</Text>
              </View>
            </View>
          </View>

          {/* Seller Info */}
          <View style={styles.sellerSection}>
            <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              Seller
            </Text>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerAvatar}>
                {sellerData?.avatar ? (
                  <Image 
                    source={{ uri: sellerData.avatar }} 
                    style={styles.sellerAvatarImage}
                  />
                ) : (
                <Ionicons name="person" size={24} color="#83AFA7" />
                )}
              </View>
              <View style={styles.sellerDetails}>
                <Text style={[styles.sellerName, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  {listing.sellerName || sellerData?.displayName || 'Unknown Seller'}
                </Text>
                <Text style={[styles.sellerLocation, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                  {sellerAddress ? 
                    (sellerAddress.cityName || sellerAddress.city || 'City not specified') :
                    (listing.location || 'Location not specified')
                  }
                </Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Action Success Indicator */}
      {actionSuccess && (
        <View style={styles.successIndicator}>
          <Ionicons 
            name="checkmark-circle" 
            size={24} 
            color="#4CAF50" 
          />
          <Text style={[styles.successText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            {actionSuccess} Successful!
          </Text>
        </View>
      )}

      {/* Swipe Instructions */}
      {isMSL && showInstructions && (
        <Animated.View style={[styles.swipeInstructions, { opacity: instructionsOpacity }]}>
          <Text style={[styles.instructionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
            Swipe the buttons below to choose:
          </Text>
          <View style={styles.instructionRow}>
            <View style={styles.instructionItem}>
              <Ionicons name="arrow-forward" size={16} color="#4CAF50" />
              <Text style={[styles.instructionLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>Mine</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="arrow-up" size={16} color="#2196F3" />
              <Text style={[styles.instructionLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>Lock</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="arrow-back" size={16} color="#FF9800" />
              <Text style={[styles.instructionLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>Steal</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Action History Drawer - Floating above action buttons */}
      <View style={styles.floatingActionHistory}>
        <Animated.View style={[styles.actionHistoryDrawer, { height: drawerHeight }]}>
          {/* Drawer Header */}
          <TouchableOpacity 
            style={styles.drawerHeader}
            onPress={toggleDrawer}
          >
            <View style={styles.drawerHeaderContent}>
              <Ionicons name="time-outline" size={18} color="#83AFA7" />
              <Text style={[styles.drawerHeaderText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Action History ({activityLogs.length})
              </Text>
            </View>
            <Ionicons 
              name={isDrawerExpanded ? "chevron-down" : "chevron-up"} 
              size={16} 
              color="#83AFA7" 
            />
          </TouchableOpacity>

          {/* Drawer Content */}
          {isDrawerExpanded && (
            <ScrollView style={styles.drawerContent}>
              {activityLogs.length > 0 ? (
                (() => {
                  // For bidding listings, rank by bid amount (highest first)
                  // For MSL listings, rank by action hierarchy
                  const isBiddingListing = listing?.priceType === 'bidding';
                  
                  let sortedLogs;
                  if (isBiddingListing) {
                    // Sort bids by amount (highest first), then by timestamp (earliest first for same amount)
                    sortedLogs = [...activityLogs].sort((a, b) => {
                      if (a.price !== b.price) {
                        return b.price - a.price; // Higher bid amount first
                      }
                      return a.timestamp - b.timestamp; // Earlier timestamp first for same amount
                    });
                  } else {
                    // For MSL listings, use action hierarchy
                    const actionHierarchy = { 'Mined': 1, 'Stole': 2, 'Locked': 3 };
                    sortedLogs = [...activityLogs].sort((a, b) => {
                      const aLevel = actionHierarchy[a.action] || 1;
                      const bLevel = actionHierarchy[b.action] || 1;
                      
                      if (aLevel !== bLevel) {
                        return bLevel - aLevel; // Higher action level first
                      }
                      
                      return a.timestamp - b.timestamp;
                    });
                  }
                  
                  return sortedLogs.map((log, index) => {
                    const rank = index + 1;
                  
                  return (
                    <View key={log.id || `log-${index}`} style={styles.drawerHistoryItem}>
                      <View style={styles.drawerRankContainer}>
                        <View style={[
                          styles.drawerRankBadge,
                          rank === 1 && styles.rankFirst,
                          rank === 2 && styles.rankSecond,
                          rank === 3 && styles.rankThird
                        ]}>
                          <Text style={[
                            styles.drawerRankText,
                            { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined },
                            (rank <= 3) && styles.rankTextWhite
                          ]}>
                            #{rank}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.drawerHistoryIcon}>
                        <Ionicons 
                          name={
                            log.action === 'Mined' ? 'diamond' :
                            log.action === 'Stole' ? 'flash' :
                            log.action === 'Locked' ? 'lock-closed' :
                            'hammer'
                          } 
                          size={16} 
                          color={
                            log.action === 'Mined' ? '#4CAF50' :
                            log.action === 'Stole' ? '#FF9800' :
                            log.action === 'Locked' ? '#2196F3' :
                            '#F68652'
                          } 
                        />
                      </View>
                      <View style={styles.drawerHistoryContent}>
                        <Text style={[styles.drawerHistoryText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                          {log.userName} {log.action} for ₱{log.price}
                        </Text>
                        <Text style={[styles.drawerHistoryTime, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                          {log.timestamp.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  );
                });
                })()
              ) : (
                <View style={styles.drawerEmptyHistory}>
                  <Ionicons name="time-outline" size={32} color="#999" />
                  <Text style={[styles.drawerEmptyText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    No actions yet
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>

      {/* Action Buttons */}
      <View style={[styles.actionButtons, { paddingBottom: insets.bottom > 0 ? insets.bottom : 18 }]}>
        {isOwnListing ? (
          <View style={styles.ownListingMessage}>
            <Ionicons name="information-circle-outline" size={24} color="#83AFA7" />
            <Text style={[styles.ownListingMessageText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              This is your listing. You cannot perform actions on your own items.
            </Text>
          </View>
        ) : isMSL ? (
          <>
            <PanGestureHandler onHandlerStateChange={(event) => onSwipeGesture(event, 'mine')}>
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  activeButton === 'mine' && styles.activeButton,
                  isActionDisabled('mine') && styles.disabledButton
                ]} 
                onPress={handleMine}
                disabled={isActionDisabled('mine')}
              >
                <Ionicons 
                  name="diamond-outline" 
                  size={20} 
                  color={
                    isActionDisabled('mine') 
                      ? '#999' 
                      : activeButton === 'mine' 
                        ? '#F68652' 
                        : 'white'
                  } 
                />
                <Text style={[
                  styles.buttonText, 
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                  activeButton === 'mine' && styles.activeText,
                  isActionDisabled('mine') && styles.disabledText
                ]}>
                  Mine
                </Text>
              </TouchableOpacity>
            </PanGestureHandler>
            <PanGestureHandler onHandlerStateChange={(event) => onSwipeGesture(event, 'lock')}>
              <View style={styles.lockButtonContainer}>
                <Animated.View style={[
                  styles.lockButton, 
                  lockFloatingStyle,
                  isActionDisabled('lock') && styles.disabledLockButton,
                  activeButton === 'lock' && styles.lockButtonActive
                ]}>
                  <TouchableOpacity 
                    style={styles.lockButtonTouchable} 
                    onPress={handleLock}
                    disabled={isActionDisabled('lock')}
                  >
                    <Ionicons 
                      name="lock-closed" 
                      size={24} 
                      color={isActionDisabled('lock') ? '#999' : 'white'} 
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </PanGestureHandler>
            <PanGestureHandler onHandlerStateChange={(event) => onSwipeGesture(event, 'steal')}>
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  activeButton === 'steal' && styles.activeButton,
                  isActionDisabled('steal') && styles.disabledButton
                ]} 
                onPress={handleSteal}
                disabled={isActionDisabled('steal')}
              >
                <Ionicons 
                  name="flash-outline" 
                  size={20} 
                  color={
                    isActionDisabled('steal') 
                      ? '#999' 
                      : activeButton === 'steal' 
                        ? '#F68652' 
                        : 'white'
                  } 
                />
                <Text style={[
                  styles.buttonText, 
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                  activeButton === 'steal' && styles.activeText,
                  isActionDisabled('steal') && styles.disabledText
                ]}>
                  Steal
                </Text>
              </TouchableOpacity>
            </PanGestureHandler>
          </>
        ) : (
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.bidButton, 
              activeButton === 'bid' && styles.activeButton,
              isBidDisabled() && styles.disabledButton
            ]} 
            onPress={handleBid}
            disabled={isBidDisabled()}
          >
            <Ionicons 
              name="hammer-outline" 
              size={20} 
              color={
                isBidDisabled() 
                  ? '#999' 
                  : activeButton === 'bid' 
                    ? '#F68652' 
                    : 'white'
              } 
            />
            <Text style={[
              styles.buttonText, 
              { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
              activeButton === 'bid' && styles.activeText,
              isBidDisabled() && styles.disabledText
            ]}>
              Place Bid
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Live Streaming Section */}
      {isLiveStreaming && liveStream && (
        <View style={styles.liveStreamContainer}>
          <View style={styles.liveStreamHeader}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.liveStreamTitle}>{liveStream.title}</Text>
          </View>
          <TouchableOpacity
            style={styles.watchStreamButton}
            onPress={() => navigation.navigate('StreamViewer', { stream: liveStream })}
          >
            <Ionicons name="videocam" size={20} color="#fff" />
            <Text style={styles.watchStreamText}>Watch Live Stream</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Start Stream Button (for listing owner) */}
      {isOwnListing && !isLiveStreaming && (
        <View style={styles.startStreamContainer}>
          <TouchableOpacity
            style={styles.startStreamButton}
            onPress={() => navigation.navigate('LiveStream', { listing })}
          >
            <Ionicons name="videocam" size={20} color="#fff" />
            <Text style={styles.startStreamText}>Start Live Stream</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Swipe Direction Indicator */}
      {swipeDirection && (
        <View style={[styles.swipeIndicator, swipeDirection === 'left' && styles.swipeLeft, swipeDirection === 'right' && styles.swipeRight, swipeDirection === 'up' && styles.swipeUp]}>
          <Ionicons 
            name={
              swipeDirection === 'left' ? 'diamond' : 
              swipeDirection === 'right' ? 'flash' : 
              'lock-closed'
            } 
            size={40} 
            color="white" 
          />
          <Text style={[styles.swipeText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            {swipeDirection === 'right' ? 'MINE' : 
             swipeDirection === 'left' ? 'STEAL' : 
             'LOCK'}
          </Text>
        </View>
      )}

      {/* Bid Modal */}
      {showBidModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              Place Your Bid
            </Text>
            <Text style={[styles.modalSubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              Current bid: ₱{currentBid?.amount || listing.startingPrice}
            </Text>
            <View style={styles.bidInputContainer}>
              <Text style={[styles.bidInputLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Your bid amount:
              </Text>
              <View style={styles.bidInputWrapper}>
                <Text style={[styles.currencySymbol, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>₱</Text>
                <TextInput
                  style={[styles.bidInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setTimeout(() => {
                  setShowBidModal(false);
                  setActiveButton(null);
                  }, 0);
                }}
              >
                <Text style={[styles.modalButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]} 
                onPress={submitBid}
              >
                <Text style={[styles.modalButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Submit Bid
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Success Modal */}
      <StandardModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successTitle}
        message={successMessage}
        confirmText="OK"
        onConfirm={successAction || (() => setShowSuccessModal(false))}
        showCancel={false}
        confirmButtonStyle="success"
      />

      {/* Action History Modal */}
      {showActionHistory && (
        <View style={styles.modalOverlay}>
          <View style={styles.actionHistoryModal}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Action History
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowActionHistory(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {activityLogs.length > 0 ? (
                activityLogs.map((log, index) => (
                  <View key={log.id || `log-${index}`} style={styles.historyItem}>
                    <View style={styles.historyIcon}>
                      <Ionicons 
                        name={
                          log.action === 'Mined' ? 'diamond' :
                          log.action === 'Stole' ? 'flash' :
                          log.action === 'Locked' ? 'lock-closed' :
                          'hammer'
                        } 
                        size={20} 
                        color={
                          log.action === 'Mined' ? '#4CAF50' :
                          log.action === 'Stole' ? '#FF9800' :
                          log.action === 'Locked' ? '#2196F3' :
                          '#F68652'
                        } 
                      />
                    </View>
                    <View style={styles.historyContent}>
                      <Text style={[styles.historyText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                        {log.userName} {log.action} for ₱{log.price}
                      </Text>
                      <Text style={[styles.historyTime, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {log.timestamp.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistory}>
                  <Ionicons name="time-outline" size={48} color="#999" />
                  <Text style={[styles.emptyHistoryText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                    No actions yet
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

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
  gestureContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  overlayHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#83AFA7',
    letterSpacing: -0.2,
    textAlign: 'center',
    flex: 1,
  },
  ownListingBadge: {
    backgroundColor: '#83AFA7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  ownListingText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  ownListingMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ownListingMessageText: {
    fontSize: 14,
    color: '#4A5568',
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
  headerTimer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F68652',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timerIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTimerText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  expiredText: {
    color: '#E53E3E',
    fontWeight: '600',
  },
  // Timer urgency styles
  timerCritical: {
    backgroundColor: '#E53E3E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timerWarning: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timerCaution: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  timerExpired: {
    backgroundColor: '#6B7280',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timerIconCritical: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  timerIconWarning: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  timerIconCaution: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  timerIconExpired: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  timerTextCritical: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  timerTextWarning: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  timerTextCaution: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  timerTextExpired: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  floatingActionHistory: {
    position: 'absolute',
    bottom: 110, // Lowered to be closer to action buttons
    left: 16,
    right: 16,
    zIndex: 10,
  },
  actionHistoryDrawer: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
    ...(Platform.OS === 'android' && {
      elevation: 4,
    }),
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  drawerHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerHeaderText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  drawerContent: {
    maxHeight: 240,
  },
  drawerHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  drawerRankContainer: {
    marginRight: 8,
  },
  drawerRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankFirst: {
    backgroundColor: '#FFD700', // Gold
  },
  rankSecond: {
    backgroundColor: '#C0C0C0', // Silver
  },
  rankThird: {
    backgroundColor: '#CD7F32', // Bronze
  },
  drawerRankText: {
    fontSize: 10,
    color: '#333',
    fontWeight: 'bold',
  },
  rankTextWhite: {
    color: 'white',
  },
  drawerHistoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  drawerHistoryContent: {
    flex: 1,
  },
  drawerHistoryText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
  },
  drawerHistoryTime: {
    fontSize: 11,
    color: '#666',
  },
  drawerEmptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  drawerEmptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  actionHistoryModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    ...(Platform.OS === 'android' && {
      elevation: 8,
    }),
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    maxHeight: 400,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  historyTime: {
    fontSize: 12,
    color: '#666',
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  messageButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    height: 350,
    backgroundColor: '#F8F9FA',
    position: 'relative',
    borderRadius: 0,
    overflow: 'hidden',
    marginTop: -60,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  imageDots: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemInfo: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  priceContainer: {
    marginBottom: 8,
    padding: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
  },
  mslPrices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    marginTop: 0,
  },
  priceRow: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F68652',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  biddingPrices: {
    gap: 5,
  },
  currentBid: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F68652',
    letterSpacing: -0.2,
  },
  startingBid: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  bidIncrement: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  currentBidder: {
    fontSize: 14,
    color: '#83AFA7',
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '400',
  },
  detailsSection: {
    marginBottom: 8,
    padding: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#83AFA7',
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  detailsGrid: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  sellerSection: {
    marginBottom: 80,
    padding: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  sellerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    overflow: 'hidden',
  },
  sellerAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  sellerDetails: {
    flex: 1,
  },
  sellerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    letterSpacing: -0.1,
  },
  sellerLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  auctionSection: {
    marginBottom: 8,
    padding: 12,
    backgroundColor: 'rgba(254, 243, 199, 0.3)',
    borderRadius: 8,
    borderWidth: 0,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  auctionInfo: {
    gap: 5,
  },
  auctionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    lineHeight: 20,
  },
  activitySection: {
    marginBottom: 8,
    padding: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
  },
  activityList: {
    gap: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E5E7EB',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
    fontWeight: '400',
  },
  successIndicator: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
    zIndex: 1000,
  },
  successText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
  timerContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
  },
  timerDisplay: {
    alignItems: 'center',
  },
  timerValues: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  timerItem: {
    alignItems: 'center',
    minWidth: 40,
  },
  timerNumber: {
    fontSize: 20,
    color: '#F68652',
    fontWeight: '700',
    lineHeight: 24,
  },
  timerUnit: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginTop: 2,
  },
  timerExpired: {
    fontSize: 18,
    color: '#E53E3E',
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: '#83AFA7',
    paddingVertical: 14,
    paddingBottom: 18,
    paddingHorizontal: 6,
    minHeight: 75,
    ...(Platform.OS === 'android' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  mslButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
    minWidth: 75,
    paddingHorizontal: 2,
    justifyContent: 'center',
    maxWidth: 80,
  },
  mineButton: {
    backgroundColor: 'transparent',
  },
  stealButton: {
    backgroundColor: 'transparent',
  },
  lockButton: {
    backgroundColor: 'transparent',
  },
  bidButton: {
    backgroundColor: 'transparent',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 10,
    color: 'white',
    marginTop: 3,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 12,
  },
  activeButton: {
    // No additional styling needed for active state
  },
  activeText: {
    color: '#F68652',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    width: width - 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
  },
  bidInputContainer: {
    marginBottom: 20,
  },
  bidInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  bidInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
  },
  currencySymbol: {
    fontSize: 14,
    color: '#666',
    marginRight: 6,
    fontWeight: '500',
  },
  bidInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
    color: '#333',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#83AFA7',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    letterSpacing: -0.1,
  },
  swipeIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  swipeLeft: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  swipeRight: {
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
  },
  swipeUp: {
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
  },
  swipeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  swipeInstructions: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontWeight: '500',
    lineHeight: 20,
  },
  instructionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  instructionItem: {
    alignItems: 'center',
    gap: 5,
  },
  instructionLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  lockButtonContainer: {
    alignItems: 'center',
    flex: 1,
    minWidth: 75,
    paddingHorizontal: 2,
    justifyContent: 'center',
    maxWidth: 80,
  },
  lockButton: {
    backgroundColor: '#F68652',
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    ...(Platform.OS === 'android' && {
      elevation: 8,
    }),
  },
  lockButtonActive: {
    backgroundColor: '#E55A2B',
  },
  lockButtonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
  disabledLockButton: {
    backgroundColor: '#999',
    opacity: 0.7,
  },
  lockButtonText: {
    fontSize: 10,
    color: 'white',
    marginTop: 3,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 12,
  },
  lockedBanner: {
    backgroundColor: '#FFF3E0',
    borderColor: '#F68652',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedText: {
    color: '#F68652',
    fontSize: 14,
    marginLeft: 8,
    textAlign: 'center',
  },
  realtimeLockBanner: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FF5722',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse',
  },
  realtimeLockText: {
    color: '#FF5722',
    fontSize: 14,
    marginLeft: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  // Live Streaming Styles
  liveStreamContainer: {
    backgroundColor: '#ff4444',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveStreamHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  liveStreamTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  watchStreamButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchStreamText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  startStreamContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  startStreamButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startStreamText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ListingDetailsScreen;
