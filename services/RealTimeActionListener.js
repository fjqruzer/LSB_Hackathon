import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class RealTimeActionListener {
  constructor() {
    this.listeners = new Map(); // Map of listingId -> unsubscribe function
    this.userInterests = new Map(); // Map of userId -> Set of listingIds they're interested in
    this.currentUserId = null;
  }

  // Set the current user
  setCurrentUser(userId) {
    this.currentUserId = userId;
  }

  // Add a listing to the user's interests (when they view a listing)
  addListingInterest(listingId) {
    if (!this.currentUserId) return;

    if (!this.userInterests.has(this.currentUserId)) {
      this.userInterests.set(this.currentUserId, new Set());
    }

    const userInterests = this.userInterests.get(this.currentUserId);
    userInterests.add(listingId);

    // Start listening to this listing if not already listening
    if (!this.listeners.has(listingId)) {
      this.startListeningToListing(listingId);
    }
  }

  // Remove a listing from the user's interests
  removeListingInterest(listingId) {
    if (!this.currentUserId) return;

    const userInterests = this.userInterests.get(this.currentUserId);
    if (userInterests) {
      userInterests.delete(listingId);
    }

    // If no users are interested in this listing, stop listening
    const hasAnyInterest = Array.from(this.userInterests.values()).some(
      interests => interests.has(listingId)
    );

    if (!hasAnyInterest && this.listeners.has(listingId)) {
      this.stopListeningToListing(listingId);
    }
  }

  // Start listening to actions on a specific listing
  startListeningToListing(listingId) {
    if (this.listeners.has(listingId)) return;

    console.log(`🎧 Starting to listen to actions on listing: ${listingId}`);

    const activityLogsRef = collection(db, 'activityLogs');
    const q = query(
      activityLogsRef,
      where('listingId', '==', listingId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const actionData = change.doc.data();
          this.handleNewAction(listingId, actionData);
        }
      });
    }, (error) => {
      console.error('Error listening to listing actions:', error);
    });

    this.listeners.set(listingId, unsubscribe);
  }

  // Stop listening to a specific listing
  stopListeningToListing(listingId) {
    const unsubscribe = this.listeners.get(listingId);
    if (unsubscribe) {
      console.log(`🔇 Stopping to listen to listing: ${listingId}`);
      unsubscribe();
      this.listeners.delete(listingId);
    }
  }

  // Handle a new action on a listing
  async handleNewAction(listingId, actionData) {
    // Skip if this action was performed by the current user
    if (actionData.userId === this.currentUserId) {
      return;
    }

    // Check if current user is interested in this listing
    if (!this.isUserInterestedInListing(listingId)) {
      return;
    }

    // Get listing details for the alert
    try {
      const listingRef = doc(db, 'listings', listingId);
      const listingDoc = await getDoc(listingRef);
      
      if (!listingDoc.exists()) {
        console.log('Listing not found for action alert');
        return;
      }

      const listingData = listingDoc.data();
      const actionType = this.mapActionType(actionData.action);
      const actionPrice = actionData.price || actionData.amount || 0;

      // Action alert removed - no longer showing alerts for actions
      console.log('🔇 Action alert disabled for:', actionType, 'on', listingData.title);

    } catch (error) {
      console.error('Error handling new action:', error);
    }
  }

  // Check if current user is interested in a listing
  isUserInterestedInListing(listingId) {
    if (!this.currentUserId) return false;

    const userInterests = this.userInterests.get(this.currentUserId);
    return userInterests ? userInterests.has(listingId) : false;
  }

  // Map action types to our alert system
  mapActionType(action) {
    const actionMap = {
      'Mined': 'mine',
      'Stole': 'steal',
      'Locked': 'lock',
      'Bid': 'bid',
    };

    return actionMap[action] || 'unknown';
  }

  // Clean up all listeners
  cleanup() {
    console.log('🧹 Cleaning up all action listeners');
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
    this.userInterests.clear();
  }

  // Get current listening status
  getStatus() {
    return {
      listeningToListings: Array.from(this.listeners.keys()),
      userInterests: this.currentUserId ? 
        Array.from(this.userInterests.get(this.currentUserId) || []) : [],
    };
  }
}

export default new RealTimeActionListener();
