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
    console.log('📱 Registering for push notifications...');
    let token;

    if (Platform.OS === 'android') {
      console.log('📱 Setting up Android notification channel...');
      // Setting up Android notification channel
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Always try to get permissions for local notifications
    console.log('📱 Checking notification permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    console.log('🔐 Current notification permission status:', existingStatus);
    
    if (existingStatus !== 'granted') {
      console.log('🔐 Requesting notification permissions...');
      // Requesting notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('🔐 New notification permission status:', finalStatus);
    }
    
    console.log('📱 Final notification permission status:', finalStatus);
    
    if (finalStatus !== 'granted') {
      console.log('❌ Notification permissions not granted');
      return 'no-permissions';
    }
    
    // Try to get push token - improved logic for standalone builds
    console.log('📱 Device info:', {
      isDevice: Device.isDevice,
      isExpoGo: isExpoGo,
      appOwnership: Constants.appOwnership,
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
      expoConfig: Constants.expoConfig
    });

    // Always try to get push token if we have a project ID (standalone builds)
    if (Constants.expoConfig?.extra?.eas?.projectId) {
      try {
        console.log('📱 Attempting to get push token for standalone build...');
        console.log('📱 Project ID:', Constants.expoConfig.extra.eas.projectId);
        
        const pushTokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig.extra.eas.projectId,
        });
        
        token = pushTokenResponse.data;
        this.expoPushToken = token;
        console.log('✅ Push token obtained successfully:', token);
        console.log('✅ Push token type:', typeof token);
        console.log('✅ Push token length:', token ? token.length : 'null');
        
        // Validate token format
        if (token && token.startsWith('ExponentPushToken[') && token.endsWith(']')) {
          console.log('✅ Push token format is valid');
        } else {
          console.log('⚠️ Push token format may be invalid:', token);
        }
        
      } catch (error) {
        console.log('❌ Failed to get push token with project ID:', error);
        console.log('❌ Error details:', {
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        
        // Check if it's a permission error
        if (error.code === 'E_PERMISSION_DENIED') {
          console.log('❌ Permission denied for push notifications');
          return 'no-permissions';
        }
        
        // Check if it's a device error
        if (error.code === 'E_DEVICE_NOT_SUPPORTED') {
          console.log('❌ Device not supported for push notifications');
          return 'device-not-supported';
        }
        
        // If we're in a standalone build but can't get token, still try without project ID
        if (!isExpoGo && Device.isDevice) {
          console.log('🔄 Retrying push token registration without project ID...');
          try {
            const retryResponse = await Notifications.getExpoPushTokenAsync();
            token = retryResponse.data;
            this.expoPushToken = token;
            console.log('✅ Push token obtained on retry:', token);
          } catch (retryError) {
            console.log('❌ Retry also failed:', retryError);
            console.log('❌ Retry error details:', {
              message: retryError.message,
              code: retryError.code
            });
            
            // Return specific error codes
            if (retryError.code === 'E_PERMISSION_DENIED') {
              return 'no-permissions';
            } else if (retryError.code === 'E_DEVICE_NOT_SUPPORTED') {
              return 'device-not-supported';
            } else {
              return 'push-token-failed';
            }
          }
        } else {
          return 'push-token-failed';
        }
      }
    } else if (isExpoGo) {
      console.log('⚠️ Running in Expo Go - using local notifications only');
      console.log('💡 To test push notifications, build a standalone APK');
      return 'expo-go-mode';
    } else {
      console.log('⚠️ No project ID found - push tokens not available');
      console.log('⚠️ Constants.expoConfig:', Constants.expoConfig);
      console.log('⚠️ EAS project ID:', Constants.expoConfig?.extra?.eas?.projectId);
      return 'no-project-id';
    }

    // Return token - will be saved to user profile by calling component
    const resultToken = token || 'push-token-failed';
    console.log('📱 Final token result:', resultToken);
    console.log('📱 Token is valid push token:', resultToken && resultToken.startsWith('ExponentPushToken['));
    return resultToken;
  }

  // Save push token to user profile
  async savePushTokenToUser(token, userId) {
    try {
      if (!userId) {
        console.log('⚠️ No user ID provided for saving push token');
        return null;
      }

      console.log('💾 Saving push token to user profile:', userId);
      
      // Update user document with push token
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pushToken: token,
        lastTokenUpdate: new Date().toISOString()
      });
      
      console.log('✅ Push token saved successfully for user:', userId);
      return true;
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
    console.log('📱 NotificationService.sendPushNotification called with title:', title, 'token:', expoPushToken);
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
      console.log('📱 Expo push service response:', result);
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