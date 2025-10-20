import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class ListingNotificationService {
  // Create a notification in the database
  async createNotification(recipientId, title, body, data = {}) {
    try {
      const notificationData = {
        recipientId,
        title,
        body,
        data,
        createdAt: new Date(),
        read: false
      };
      
      
      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  // Get all users who have performed actions on a listing
  async getListingParticipants(listingId) {
    try {
      // Get all activity logs for this listing
      const activityQuery = query(
        collection(db, 'activityLogs'),
        where('listingId', '==', listingId)
      );
      
      const activitySnapshot = await getDocs(activityQuery);
      const participants = new Set();
      
      activitySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId) {
          participants.add(data.userId);
        }
      });
      
      return Array.from(participants);
    } catch (error) {
      console.error('Error getting listing participants:', error);
      return [];
    }
  }

  // Push tokens are now handled by NotificationListenerContext

  // Send notification to seller about listing action
  async notifySeller(listingId, actionType, actorName, price, excludeUserId = null) {
    try {
      // Get listing details
      const listingDoc = await getDoc(doc(db, 'listings', listingId));
      if (!listingDoc.exists()) {
        return;
      }

      const listing = listingDoc.data();
      // Don't notify seller if they are the one performing the action
      if (excludeUserId && listing.sellerId === excludeUserId) {
        return;
      }
      
      // Push tokens are handled by NotificationListenerContext
      
      const actionEmojis = {
        'Mined': '⛏️',
        'Stole': '⚡',
        'Locked': '🔒',
        'Bid': '💰'
      };
      
      const emoji = actionEmojis[actionType] || '📢';
      const title = `${emoji} Someone ${actionType} Your Listing!`;
      const body = `${actorName} ${actionType.toLowerCase()}${actionType === 'Bid' ? ' ₱' + price : ' for ₱' + price} on "${listing.title}"`;
      
      // Note: Local notifications are handled by the notification listener context
      // Create database notification for seller
      await this.createNotification(listing.sellerId, title, body, {
        listingId,
        action: actionType,
        screen: 'listing_details',
        type: 'listing_action'
      });
    } catch (error) {
      console.error('❌ Error notifying seller:', error);
    }
  }

  // Send notification to other participants about listing action
  async notifyParticipants(listingId, actionType, actorName, price, excludeUserId) {
    try {
      // Get listing details
      const listingDoc = await getDoc(doc(db, 'listings', listingId));
      if (!listingDoc.exists()) {
        return;
      }

      const listing = listingDoc.data();
      // Get all participants except the current actor
      const participants = await this.getListingParticipants(listingId);
      const filteredParticipants = participants.filter(id => id !== excludeUserId);
      if (filteredParticipants.length === 0) {
        return;
      }
      
      const actionEmojis = {
        'Mined': '⛏️',
        'Stole': '⚡',
        'Locked': '🔒',
        'Bid': '💰'
      };
      
      const emoji = actionEmojis[actionType] || '📢';
      
      // Create urgency-driven messages for participants
      let title, body;
      
      switch (actionType) {
        case 'Mined':
          title = `⛏️ Someone Mined "${listing.title}"!`;
          body = `🚨 ${actorName} mined for ₱${price}! Don't let them take it - act now!`;
          break;
        case 'Stole':
          title = `⚡ Someone Stole "${listing.title}"!`;
          body = `🔥 ${actorName} stole for ₱${price}! They're ahead - you need to act fast!`;
          break;
        case 'Locked':
          title = `🔒 Someone Locked "${listing.title}"!`;
          body = `🔒 ${actorName} locked for ₱${price}! The listing is now closed and no longer available.`;
          break;
        case 'Bid':
          title = `💰 New Bid on "${listing.title}"!`;
          body = `📈 ${actorName} bid ₱${price}! Outbid them to secure your chance!`;
          break;
        default:
          title = `${emoji} Action on "${listing.title}"`;
          body = `${actorName} ${actionType.toLowerCase()}${actionType === 'Bid' ? ' ₱' + price : ' for ₱' + price}`;
      }
      
      // Push tokens are handled by NotificationListenerContext
      
      // Create database notifications for all participants
      for (const participantId of filteredParticipants) {
        try {
          await this.createNotification(participantId, title, body, {
          listingId,
          action: actionType,
            screen: 'listing_details',
            type: 'participant_action'
          });
          } catch (error) {
          console.error(`❌ Error creating database notification for participant ${participantId}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error notifying participants:', error);
    }
  }

  // Send notification for new bid
  async notifyNewBid(listingId, bidderName, bidAmount, excludeUserId) {
    try {
      // Get listing details
      const listingDoc = await getDoc(doc(db, 'listings', listingId));
      if (!listingDoc.exists()) {
        return;
      }

      const listing = listingDoc.data();
      // Notify seller
      // Push tokens are handled by NotificationListenerContext
      
      if (listing.sellerId !== excludeUserId) {
        const title = '💰 New Bid on Your Listing!';
        const body = `${bidderName} bid ₱${bidAmount} on "${listing.title}"`;
        
        // Create database notification for seller
        await this.createNotification(listing.sellerId, title, body, {
          listingId,
          action: 'Bid',
          screen: 'listing_details',
          type: 'new_bid'
        });
        // Database notification already created above
      } else {
      }
      
      // Notify other bidders
      const participants = await this.getListingParticipants(listingId);
      const filteredParticipants = participants.filter(id => id !== excludeUserId && id !== listing.sellerId);
      if (filteredParticipants.length > 0) {
        const title = `💰 New Bid on "${listing.title}"`;
        const body = `${bidderName} bid ₱${bidAmount}`;
        
        // Push tokens are handled by NotificationListenerContext
        
        // Create database notifications for all participants
        for (const participantId of filteredParticipants) {
          try {
            await this.createNotification(participantId, title, body, {
            listingId,
            action: 'Bid',
              screen: 'listing_details',
              type: 'new_bid'
          });
            } catch (error) {
            console.error(`❌ Error creating database notification for participant ${participantId}:`, error);
          }
        }
        } else {
      }
    } catch (error) {
      console.error('❌ Error notifying new bid:', error);
    }
  }
}

export default new ListingNotificationService();