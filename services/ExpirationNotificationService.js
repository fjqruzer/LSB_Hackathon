import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import NotificationManager from './NotificationManager';
import NotificationService from './NotificationService';
import PaymentTimeoutService from './PaymentTimeoutService';

class ExpirationNotificationService {
  constructor() {
    this.processingListings = new Set(); // Track listings currently being processed
  }

  // Check for expired listings and notify winners
  async checkExpiredListings(processedListings = new Set()) {
    try {
      // Checking for expired listings
      const now = new Date();
      const listingsRef = collection(db, 'listings');
      
      // Get all active listings first, then filter by expiration
      const q = query(
        listingsRef,
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      const expiredListings = [];
      
      querySnapshot.forEach((doc) => {
        const listing = { id: doc.id, ...doc.data() };
        
        // Skip if already processed
        if (processedListings.has(listing.id)) {
          return;
        }
        
        // Skip if currently being processed
        if (this.processingListings.has(listing.id)) {
          return;
        }
        
        // Check if listing has expired
        if (listing.endDateTime) {
          let endTime;
          
          // Handle different date formats from Firebase
          if (listing.endDateTime.toDate && typeof listing.endDateTime.toDate === 'function') {
            endTime = listing.endDateTime.toDate();
          } else if (listing.endDateTime instanceof Date) {
            endTime = listing.endDateTime;
          } else if (typeof listing.endDateTime === 'string') {
            endTime = new Date(listing.endDateTime);
          } else if (listing.endDateTime.seconds) {
            endTime = new Date(listing.endDateTime.seconds * 1000);
          } else {
            endTime = new Date(listing.endDateTime);
          }
          
          if (!isNaN(endTime.getTime()) && endTime <= now) {
            expiredListings.push(listing);
          }
        }
      });
      
      // Process each expired listing
      for (const listing of expiredListings) {
        // Mark as processed before processing
        processedListings.add(listing.id);
        
        await this.processExpiredListing(listing);
      }
      
      return expiredListings.length;
    } catch (error) {
      console.error('❌ Error checking expired listings:', error);
      throw error;
    }
  }

  // Process a single expired listing
  async processExpiredListing(listing) {
    try {
      // Check if this listing is already being processed
      if (this.processingListings.has(listing.id)) {
        return;
      }
      
      // Mark as being processed
      this.processingListings.add(listing.id);
      
      // Double-check if this listing has already been processed by looking for activity logs
      const activityQuery = query(
        collection(db, 'activityLogs'),
        where('listingId', '==', listing.id),
        where('action', '==', 'Listing Expired - Winner')
      );
      
      const activitySnapshot = await getDocs(activityQuery);
      if (!activitySnapshot.empty) {
        this.processingListings.delete(listing.id);
        return; // Skip processing if already done
      }
      
      // Additional check: look for any existing notifications for this listing
      const notificationQuery = query(
        collection(db, 'notifications'),
        where('data.listingId', '==', listing.id),
        where('data.type', 'in', ['payment_required', 'winner_determined', 'listing_expired_lost'])
      );
      
      const notificationSnapshot = await getDocs(notificationQuery);
      if (!notificationSnapshot.empty) {
        console.log(`⏭️ Skipping listing ${listing.id} - notifications already exist`);
        this.processingListings.delete(listing.id);
        return; // Skip processing if notifications already exist
      }
      
      // Determine the winner based on action type
      const winner = await this.determineWinner(listing);
      
      if (winner && winner.userId && winner.userName) {
        // Update listing status to expired with winner info
        await this.updateListingStatus(listing.id, 'expired', winner);
        // Notify the winner to proceed to payment
        await this.notifyWinnerToPay(listing, winner);
        // Notify seller about the winner
        await this.notifySellerAboutWinner(listing, winner);
        // Notify all participants about the expiration
        await this.notifyAllParticipants(listing, winner);
        // Create activity log
        await this.createActivityLog(listing, winner);
        } else {
        // No winner found, update status and notify seller
        await this.updateListingStatus(listing.id, 'expired');
        // Notify seller about no winner
        await this.notifySellerNoWinner(listing);
        }
      
      } catch (error) {
      console.error(`❌ ERROR PROCESSING EXPIRED LISTING: ${listing.id}`);
      console.error(`❌ Error details:`, error);
    } finally {
      // Always remove from processing list
      this.processingListings.delete(listing.id);
    }
  }

  // Update listing status
  async updateListingStatus(listingId, status, winner = null) {
    const listingRef = doc(db, 'listings', listingId);
    const updateData = {
      status,
      expiredAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    };
    
    if (winner && winner.userId && winner.userName) {
      updateData.winnerId = winner.userId;
      updateData.winnerName = winner.userName;
      updateData.winnerAction = winner.action;
      updateData.winnerAmount = this.extractAmountFromDetails(winner.details);
    }
    
    await updateDoc(listingRef, updateData);
  }

  // Determine the winner based on the highest action
  async determineWinner(listing) {
    try {
      // Get all actions for this listing
      const actionsRef = collection(db, 'activityLogs');
      const actionsQuery = query(
        actionsRef,
        where('listingId', '==', listing.id),
        where('action', 'in', ['Mined', 'Stole', 'Locked', 'Bid'])
      );
      
      const actionsSnapshot = await getDocs(actionsQuery);
      const actions = [];
      
      actionsSnapshot.forEach((doc) => {
        const data = doc.data();
        actions.push({ id: doc.id, ...data });
      });
      
      if (actions.length === 0) {
        return null; // No actions performed
      }
      
      // Sort actions by priority and amount
      const sortedActions = this.sortActionsByPriority(actions);
      const winner = sortedActions[0];
      
      // Validate winner data
      if (!winner.userId || !winner.userName) {
        return null;
      }
      
      return winner;
    } catch (error) {
      console.error('❌ Error determining winner:', error);
      return null;
    }
  }

  // Sort actions by priority (Lock > Steal > Mine > Bid)
  sortActionsByPriority(actions) {
    const priorityOrder = { 'Locked': 1, 'Stole': 2, 'Mined': 3, 'Bid': 4 };
    
    return actions.sort((a, b) => {
      // First sort by action priority
      const priorityA = priorityOrder[a.action] || 999;
      const priorityB = priorityOrder[b.action] || 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same action type, sort by amount (highest first)
      const amountA = parseFloat(a.details?.match(/₱(\d+)/)?.[1] || 0);
      const amountB = parseFloat(b.details?.match(/₱(\d+)/)?.[1] || 0);
      
      return amountB - amountA;
    });
  }

  // Notify winner to proceed to payment
  async notifyWinnerToPay(listing, winner) {
    try {
      console.log(`🔔 Notifying winner ${winner.userId} for listing ${listing.id}`);
      
      const title = `🎉 You Won! Payment Required`;
      const body = `Congratulations! You won "${listing.title}" with ${winner.action} action. Please submit your payment proof to complete the purchase.`;
      
      // Check if notification already exists
      const existingNotificationQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', winner.userId),
        where('data.type', '==', 'payment_required'),
        where('data.listingId', '==', listing.id)
      );
      
      const existingSnapshot = await getDocs(existingNotificationQuery);
      if (!existingSnapshot.empty) {
        console.log(`⏭️ Notification already exists for winner ${winner.userId} and listing ${listing.id}`);
        return;
      }
      
      // Final check right before creating notification - double-check for race conditions
      const finalNotificationCheck = query(
        collection(db, 'notifications'),
        where('recipientId', '==', winner.userId),
        where('data.type', '==', 'payment_required'),
        where('data.listingId', '==', listing.id)
      );
      
      const finalNotificationSnapshot = await getDocs(finalNotificationCheck);
      if (!finalNotificationSnapshot.empty) {
        const existingNotification = finalNotificationSnapshot.docs[0];
        return existingNotification.id;
      }
      
      // Create database notification
      const notificationData = {
        type: 'payment_required',
        listingId: listing.id,
        actionType: winner.action,
        amount: this.extractAmountFromDetails(winner.details),
        sellerId: listing.sellerId,
      };
      
      const notificationId = await NotificationManager.createNotification(
        winner.userId,
        title,
        body,
        notificationData
      );
      
      // Start payment timeout for the winner (this will create the payment record)
      await PaymentTimeoutService.startPaymentTimeout(
        listing.id,
        winner.userId,
        winner.action,
        this.extractAmountFromDetails(winner.details)
      );
      
      } catch (error) {
      console.error('❌ Error notifying winner:', error);
    }
  }

  // Notify seller about the winner
  async notifySellerAboutWinner(listing, winner) {
    try {
      const title = `🏆 Winner Determined!`;
      const body = `Your listing "${listing.title}" has expired. ${winner.userName} won with ${winner.action} action. They will submit payment proof soon.`;
      
      // Check if notification already exists
      const existingNotificationQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', listing.sellerId),
        where('data.type', '==', 'winner_determined'),
        where('data.listingId', '==', listing.id)
      );
      
      const existingSnapshot = await getDocs(existingNotificationQuery);
      if (!existingSnapshot.empty) {
        return;
      }
      
      // Create database notification
      await NotificationManager.createNotification(
        listing.sellerId,
        title,
        body,
        {
          type: 'winner_determined',
          listingId: listing.id,
          winnerId: winner.userId,
          winnerName: winner.userName,
          actionType: winner.action,
        }
      );
      
      } catch (error) {
      console.error('❌ Error notifying seller:', error);
    }
  }

  // Notify all participants about expiration
  async notifyAllParticipants(listing, winner) {
    try {
      // Get all participants except the winner
      const participants = await this.getListingParticipants(listing.id);
      const otherParticipants = participants.filter(id => id !== winner.userId);
      
      if (otherParticipants.length === 0) {
        return;
      }
      
      const title = `⏰ Listing Expired - You Didn't Win`;
      const body = `The listing "${listing.title}" has expired. ${winner.userName} won with ${winner.action} action. Better luck next time!`;
      
      // Create database notifications for all participants
      for (const participantId of otherParticipants) {
        // Check if notification already exists for this participant
        const existingNotificationQuery = query(
          collection(db, 'notifications'),
          where('recipientId', '==', participantId),
          where('data.type', '==', 'listing_expired_lost'),
          where('data.listingId', '==', listing.id)
        );
        
        const existingSnapshot = await getDocs(existingNotificationQuery);
        if (!existingSnapshot.empty) {
          continue;
        }
        
        // Final check right before creating notification - double-check for race conditions
        const finalCheckQuery = query(
          collection(db, 'notifications'),
          where('recipientId', '==', participantId),
          where('data.type', '==', 'listing_expired_lost'),
          where('data.listingId', '==', listing.id)
        );
        
        const finalCheckSnapshot = await getDocs(finalCheckQuery);
        if (!finalCheckSnapshot.empty) {
          continue;
        }
        
        await NotificationManager.createNotification(
          participantId,
          title,
          body,
          {
            type: 'listing_expired_lost',
            listingId: listing.id,
            winnerId: winner.userId,
            winnerName: winner.userName,
            winnerAction: winner.action,
          }
        );
      }
      
      } catch (error) {
      console.error('❌ Error notifying participants:', error);
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

  // Get push tokens for multiple users
  async getUserPushTokens(userIds) {
    try {
      const tokens = [];
      
      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.pushToken) {
            tokens.push(userData.pushToken);
          }
        }
      }
      
      return tokens;
    } catch (error) {
      console.error('❌ Error getting user push tokens:', error);
      return [];
    }
  }

  // Notify seller if no winner
  async notifySellerNoWinner(listing) {
    try {
      const title = `⏰ Listing Expired - No Winner`;
      const body = `Your listing "${listing.title}" has expired with no actions performed. You can repost it if desired.`;
      
      await NotificationManager.createNotification(
        listing.sellerId,
        title,
        body,
        {
          type: 'no_winner',
          listingId: listing.id,
        }
      );
      
      // No winner notification sent to seller
    } catch (error) {
      console.error('❌ Error notifying seller (no winner):', error);
    }
  }

  // Create activity log for the expiration
  async createActivityLog(listing, winner) {
    try {
      await addDoc(collection(db, 'activityLogs'), {
        listingId: listing.id,
        userId: winner.userId,
        userName: winner.userName,
        action: 'Listing Expired - Winner',
        details: `Listing expired. ${winner.userName} won with ${winner.action} action and needs to submit payment.`,
        timestamp: serverTimestamp(),
        systemGenerated: true,
      });
      
      // Activity log created for expiration
    } catch (error) {
      console.error('❌ Error creating activity log:', error);
    }
  }


  // Extract amount from action details
  extractAmountFromDetails(details) {
    const match = details?.match(/₱(\d+)/);
    const amount = match ? parseFloat(match[1]) : 0;
    return amount;
  }

  // Check for listings that need payment reminders
  async checkPaymentReminders() {
    try {
      // Checking for payment reminders
      
      // Get all expired listings with winners that haven't paid
      const listingsRef = collection(db, 'listings');
      const q = query(
        listingsRef,
        where('status', '==', 'expired'),
        where('paymentSubmitted', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const listingsNeedingReminders = [];
      
      querySnapshot.forEach((doc) => {
        const listing = { id: doc.id, ...doc.data() };
        const expiredAt = listing.expiredAt?.toDate();
        const hoursSinceExpiry = (new Date() - expiredAt) / (1000 * 60 * 60);
        
        // Send reminder if more than 24 hours have passed
        if (hoursSinceExpiry > 24) {
          listingsNeedingReminders.push(listing);
        }
      });
      
      // Found listings needing payment reminders
      
      // Send reminders for each listing
      for (const listing of listingsNeedingReminders) {
        await this.sendPaymentReminder(listing);
      }
      
      return listingsNeedingReminders.length;
    } catch (error) {
      console.error('❌ Error checking payment reminders:', error);
      throw error;
    }
  }

  // Send payment reminder
  async sendPaymentReminder(listing) {
    try {
      // Get the winner from activity logs
      const actionsRef = collection(db, 'activityLogs');
      const actionsQuery = query(
        actionsRef,
        where('listingId', '==', listing.id),
        where('action', 'in', ['Mined', 'Stole', 'Locked', 'Bid'])
      );
      
      const actionsSnapshot = await getDocs(actionsQuery);
      const actions = [];
      
      actionsSnapshot.forEach((doc) => {
        actions.push({ id: doc.id, ...doc.data() });
      });
      
      if (actions.length === 0) return;
      
      const sortedActions = this.sortActionsByPriority(actions);
      const winner = sortedActions[0];
      
      const title = `⏰ Payment Reminder`;
      const body = `Don't forget! You won "${listing.title}" and need to submit payment proof to complete your purchase.`;
      
      await NotificationManager.createNotification(
        winner.userId,
        title,
        body,
        {
          type: 'payment_reminder',
          listingId: listing.id,
          actionType: winner.action,
          amount: this.extractAmountFromDetails(winner.details),
        }
      );
      
      // Payment reminder sent
    } catch (error) {
      console.error('❌ Error sending payment reminder:', error);
    }
  }
}

export default new ExpirationNotificationService();
