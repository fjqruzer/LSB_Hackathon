import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, AppState } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigation from './BottomNavigation';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import PeopleScreen from '../screens/PeopleScreen';
import UpdatesScreen from '../screens/UpdatesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import PaymentScreen from '../screens/PaymentScreen';
import MyPaymentsScreen from '../screens/MyPaymentsScreen';
import MyShopScreen from '../screens/MyShopScreen';
import MySalesScreen from '../screens/MySalesScreen';
import MyFavoritesScreen from '../screens/MyFavoritesScreen';
import MyPasswordScreen from '../screens/MyPasswordScreen';
import MySettingsScreen from '../screens/MySettingsScreen';
import PostListingScreen from '../screens/PostListingScreen';
import NotificationTestScreen from '../screens/NotificationTestScreen';
import ListingDetailsScreen from '../screens/ListingDetailsScreen';
import { useNotificationListener } from '../contexts/NotificationListenerContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useNotificationNavigation } from '../contexts/NotificationNavigationContext';

const MainNavigationContent = () => {
  const [currentScreen, setCurrentScreen] = useState('marketplace');
  const [paymentParams, setPaymentParams] = useState(null);
  const insets = useSafeAreaInsets();
  const appState = useRef(AppState.currentState);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [currentListing, setCurrentListing] = useState(null);
  const { setNavigationHandler } = useNotificationListener();
  const { setNavigationHandler: setNotificationContextHandler } = useNotifications();
  const { navigationData, shouldNavigate, clearNavigation } = useNotificationNavigation();

  // Set up notification navigation handler
  useEffect(() => {
    setNavigationHandler(handleNotificationNavigation);
    setNotificationContextHandler(handleNotificationNavigation);
  }, []);

  // Handle notification navigation from context (notification bar clicks)
  useEffect(() => {
    if (shouldNavigate && navigationData) {
      handleNotificationNavigation(navigationData);
      clearNavigation();
    }
  }, [shouldNavigate, navigationData, clearNavigation]);

  // Handle Android safe area conflicts when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (Platform.OS === "android" && 
          appState.current.match(/inactive|background/) && 
          nextAppState === 'active') {
        // Android app returned to foreground, forcing update
        setForceUpdate(prev => prev + 1);
        
        // Additional delay to ensure safe area insets are recalculated
        setTimeout(() => {
          setForceUpdate(prev => prev + 1);
        }, 100);
      }
      appState.current = nextAppState;
    });

    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, [forceUpdate]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'marketplace':
        return <MarketplaceScreen 
          onListingPress={handleListingPress} 
          onNavigateToFavorites={() => setCurrentScreen('MyFavorites')}
        />;
      case 'people':
        return <PeopleScreen />;
      case 'updates':
        return <UpdatesScreen navigation={{ navigate: (screen, params) => {
          if (screen === 'Payment') {
            setCurrentScreen('Payment');
            // Store params for PaymentScreen
            setPaymentParams(params);
          } else {
            setCurrentScreen(screen);
          }
        } }} />;
      case 'profile':
        return <ProfileScreen navigation={{ 
          navigate: (screen) => {
            if (screen === 'MyShop') {
              setCurrentScreen('MyShop');
            } else if (screen === 'MySales') {
              setCurrentScreen('MySales');
            } else if (screen === 'MyPayments') {
              setCurrentScreen('MyPayments');
            } else if (screen === 'PaymentMethods') {
              setCurrentScreen('PaymentMethods');
            } else if (screen === 'EditProfile') {
              setCurrentScreen('EditProfile');
            } else if (screen === 'MyFavorites') {
              setCurrentScreen('MyFavorites');
            } else if (screen === 'MyPassword') {
              setCurrentScreen('MyPassword');
            } else {
              setCurrentScreen(screen);
            }
          }
        }} />;
      case 'EditProfile':
        return (
          <EditProfileScreen 
            navigation={{ goBack: () => setCurrentScreen('profile') }}
          />
        );
      case 'PaymentMethods':
        return (
          <PaymentMethodsScreen 
            navigation={{ goBack: () => setCurrentScreen('profile') }}
          />
        );
      case 'Payment':
        return (
          <PaymentScreen 
            navigation={{ 
              goBack: () => {
                // Check if we came from MyPayments by looking at the params
                if (paymentParams?.existingPaymentData) {
                  setCurrentScreen('MyPayments');
                } else {
                  setCurrentScreen('marketplace');
                }
              }
            }}
            route={{ params: paymentParams || { listingId: 'test', actionType: 'Mined', price: 100 } }}
          />
        );
      case 'MyPayments':
        return (
          <MyPaymentsScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile'),
              navigate: (screen, params) => {
                if (screen === 'Payment') {
                  setCurrentScreen('Payment');
                  setPaymentParams(params);
                } else {
                  setCurrentScreen(screen);
                }
              }
            }}
          />
        );
      case 'MyShop':
        return (
          <MyShopScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile'),
              navigate: (screen, params) => {
                if (screen === 'Payment') {
                  setCurrentScreen('Payment');
                  setPaymentParams(params);
                } else if (screen === 'PostListing') {
                  setCurrentScreen('PostListing');
                } else if (screen === 'ListingDetails') {
                  setCurrentListing(params.listing);
                  setCurrentScreen('ListingDetails');
                } else {
                  setCurrentScreen(screen);
                }
              }
            }}
          />
        );
      case 'MySales':
        return (
          <MySalesScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile'),
              navigate: (screen, params) => {
                if (screen === 'MyShop') {
                  setCurrentScreen('MyShop');
                } else if (screen === 'PostListing') {
                  setCurrentScreen('PostListing');
                } else {
                  setCurrentScreen(screen);
                }
              }
            }}
          />
        );
      case 'MyFavorites':
        return (
          <MyFavoritesScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile'),
              navigate: (screen, params) => {
                if (screen === 'ListingDetails') {
                  setCurrentListing(params);
                  setCurrentScreen('ListingDetails');
                } else if (screen === 'marketplace') {
                  setCurrentScreen('marketplace');
                } else {
                  setCurrentScreen(screen);
                }
              }
            }}
          />
        );
      case 'MyPassword':
        return (
          <MyPasswordScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile')
            }}
          />
        );
      case 'MySettings':
        return (
          <MySettingsScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile'),
              navigate: (screen) => {
                if (screen === 'MyPassword') {
                  setCurrentScreen('MyPassword');
                } else if (screen === 'EditProfile') {
                  setCurrentScreen('EditProfile');
                } else if (screen === 'Login') {
                  setCurrentScreen('Login');
                } else {
                  setCurrentScreen(screen);
                }
              }
            }}
          />
        );
      case 'PostListing':
        return (
          <PostListingScreen 
            key="post-listing-screen"
            navigation={{ goBack: () => setCurrentScreen('marketplace') }}
            selectedPhotos={selectedPhotos}
            setSelectedPhotos={setSelectedPhotos}
          />
        );
      case 'NotificationTest':
        return (
          <NotificationTestScreen 
            navigation={{ goBack: () => setCurrentScreen('profile') }}
          />
        );
      case 'ListingDetails':
        return (
          <ListingDetailsScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('marketplace'),
              navigate: (screen, params) => {
                if (screen === 'Payment') {
                  setCurrentScreen('Payment');
                  setPaymentParams(params);
                  } else {
                  setCurrentScreen(screen);
                }
              }
            }}
            route={{ params: { listing: currentListing } }}
          />
        );
      default:
        return <MarketplaceScreen />;
    }
  };

  const handleScreenChange = (screenId) => {
    if (screenId === 'add') {
      setCurrentScreen('PostListing');
    } else {
    setCurrentScreen(screenId);
    }
  };

  const handleListingPress = (listing) => {
    setCurrentListing(listing);
    setCurrentScreen('ListingDetails');
  };

  // Handle navigation from push notifications
  const handleNotificationNavigation = (notificationData) => {
    // Check if notificationData exists and has required properties
    if (!notificationData || !notificationData.type) {
      return;
    }
    
    if (notificationData.type === 'payment_required' && notificationData.listingId) {
      // Navigate to payment screen for winner
      setPaymentParams({
        listingId: notificationData.listingId,
        actionType: notificationData.actionType,
        amount: notificationData.amount,
        sellerId: notificationData.sellerId,
        isWinner: true
      });
      setCurrentScreen('Payment');
    } else if (notificationData.type === 'winner_determined' && notificationData.listingId) {
      // Navigate to listing details for seller
      fetchListingAndNavigate(notificationData.listingId);
    } else {
      setCurrentScreen('marketplace');
    }
  };

  // Fetch listing and navigate to details
  const fetchListingAndNavigate = async (listingId) => {
    try {
      // This would need to be implemented to fetch listing from Firestore
      // For now, we'll just navigate to marketplace
      setCurrentScreen('marketplace');
    } catch (error) {
      console.error('Error fetching listing:', error);
      setCurrentScreen('marketplace');
    }
  };

  return (
    <View key={forceUpdate} style={styles.container}>
      {renderScreen()}
      {currentScreen !== 'PostListing' && currentScreen !== 'ListingDetails' && currentScreen !== 'EditProfile' && currentScreen !== 'PaymentMethods' && currentScreen !== 'Payment' && currentScreen !== 'MyShop' && currentScreen !== 'MySales' && currentScreen !== 'MyFavorites' && currentScreen !== 'MyPassword' && currentScreen !== 'MySettings' && (
        <BottomNavigation 
          currentScreen={currentScreen}
          onScreenChange={handleScreenChange}
        />
      )}
    </View>
  );
};

const MainNavigation = () => {
  return (
    <SafeAreaProvider>
      <MainNavigationContent />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MainNavigation;
