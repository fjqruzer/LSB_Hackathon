import { Vibration, Alert, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

class ActionAlertService {
  constructor() {
    this.isEnabled = true;
    this.alertSettings = {
      sound: true,
      vibration: true,
      visual: true,
    };
  }

  // Initialize the service
  async initialize() {
    try {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permission not granted');
      }
    } catch (error) {
      console.error('Error initializing ActionAlertService:', error);
    }
  }

  // Play alert sound (using system sound)
  async playAlertSound() {
    if (!this.alertSettings.sound) return;

    try {
      // Use system sound through notifications
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Action Alert!',
          body: 'Someone performed an action!',
          sound: true,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Error playing alert sound:', error);
    }
  }

  // Trigger vibration
  triggerVibration() {
    if (!this.alertSettings.vibration) return;

    try {
      // Different vibration patterns for different actions
      Vibration.vibrate([0, 200, 100, 200]);
    } catch (error) {
      console.error('Error triggering vibration:', error);
    }
  }

  // Show visual alert
  showVisualAlert(actionType, listingTitle, actionPrice) {
    if (!this.alertSettings.visual) return;

    const actionMessages = {
      'mine': 'Someone Mined the item!',
      'steal': 'Someone Stole the item!',
      'lock': 'Someone Locked the item!',
      'bid': 'Someone placed a higher bid!',
    };

    const actionEmojis = {
      'mine': '⛏️',
      'steal': '🏃‍♂️',
      'lock': '🔒',
      'bid': '💰',
    };

    const message = actionMessages[actionType] || 'Someone performed an action!';
    const emoji = actionEmojis[actionType] || '⚡';

    // Use setTimeout to prevent state updates during rendering
    setTimeout(() => {
      Alert.alert(
        `${emoji} Action Alert!`,
        `${message}\n\nItem: ${listingTitle}\nPrice: ₱${actionPrice?.toLocaleString() || '0'}\n\nHurry up before it's too late!`,
        [
          {
            text: 'OK',
            style: 'default',
          },
        ],
        { cancelable: true }
      );
    }, 0);
  }

  // Send push notification
  async sendPushNotification(actionType, listingTitle, actionPrice, listingId) {
    try {
      // Only send local notification if app is in foreground
      // This prevents double notifications (in-app + local)
      const appState = AppState.currentState;
      if (appState !== 'active') {
        console.log('📱 App is not in foreground, skipping action alert notification');
        return;
      }

      const actionMessages = {
        'mine': '⛏️ Someone Mined the item!',
        'steal': '🏃‍♂️ Someone Stole the item!',
        'lock': '🔒 Someone Locked the item!',
        'bid': '💰 Someone placed a higher bid!',
      };

      const message = actionMessages[actionType] || '⚡ Someone performed an action!';

      console.log('📱 App is in foreground, showing action alert notification');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Action Alert!',
          body: `${message}\n${listingTitle} - ₱${actionPrice?.toLocaleString() || '0'}`,
          data: {
            listingId,
            actionType,
            actionPrice,
          },
          sound: true,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Main alert function that combines all alert types
  async triggerActionAlert(actionType, listingTitle, actionPrice, listingId) {
    if (!this.isEnabled) return;

    console.log(`🚨 Action Alert: ${actionType} on ${listingTitle} for ₱${actionPrice}`);

    // Play sound
    await this.playAlertSound();

    // Trigger vibration
    this.triggerVibration();

    // Show visual alert
    this.showVisualAlert(actionType, listingTitle, actionPrice);

    // Send push notification
    await this.sendPushNotification(actionType, listingTitle, actionPrice, listingId);
  }

  // Update alert settings
  updateSettings(settings) {
    this.alertSettings = { ...this.alertSettings, ...settings };
  }

  // Enable/disable alerts
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  // Cleanup
  async cleanup() {
    // No cleanup needed for system sounds
  }
}

export default new ActionAlertService();
