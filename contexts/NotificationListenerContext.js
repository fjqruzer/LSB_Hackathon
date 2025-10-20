import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import NotificationService from '../services/NotificationService';
import NotificationManager from '../services/NotificationManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const NotificationListenerContext = createContext();

export const useNotificationListener = () => {
  const context = useContext(NotificationListenerContext);
  if (!context) {
    throw new Error('useNotificationListener must be used within a NotificationListenerProvider');
  }
  return context;
};

export const NotificationListenerProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [navigationHandler, setNavigationHandler] = useState(null);
  const [processedNotificationIds, setProcessedNotificationIds] = useState(new Set());
  const [userLoginTime, setUserLoginTime] = useState(null);
  const [isProcessingNotifications, setIsProcessingNotifications] = useState(false);
  const [processingTimeout, setProcessingTimeout] = useState(null);

  // Load processed notification IDs from AsyncStorage
  const loadProcessedNotificationIds = async (userId) => {
    try {
      const key = `processed_notifications_${userId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const ids = JSON.parse(stored);
        return new Set(ids);
      }
      return new Set();
    } catch (error) {
      console.error('❌ Error loading processed notification IDs:', error);
      return new Set();
    }
  };

  // Save processed notification IDs to AsyncStorage
  const saveProcessedNotificationIds = async (userId, notificationIds) => {
    try {
      const key = `processed_notifications_${userId}`;
      const ids = Array.from(notificationIds);
      await AsyncStorage.setItem(key, JSON.stringify(ids));
    } catch (error) {
      console.error('❌ Error saving processed notification IDs:', error);
    }
  };

  // Generate a unique identifier for a notification based on its content
  const generateNotificationKey = (notification) => {
    const { title, body, data, createdAt } = notification;
    const contentKey = `${title}|${body}|${JSON.stringify(data)}|${createdAt.getTime()}`;
    return contentKey;
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setProcessedNotificationIds(new Set());
      return;
    }

    let isInitialized = false;
    let initialProcessedIds = new Set();

    // Set user login time and load processed notification IDs
    const initializeUser = async () => {
      const loginTime = new Date();
      setUserLoginTime(loginTime);
      const loadedIds = await loadProcessedNotificationIds(user.uid);
      initialProcessedIds = loadedIds;
      setProcessedNotificationIds(loadedIds);
      isInitialized = true;
    };

    initializeUser();

    // Setting up notification listener

    // Listen for notifications for this user
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      // Don't process notifications until initialization is complete
      if (!isInitialized || isProcessingNotifications) {
        return;
      }

      // Clear any existing timeout
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }

      // Debounce notification processing to prevent rapid-fire updates
      const timeoutId = setTimeout(async () => {
        setIsProcessingNotifications(true);

      try {
        const newNotifications = [];
        querySnapshot.forEach((doc) => {
          newNotifications.push({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
          });
        });

        // Sort by createdAt in descending order (newest first)
        newNotifications.sort((a, b) => b.createdAt - a.createdAt);

        // Get current processed IDs (use the most up-to-date set)
        const currentProcessedIds = await loadProcessedNotificationIds(user.uid);
        
        // Check for truly new notifications that haven't been processed yet
        // Only show notifications that:
        // 1. Haven't been processed before (not in currentProcessedIds)
        // 2. Were created after the user logged in (to avoid showing old notifications)
        // 3. Have unique content (additional deduplication)
        const processedContentKeys = new Set();
        const trulyNewNotifications = newNotifications.filter(notification => {
          const isNotProcessed = !currentProcessedIds.has(notification.id);
          const isAfterLogin = userLoginTime ? notification.createdAt > userLoginTime : true;
          const contentKey = generateNotificationKey(notification);
          const isUniqueContent = !processedContentKeys.has(contentKey);
          
          if (isUniqueContent) {
            processedContentKeys.add(contentKey);
          }
          
          return isNotProcessed && isAfterLogin && isUniqueContent;
        });

        setNotifications(newNotifications);
        setUnreadCount(newNotifications.length);

        // Process only truly new notifications
        if (trulyNewNotifications.length > 0) {
          
          // Add new notification IDs to processed set
          const newProcessedIds = new Set(currentProcessedIds);
          trulyNewNotifications.forEach(notification => {
            newProcessedIds.add(notification.id);
          });
          
          // Clean up old processed IDs (keep only last 200 to prevent memory issues)
          let cleanedIds = newProcessedIds;
          if (newProcessedIds.size > 200) {
            const processedArray = Array.from(newProcessedIds);
            const recentIds = processedArray.slice(-200);
            cleanedIds = new Set(recentIds);
          }
          
          setProcessedNotificationIds(cleanedIds);
          
          // Save to AsyncStorage asynchronously
          await saveProcessedNotificationIds(user.uid, cleanedIds);
          
          // Show local notification for each new notification
          trulyNewNotifications.forEach(notification => {
            // Only show local notification if app is in foreground
            // This prevents double notifications (in-app + local)
            const appState = AppState.currentState;
            if (appState === 'active') {
              console.log('📱 App is in foreground, showing local notification');
              // Show local notification with screen field for click handling
              NotificationService.sendLocalNotification(
                notification.title,
                notification.body,
                {
                  ...notification.data,
                  screen: notification.data.screen || 'marketplace' // Default screen
                }
              );
            } else {
              console.log('📱 App is in background, skipping local notification (push notification will show)');
            }
            
            // Note: Navigation is handled by notification click, not immediately
            // The notification click will be handled by the App-level listener
          });
        }
        } catch (error) {
          console.error('❌ Error processing notifications:', error);
        } finally {
          setIsProcessingNotifications(false);
        }
      }, 500); // 500ms debounce

      setProcessingTimeout(timeoutId);
    }, (error) => {
      console.error('❌ Error listening to notifications:', error);
      setIsProcessingNotifications(false);
    });

    return () => {
      // Cleaning up notification listener
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }
      unsubscribe();
    };
  }, [user]);

  const markAsRead = async (notificationId) => {
    try {
      
      // Mark notification as read in Firestore
      await NotificationManager.markAsRead(notificationId);
      
      // Update local state to reflect the change immediately
      setNotifications(prevNotifications => 
        prevNotifications.filter(notif => notif.id !== notificationId)
      );
      
      // Update unread count
      setUnreadCount(prevCount => Math.max(0, prevCount - 1));
      
      console.log('✅ Notification marked as read:', notificationId);
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      
      // Mark all notifications as read
      const markPromises = notifications.map(notif => 
        NotificationManager.markAsRead(notif.id)
      );
      
      await Promise.all(markPromises);
      
      // Clear local state
      setNotifications([]);
      setUnreadCount(0);
      
      console.log('✅ All notifications marked as read');
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);
    setProcessedNotificationIds(new Set());
    setUserLoginTime(null);
    setIsProcessingNotifications(false);
    
    // Clear processing timeout
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      setProcessingTimeout(null);
    }
    
    // Clear from AsyncStorage as well
    if (user) {
      try {
        const key = `processed_notifications_${user.uid}`;
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error('❌ Error clearing processed notification IDs from storage:', error);
      }
    }
  };

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    setNavigationHandler
  };

  return (
    <NotificationListenerContext.Provider value={value}>
      {children}
    </NotificationListenerContext.Provider>
  );
};
