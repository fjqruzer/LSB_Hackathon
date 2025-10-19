import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppState } from 'react-native';

class PresenceService {
  constructor() {
    this.currentUser = null;
    this.isOnline = false;
    this.appStateSubscription = null;
  }

  // Initialize presence tracking for a user
  async initializePresence(userId) {
    if (!userId) {
      console.log('⚠️ PresenceService: No user ID provided');
      return;
    }

    this.currentUser = userId;
    console.log('🟢 PresenceService: Initializing presence for user:', userId);

    try {
      // Set user as online
      await this.setUserOnline(userId);
      
      // Set up app state listener to handle background/foreground
      this.setupAppStateListener(userId);
      
      // Set up disconnect handler for when user closes app
      this.setupDisconnectHandler(userId);
      
    } catch (error) {
      console.error('❌ PresenceService: Error initializing presence:', error);
    }
  }

  // Set user as online
  async setUserOnline(userId) {
    if (!userId) return;

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isOnline: true,
        lastSeen: serverTimestamp(),
        presenceUpdatedAt: serverTimestamp()
      });
      
      this.isOnline = true;
      console.log('🟢 PresenceService: User set as online:', userId);
    } catch (error) {
      console.error('❌ PresenceService: Error setting user online:', error);
    }
  }

  // Set user as offline
  async setUserOffline(userId) {
    if (!userId) return;

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
        presenceUpdatedAt: serverTimestamp()
      });
      
      this.isOnline = false;
      console.log('🔴 PresenceService: User set as offline:', userId);
    } catch (error) {
      console.error('❌ PresenceService: Error setting user offline:', error);
    }
  }

  // Set up app state listener to handle background/foreground transitions
  setupAppStateListener(userId) {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('📱 PresenceService: App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        // App came to foreground - set user as online
        await this.setUserOnline(userId);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - set user as offline
        await this.setUserOffline(userId);
      }
    });

    // Also set up a cleanup handler for when the app is about to terminate
    // This is a fallback in case the normal cleanup doesn't work
    const handleBeforeUnload = () => {
      if (this.currentUser) {
        this.setUserOffline(this.currentUser);
      }
    };

    // For React Native, we can't use beforeunload, but we can use a timeout
    // to periodically check if the app is still active
    this.cleanupInterval = setInterval(async () => {
      if (this.currentUser && AppState.currentState !== 'active') {
        await this.setUserOffline(this.currentUser);
      }
    }, 30000); // Check every 30 seconds
  }

  // Set up disconnect handler for when user closes app
  setupDisconnectHandler(userId) {
    if (!userId) return;

    try {
      // Note: onDisconnect is not available in Firebase v9+ modular SDK
      // We'll rely on AppState changes and manual cleanup instead
      console.log('🔌 PresenceService: Using AppState-based disconnect handling for user:', userId);
    } catch (error) {
      console.error('❌ PresenceService: Error setting up disconnect handler:', error);
    }
  }

  // Clean up presence tracking
  async cleanup() {
    if (this.currentUser) {
      await this.setUserOffline(this.currentUser);
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.currentUser = null;
    this.isOnline = false;
    console.log('🧹 PresenceService: Cleaned up presence tracking');
  }

  // Get current presence status
  getPresenceStatus() {
    return {
      isOnline: this.isOnline,
      userId: this.currentUser
    };
  }

  // Manually update presence (for testing or manual control)
  async updatePresence(userId, isOnline) {
    if (isOnline) {
      await this.setUserOnline(userId);
    } else {
      await this.setUserOffline(userId);
    }
  }
}

export default new PresenceService();
