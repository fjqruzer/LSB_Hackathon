import { AppState } from 'react-native';
import ExpirationNotificationService from './ExpirationNotificationService';

class ExpirationCheckService {
  constructor() {
    this.intervalId = null;
    this.appStateSubscription = null;
    this.isRunning = false;
    this.checkInterval = 30000; // Check every 30 seconds to prevent race conditions
    this.processedListings = new Set(); // Track processed listings to prevent duplicates
    this.isProcessing = false; // Prevent concurrent processing
    this.lastAppStateCheck = 0; // Debounce app state checks
  }

  // Start the expiration check service
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Add a delay before first check to prevent processing old expired listings on app launch
    setTimeout(() => {
      this.checkExpiredListings();
    }, 10000); // Wait 10 seconds before first check

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkExpiredListings();
    }, this.checkInterval);

    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  // Stop the expiration check service
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  // Handle app state changes
  handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active' && this.isRunning) {
      // Debounce app state checks - only check if it's been more than 5 seconds since last check
      const now = Date.now();
      if (now - this.lastAppStateCheck > 5000) {
        this.lastAppStateCheck = now;
        // App became active, check immediately for any missed expirations
        this.checkExpiredListings();
      }
    }
  };

  // Check for expired listings
  async checkExpiredListings() {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Pass the cache by reference so it can be modified
      const expiredCount = await ExpirationNotificationService.checkExpiredListings(this.processedListings);

      // Also check for payment reminders
      await ExpirationNotificationService.checkPaymentReminders();
    } catch (error) {
      console.error('❌ Error in expiration check service:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      intervalId: this.intervalId
    };
  }
}

export default new ExpirationCheckService();
