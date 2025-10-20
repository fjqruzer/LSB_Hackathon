import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, AppState } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import BottomNavigation from './BottomNavigation';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import ForYouScreen from '../screens/ForYouScreen';
import PeopleScreen from '../screens/PeopleScreen';
import UpdatesScreen from '../screens/UpdatesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import PaymentScreen from '../screens/PaymentScreen';
import MyPaymentsScreen from '../screens/MyPaymentsScreen';
import MyShopScreen from '../screens/MyShopScreen';
import BuyerCommentsScreen from '../screens/BuyerCommentsScreen';
import MySalesScreen from '../screens/MySalesScreen';
import MyFavoritesScreen from '../screens/MyFavoritesScreen';
import MyPasswordScreen from '../screens/MyPasswordScreen';
import MyAddressScreen from '../screens/MyAddressScreen';
import PaymentApprovalScreen from '../screens/PaymentApprovalScreen';
import PostListingScreen from '../screens/PostListingScreen';
import ListingDetailsScreen from '../screens/ListingDetailsScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import LiveStreamScreen from '../screens/LiveStreamScreen';
import StreamViewerScreen from '../screens/StreamViewerScreen';
import LiveStreamsScreen from '../screens/LiveStreamsScreen';
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
          navigation={{ navigate: (screen, params) => {
            if (screen === 'messages') {
              setCurrentScreen('messages');
            } else if (screen === 'Chat') {
              setCurrentScreen('Chat');
              setPaymentParams(params);
            } else {
              setCurrentScreen(screen);
            }
          }}}
        />;
      case 'foryou':
        return <ForYouScreen 
          onNavigateToFavorites={() => setCurrentScreen('MyFavorites')}
          navigation={{ 
            navigate: (screen, params) => {
              if (screen === 'messages') {
                setCurrentScreen('messages');
              } else if (screen === 'Chat') {
                setCurrentScreen('Chat');
                setPaymentParams(params);
              } else if (screen === 'ListingDetails') {
                setCurrentListing(params?.listing);
                setCurrentScreen('ListingDetails');
              } else {
                setCurrentScreen(screen);
              }
            },
            goBack: () => setCurrentScreen('marketplace')
          }}
        />;
      case 'people':
        return <PeopleScreen navigation={{ navigate: (screen, params) => {
          if (screen === 'UserProfile') {
            setCurrentScreen('UserProfile');
            setPaymentParams(params);
          } else {
            setCurrentScreen(screen);
          }
        } }} />;
      case 'messages':
        return <ChatListScreen navigation={{ 
          goBack: () => setCurrentScreen('marketplace'),
          navigate: (screen, params) => {
            if (screen === 'Chat') {
              setCurrentScreen('Chat');
              setPaymentParams(params);
            } else {
              setCurrentScreen(screen);
            }
          }
        }} />;
      case 'Chat':
        return (
          <ChatScreen 
            navigation={{ goBack: () => setCurrentScreen('messages') }}
            route={{ params: paymentParams || { chatId: 'test', otherUser: { id: 'test', name: 'Test User' } } }}
          />
        );
      case 'UserProfile':
        return (
          <UserProfileScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('people'),
              navigate: (screen, params) => {
                if (screen === 'Chat') {
                  setCurrentScreen('Chat');
                  setPaymentParams(params);
                } else if (screen === 'ListingDetails') {
                  console.log('🔍 MainNavigation - UserProfileScreen navigating to ListingDetails with:', params);
                  setCurrentListing(params.listing);
                  setCurrentScreen('ListingDetails');
                } else {
                  setCurrentScreen(screen);
                }
              }
            }}
            route={{ params: paymentParams || { userId: 'test' } }}
          />
        );
      case 'updates':
        return <UpdatesScreen navigation={{ 
          navigate: (screen, params) => {
            if (screen === 'Payment') {
              setCurrentScreen('Payment');
              setPaymentParams(params);
            } else if (screen === 'MyPayments') {
              setCurrentScreen('MyPayments');
            } else if (screen === 'PaymentApproval') {
              setCurrentScreen('PaymentApproval');
            } else if (screen === 'ListingDetails') {
              setCurrentListing(params?.listing);
              setCurrentScreen('ListingDetails');
            } else {
              setCurrentScreen(screen);
            }
          },
          goBack: () => {
            setCurrentScreen('marketplace');
          }
        }} />;
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
      case 'BuyerComments':
        return (
          <BuyerCommentsScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile'),
              navigate: (screen, params) => {
                setCurrentScreen(screen);
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
                  console.log('🔍 MainNavigation - MyFavorites navigate to ListingDetails with params:', params);
                  setCurrentListing(params.listing);
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
      case 'MyAddress':
        return (
          <MyAddressScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile')
            }}
          />
        );
      case 'PaymentApproval':
        return (
          <PaymentApprovalScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('profile')
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
      case 'ListingDetails':
        return (
          <ListingDetailsScreen 
            navigation={{ 
              goBack: () => {
                // Go back to the previous screen (could be marketplace, favorites, shop, etc.)
                if (currentScreen === 'ListingDetails') {
                  // If we came from favorites, go back to favorites
                  if (currentListing?.fromFavorites) {
                    setCurrentScreen('MyFavorites');
                  } else if (currentListing?.fromShop) {
                    setCurrentScreen('MyShop');
                  } else if (currentListing?.fromMarketplace) {
                    setCurrentScreen('marketplace');
                  } else {
                    setCurrentScreen('marketplace');
                  }
                }
              },
              navigate: (screen, params) => {
                if (screen === 'Payment') {
                  setCurrentScreen('Payment');
                  setPaymentParams(params);
                } else if (screen === 'Chat') {
                  setCurrentScreen('Chat');
                  setPaymentParams(params);
                } else {
                  setCurrentScreen(screen);
                }
              }
            }}
            route={{ params: { listing: currentListing } }}
            key={`listing-details-${currentListing?.id || 'unknown'}`}
          />
        );
      case 'LiveStream':
        return (
          <LiveStreamScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('LiveStreams'),
              navigate: (screen, params) => setCurrentScreen(screen)
            }}
            route={{ params: { listing: currentListing } }}
          />
        );
      case 'StreamViewer':
        return (
          <StreamViewerScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('LiveStreams'),
              navigate: (screen, params) => setCurrentScreen(screen)
            }}
            route={{ params: { stream: paymentParams?.stream } }}
          />
        );
      case 'LiveStreams':
        return (
          <LiveStreamsScreen 
            navigation={{ 
              goBack: () => setCurrentScreen('marketplace'),
              navigate: (screen, params) => {
                if (screen === 'StreamViewer') {
                  setPaymentParams({ stream: params.stream });
                  setCurrentScreen('StreamViewer');
                } else {
                  setCurrentScreen(screen);
                }
              }
            }}
          />
        );
      default:
        return <MarketplaceScreen />;
    }
  };

  const handleScreenChange = (screenId) => {
    console.log('🔍 MainNavigation - Screen changing to:', screenId);
    if (screenId === 'add') {
      setCurrentScreen('PostListing');
    } else {
    setCurrentScreen(screenId);
    }
  };

  const handleListingPress = (listing) => {
    console.log('🔍 MainNavigation - handleListingPress called with:', listing);
    setCurrentListing({ ...listing, fromMarketplace: true });
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
    } else if (notificationData.type === 'payment_submitted' && notificationData.listingId) {
      // Navigate to payment approval screen for seller
      setPaymentParams({
        listingId: notificationData.listingId,
        paymentId: notificationData.paymentId,
        actionType: notificationData.actionType,
        amount: notificationData.amount,
        buyerId: notificationData.buyerId,
        buyerName: notificationData.buyerName,
        isSeller: true
      });
      setCurrentScreen('PaymentApproval');
    } else if (notificationData.type === 'payment_approved' && notificationData.listingId) {
      // Navigate to MyPayments screen for buyer (payment approved)
      setCurrentScreen('MyPayments');
    } else if (notificationData.type === 'payment_rejected' && notificationData.listingId) {
      // Navigate to MyPayments screen for buyer (payment rejected)
      setCurrentScreen('MyPayments');
    } else if (notificationData.type === 'winner_determined' && notificationData.listingId) {
      // Navigate to listing details for seller
      fetchListingAndNavigate(notificationData.listingId);
    } else if (notificationData.type === 'live_stream_started') {
      // Don't navigate for live stream notifications - let user stay in current screen
      console.log('🔴 Live stream notification received, staying in current screen');
      return;
    } else {
      setCurrentScreen('marketplace');
    }
  };

  // Fetch listing and navigate to details
  const fetchListingAndNavigate = async (listingId) => {
    try {
      console.log('🔍 MainNavigation - Fetching listing for ID:', listingId);
      
      
      // Fetch listing from Firestore
      const listingDoc = await getDoc(doc(db, 'listings', listingId));
      
      if (listingDoc.exists()) {
        const listingData = {
          id: listingDoc.id,
          ...listingDoc.data()
        };
        
        console.log('🔍 MainNavigation - Fetched listing:', listingData);
        setCurrentListing(listingData);
        setCurrentScreen('ListingDetails');
      } else {
        console.log('🔍 MainNavigation - Listing not found, going to marketplace');
      setCurrentScreen('marketplace');
      }
    } catch (error) {
      console.error('❌ MainNavigation - Error fetching listing:', error);
      setCurrentScreen('marketplace');
    }
  };

  return (
    <View key={forceUpdate} style={styles.container}>
      {renderScreen()}
      {currentScreen !== 'PostListing' && currentScreen !== 'ListingDetails' && currentScreen !== 'EditProfile' && currentScreen !== 'PaymentMethods' && currentScreen !== 'Payment' && currentScreen !== 'MyShop' && currentScreen !== 'MySales' && currentScreen !== 'MyFavorites' && currentScreen !== 'MyPassword' && currentScreen !== 'PaymentApproval' && currentScreen !== 'messages' && currentScreen !== 'Chat' && currentScreen !== 'UserProfile' && currentScreen !== 'MyPayments' && currentScreen !== 'MyAddress' && currentScreen !== 'BuyerComments' && (
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
