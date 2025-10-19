import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import NotificationService from './NotificationService';
import { AppState } from 'react-native';

class NotificationManager {
  // Store notification in Firestore and send push notification
  async createNotification(recipientId, title, body, data = {}) {
    try {
      console.log('🔔 NotificationManager.createNotification called for user:', recipientId, 'title:', title);
      
      // Simple duplicate check - just check by recipient and type (no index needed)
      if (data.type && data.listingId) {
        const duplicateQuery = query(
          collection(db, 'notifications'),
          where('recipientId', '==', recipientId),
          where('data.type', '==', data.type)
        );
        
        const duplicateSnapshot = await getDocs(duplicateQuery);
        // Check if any recent notification exists (client-side filtering)
        const recentNotifications = duplicateSnapshot.docs.filter(doc => {
          const docData = doc.data();
          const createdAt = docData.createdAt?.toDate();
          const oneMinuteAgo = new Date(Date.now() - (1 * 60 * 1000)); // Reduced to 1 minute
          return createdAt && createdAt >= oneMinuteAgo && docData.data?.listingId === data.listingId;
        });
        
        if (recentNotifications.length > 0) {
          console.log('⏭️ Duplicate notification prevented for user:', recipientId, 'type:', data.type, 'listing:', data.listingId);
          return null;
        }
        
        // Additional check: look for exact same notification content within last 30 seconds
        const exactDuplicateCheck = recentNotifications.filter(doc => {
          const docData = doc.data();
          const createdAt = docData.createdAt?.toDate();
          const thirtySecondsAgo = new Date(Date.now() - (30 * 1000));
          return createdAt && createdAt >= thirtySecondsAgo && 
                 docData.title === title && 
                 docData.body === body;
        });
        
        if (exactDuplicateCheck.length > 0) {
          console.log('⏭️ Exact duplicate notification prevented (same title/body):', title);
          return null;
        }
      }
      
      const notification = {
        recipientId,
        title,
        body,
        data,
        read: false,
        createdAt: serverTimestamp(),
        type: data.type || 'general'
      };
      
      // Store notification in Firestore
      const docRef = await addDoc(collection(db, 'notifications'), notification);
      console.log('✅ Notification stored in Firestore:', docRef.id);
      
      // Only send push notification if app is in background/closed
      // This prevents double notifications (in-app + push)
      const appState = AppState.currentState;
      if (appState === 'background' || appState === 'inactive') {
        console.log('📱 App is in background/inactive, sending push notification');
        await this.sendPushNotificationToUser(recipientId, title, body, data);
      } else {
        console.log('📱 App is in foreground, skipping push notification (in-app notification will show)');
      }
      
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  // Get notifications for a specific user
  async getUserNotifications(userId) {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', userId),
        where('read', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const notifications = [];
      
      querySnapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
        });
      });
      
      return notifications.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('❌ Error getting user notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  }

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
      
      const actionEmojis = {
        'Mined': '⛏️',
        'Stole': '⚡',
        'Locked': '🔒',
        'Bid': '💰'
      };
      
      const emoji = actionEmojis[actionType] || '📢';
      const title = `${emoji} Someone ${actionType} Your Listing!`;
      const body = `${actorName} ${actionType.toLowerCase()}${actionType === 'Bid' ? ' ₱' + price : ' for ₱' + price} on "${listing.title}"`;
      
      // Create notification in Firestore and send push notification
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

  // Send notification to participants about listing action
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
      
      // Create notifications for all participants (includes push notifications)
      for (const participantId of filteredParticipants) {
        await this.createNotification(participantId, title, body, {
          listingId,
          action: actionType,
          screen: 'listing_details',
          type: 'listing_action'
        });
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
      if (listing.sellerId !== excludeUserId) {
        const title = '💰 New Bid on Your Listing!';
        const body = `🎉 ${bidderName} bid ₱${bidAmount} on "${listing.title}" - the competition is heating up!`;
        
        await this.createNotification(listing.sellerId, title, body, {
          listingId,
          action: 'Bid',
          screen: 'listing_details',
          type: 'new_bid'
        });
        
        } else {
        }
      
      // Notify other bidders
      const participants = await this.getListingParticipants(listingId);
      const filteredParticipants = participants.filter(id => id !== excludeUserId && id !== listing.sellerId);
      if (filteredParticipants.length > 0) {
        const title = `💰 New Bid on "${listing.title}"!`;
        const body = `🚨 ${bidderName} bid ₱${bidAmount}! Don't let them win - place a higher bid now!`;
        
        for (const participantId of filteredParticipants) {
          await this.createNotification(participantId, title, body, {
            listingId,
            action: 'Bid',
            screen: 'listing_details',
            type: 'new_bid'
          });
        }
        
        } else {
        }
      
    } catch (error) {
      console.error('❌ Error notifying new bid:', error);
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
      
      const participantArray = Array.from(participants);
      return participantArray;
    } catch (error) {
      console.error('❌ Error getting listing participants:', error);
      return [];
    }
  }

  // Send push notification to a specific user
  async sendPushNotificationToUser(userId, title, body, data = {}) {
    try {
      console.log('📱 Sending push notification to user:', userId);
      
      // Get user's push token
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        console.log('❌ User not found:', userId);
        return false;
      }
      
      const userData = userDoc.data();
      const pushToken = userData.pushToken;
      
      if (!pushToken || pushToken === 'No token') {
        console.log('❌ No valid push token for user:', userId, 'Token:', pushToken);
        return false;
      }
      
      if (pushToken === 'local-notifications-enabled') {
        console.log('⚠️ User has local notifications only (Expo Go/Simulator):', userId);
        return false;
      }
      
      console.log('📱 Sending push notification via Expo service to token:', pushToken, 'title:', title);
      
      // Send push notification via Expo's service
      const result = await NotificationService.sendPushNotification(pushToken, title, body, data);
      console.log('✅ Push notification sent successfully:', result);
      
      return true;
    } catch (error) {
      console.error('❌ Error sending push notification to user:', error);
      return false;
    }
  }

  // Send push notifications to multiple users
  async sendPushNotificationsToUsers(userIds, title, body, data = {}) {
    try {
      console.log('📱 Sending push notifications to multiple users:', userIds.length);
      
      const results = [];
      for (const userId of userIds) {
        const result = await this.sendPushNotificationToUser(userId, title, body, data);
        results.push({ userId, success: result });
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`✅ Push notifications sent: ${successCount}/${userIds.length} successful`);
      
      return results;
    } catch (error) {
      console.error('❌ Error sending push notifications to users:', error);
      return [];
    }
  }

  // Get push tokens for multiple users
  async getUserPushTokens(userIds) {
    try {
      console.log('🔍 Getting push tokens for users:', userIds.length);
      
      const tokens = [];
      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const pushToken = userData.pushToken;
          
          if (pushToken && pushToken !== 'No token' && pushToken !== 'local-notifications-enabled') {
            tokens.push(pushToken);
          }
        }
      }
      
      console.log(`✅ Found ${tokens.length} valid push tokens out of ${userIds.length} users`);
      return tokens;
    } catch (error) {
      console.error('❌ Error getting user push tokens:', error);
      return [];
    }
  }
}

export default new NotificationManager();
