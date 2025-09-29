import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Check if we're running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
  }

  // Register for push notifications
  async registerForPushNotificationsAsync() {
    // Registering for push notifications

    let token;

    if (Platform.OS === 'android') {
      // Setting up Android notification channel
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Always try to get permissions for local notifications
    // Checking notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      // Requesting notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // Notification permission status
    
    if (finalStatus !== 'granted') {
      return null;
    }
    
    // Try to get push token only on physical devices
    if (Device.isDevice && !isExpoGo) {
      try {
        // Attempting to get push token
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig.extra.eas.projectId,
        })).data;
        this.expoPushToken = token;
        // Push token obtained
      } catch (error) {
        // Failed to get push token
        // Don't return null here, local notifications can still work
      }
    } else {
      // Running in simulator or Expo Go - push tokens not available
    }

    // Return token - will be saved to user profile by calling component

    // Return token or a placeholder to indicate permissions are granted
    return token || 'local-notifications-enabled';
  }

  // Save push token to user profile
  async savePushTokenToUser(token) {
    try {
      // Get current user from auth context
      const { useAuth } = await import('../contexts/AuthContext');
      // This is a bit tricky since we can't use hooks here
      // We'll need to pass the user ID from the calling component
      return null;
    } catch (error) {
      console.error('❌ Error saving push token:', error);
      return null;
    }
  }

  // Send local notification
  async sendLocalNotification(title, body, data = {}) {
    try {
      // Scheduling local notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // Show immediately
      });
      // Local notification scheduled
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling local notification:', error);
      throw error;
    }
  }

  // Send push notification via Expo's push service
  async sendPushNotification(expoPushToken, title, body, data = {}) {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  // Get the current push token
  getExpoPushToken() {
    return this.expoPushToken;
  }

  // Get current notification permissions
  async getPermissionsAsync() {
    return await Notifications.getPermissionsAsync();
  }

  // Listen for notification responses
  addNotificationReceivedListener(listener) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  // Listen for notification interactions
  addNotificationResponseReceivedListener(listener) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  // Remove all listeners
  removeAllListeners() {
    if (isExpoGo) {
      return;
    }
    Notifications.removeAllNotificationListeners();
  }

  // Send notifications to multiple users
  async sendNotificationsToUsers(userIds, title, body, data = {}) {
    try {
      // This would typically fetch user push tokens from your backend
      // For now, we'll send local notifications to all users
      const notifications = userIds.map(userId => 
        this.sendLocalNotification(title, body, { ...data, userId })
      );
      
      await Promise.all(notifications);
      return true;
    } catch (error) {
      console.error('Error sending notifications to users:', error);
      return false;
    }
  }

  // Send push notifications to multiple tokens
  async sendPushNotificationsToTokens(tokens, title, body, data = {}) {
    try {
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data,
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending push notifications to tokens:', error);
      throw error;
    }
  }
}

export default new NotificationService();