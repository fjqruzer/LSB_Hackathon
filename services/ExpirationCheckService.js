import { AppState } from 'react-native';
import ExpirationNotificationService from './ExpirationNotificationService';

class ExpirationCheckService {
  constructor() {
    this.intervalId = null;
    this.appStateSubscription = null;
    this.isRunning = false;
    this.checkInterval = 15000; // Check every 15 seconds for more responsive notifications
    this.processedListings = new Set(); // Track processed listings to prevent duplicates
    this.isProcessing = false; // Prevent concurrent processing
    this.lastAppStateCheck = 0; // Debounce app state checks
    this.lastCheckTime = 0; // Track last check time for debugging
  }

  // Start the expiration check service
  start() {
    console.log('🚀 ExpirationCheckService.start() called');
    
    if (this.isRunning) {
      console.log('⚠️ ExpirationCheckService is already running, skipping start');
      return;
    }

    console.log('✅ Starting ExpirationCheckService...');
    this.isRunning = true;

    // Add a delay before first check to prevent processing old expired listings on app launch
    console.log('⏰ Setting up initial check in 10 seconds...');
    setTimeout(() => {
      console.log('🔍 Running initial expiration check...');
      this.checkExpiredListings();
    }, 10000); // Wait 10 seconds before first check

    // Set up interval
    console.log(`⏰ Setting up interval check every ${this.checkInterval / 1000} seconds...`);
    this.intervalId = setInterval(() => {
      console.log('⏰ Interval expiration check triggered...');
      this.checkExpiredListings();
    }, this.checkInterval);

    // Listen for app state changes
    console.log('👂 Setting up app state listener...');
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    console.log('🎉 ExpirationCheckService started successfully!');
    console.log('📊 Service status:', this.getStatus());
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
      console.log('⏭️ Expiration check already in progress, skipping...');
      return;
    }
    
    this.isProcessing = true;
    this.lastCheckTime = Date.now();
    
    try {
      console.log('🔍 Starting expiration check...');
      
      // Pass the cache by reference so it can be modified
      const expiredCount = await ExpirationNotificationService.checkExpiredListings(this.processedListings);
      
      if (expiredCount > 0) {
        console.log(`✅ Processed ${expiredCount} expired listings`);
      } else {
        console.log('✅ No expired listings found');
      }

      // Also check for payment reminders
      console.log('🔍 Checking for payment reminders...');
      const reminderCount = await ExpirationNotificationService.checkPaymentReminders();
      
      if (reminderCount > 0) {
        console.log(`✅ Sent ${reminderCount} payment reminders`);
      } else {
        console.log('✅ No payment reminders needed');
      }
      
    } catch (error) {
      console.error('❌ Error in expiration check service:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
    } finally {
      this.isProcessing = false;
      console.log(`⏰ Expiration check completed at ${new Date().toISOString()}`);
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
