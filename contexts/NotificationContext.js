import React, { createContext, useContext, useEffect, useState } from 'react';
import NotificationService from '../services/NotificationService';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [navigationHandler, setNavigationHandler] = useState(null);

  useEffect(() => {
    // Set up notification listeners
    const notificationListener = NotificationService.addNotificationReceivedListener(notification => {
      // Handle notification received while app is in foreground
    });

    const responseListener = NotificationService.addNotificationResponseReceivedListener(response => {
      // Handle notification tap here
      const data = response.notification.request.content.data;
      
      if (data && navigationHandler) {
        navigationHandler(data);
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [navigationHandler]);

  // Notification functions
  const sendLocalNotification = async (title, body, data = {}) => {
    try {
      await NotificationService.sendLocalNotification(title, body, data);
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  };

  const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
    try {
      return await NotificationService.sendPushNotification(expoPushToken, title, body, data);
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  };

  const getExpoPushToken = () => {
    return NotificationService.getExpoPushToken();
  };

  // App-specific notification functions
  const notifyNewListing = async (listingTitle, sellerName) => {
    await sendLocalNotification(
      'New Listing Available!',
      `${sellerName} posted "${listingTitle}"`,
      { screen: 'marketplace', type: 'new_listing' }
    );
  };

  const notifyListingSold = async (listingTitle, buyerName) => {
    await sendLocalNotification(
      'Listing Sold!',
      `Your listing "${listingTitle}" was sold to ${buyerName}`,
      { screen: 'profile', type: 'listing_sold' }
    );
  };

  const notifyNewMessage = async (senderName, message) => {
    await sendLocalNotification(
      `New message from ${senderName}`,
      message,
      { screen: 'messages', type: 'new_message' }
    );
  };

  const notifyPriceDrop = async (listingTitle, oldPrice, newPrice) => {
    await sendLocalNotification(
      'Price Drop Alert!',
      `"${listingTitle}" price dropped from ₱${oldPrice} to ₱${newPrice}`,
      { screen: 'marketplace', type: 'price_drop' }
    );
  };

  const notifyListingAction = async (actionType, listingTitle, actorName, price) => {
    const actionEmojis = {
      'Mined': '⛏️',
      'Stole': '⚡',
      'Locked': '🔒',
      'Bid': '💰'
    };
    
    const emoji = actionEmojis[actionType] || '📢';
    
    await sendLocalNotification(
      `${emoji} ${actionType} Action!`,
      `${actorName} ${actionType.toLowerCase()}${actionType === 'Bid' ? ' ₱' + price : ' for ₱' + price} on "${listingTitle}"`,
      { screen: 'marketplace', type: 'listing_action', action: actionType }
    );
  };

  const notifyNewBid = async (listingTitle, bidderName, bidAmount) => {
    await sendLocalNotification(
      '💰 New Bid!',
      `${bidderName} bid ₱${bidAmount} on "${listingTitle}"`,
      { screen: 'marketplace', type: 'new_bid' }
    );
  };

  const notifyListingActionToSeller = async (listingId, actionType, actorName, price) => {
    // This function will be used by the ListingNotificationService
    // It's here for consistency with the notification context pattern
    };

  const notifyListingActionToParticipants = async (listingId, actionType, actorName, price, excludeUserId) => {
    // This function will be used by the ListingNotificationService
    // It's here for consistency with the notification context pattern
    };

  const value = {
    sendLocalNotification,
    sendPushNotification,
    getExpoPushToken,
    notifyNewListing,
    notifyListingSold,
    notifyNewMessage,
    notifyPriceDrop,
    notifyListingAction,
    notifyNewBid,
    notifyListingActionToSeller,
    notifyListingActionToParticipants,
    setNavigationHandler,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
