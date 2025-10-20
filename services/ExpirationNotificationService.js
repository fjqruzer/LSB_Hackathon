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
      console.log('🔍 Checking for expired listings...');
      console.log('⏰ Current time:', new Date().toISOString());
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Process listings that expired within the last 24 hours
      console.log('⏰ Checking listings expired after:', twentyFourHoursAgo.toISOString());
      
      const listingsRef = collection(db, 'listings');
      
      // Get all active listings first, then filter by expiration
      const q = query(
        listingsRef,
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      const expiredListings = [];
      
      console.log(`📊 Found ${querySnapshot.size} active listings to check`);
      
      querySnapshot.forEach((doc) => {
        const listing = { id: doc.id, ...doc.data() };
        
        console.log(`🔍 Checking listing: ${listing.id} (${listing.title})`);
        console.log(`🔍 Listing endDateTime:`, listing.endDateTime);
        console.log(`🔍 Listing status:`, listing.status);
        console.log(`🔍 Listing lockedBy:`, listing.lockedBy);
        
        // Skip if already processed
        if (processedListings.has(listing.id)) {
          console.log(`⏭️ Listing ${listing.id} already processed, skipping`);
          return;
        }
        
        // Skip if currently being processed
        if (this.processingListings.has(listing.id)) {
          console.log(`⏭️ Listing ${listing.id} currently being processed, skipping`);
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
          
          console.log(`⏰ Listing ${listing.id} end time: ${endTime.toISOString()}`);
          console.log(`⏰ Current time: ${now.toISOString()}`);
          console.log(`⏰ 24 hours ago: ${twentyFourHoursAgo.toISOString()}`);
          console.log(`⏰ Is expired: ${endTime <= now}`);
          console.log(`⏰ Within 24 hours: ${endTime >= twentyFourHoursAgo}`);
          
          // Check if listing has expired (regardless of when it expired)
          if (!isNaN(endTime.getTime()) && endTime <= now) {
            // Skip if listing is already locked (handled by lock action)
            if (listing.status === 'locked' || listing.lockedBy) {
              console.log(`⏭️ Skipping locked listing ${listing.id} - already handled by lock action`);
            } else {
              console.log(`⏰ Found expired listing: ${listing.id} (expired at: ${endTime.toISOString()})`);
              expiredListings.push(listing);
            }
          } else if (!isNaN(endTime.getTime()) && endTime > now) {
            console.log(`⏭️ Listing ${listing.id} not yet expired (expires at: ${endTime.toISOString()})`);
          }
        }
      });
      
      console.log(`📊 Found ${expiredListings.length} expired listings to process`);
      
      // Process each expired listing
      for (const listing of expiredListings) {
        // Mark as processed before processing
        processedListings.add(listing.id);
        this.processingListings.add(listing.id);
        
        try {
          console.log(`🔄 Processing expired listing: ${listing.id}`);
          
          // Get all actions for this listing
          const actions = await this.getListingActions(listing.id);
          
          if (actions.length > 0) {
            try {
              // Sort actions by priority to determine winner
              const sortedActions = this.sortActionsByPriority(actions);
              const winner = sortedActions[0];
              
              console.log(`🏆 Winner determined for listing ${listing.id}: ${winner.userName} with ${winner.action} action`);
              
              // Update listing status to expired with winner
              await this.updateListingStatus(listing.id, 'expired', winner);
              console.log(`✅ Listing status updated successfully`);
              
              // Notify the winner to proceed to payment
              console.log(`🔔 Notifying winner to proceed to payment...`);
              const winnerNotificationId = await this.notifyWinnerToPay(listing, winner);
              if (winnerNotificationId) {
                console.log(`✅ Winner notification sent successfully: ${winnerNotificationId}`);
              } else {
                console.log(`⚠️ Winner notification failed or was skipped`);
              }
              
              // Notify seller about the winner
              console.log(`🔔 Notifying seller about winner...`);
              const sellerNotificationId = await this.notifySellerAboutWinner(listing, winner);
              if (sellerNotificationId) {
                console.log(`✅ Seller notification sent successfully: ${sellerNotificationId}`);
              } else {
                console.log(`⚠️ Seller notification failed or was skipped`);
              }
              
              // Notify all participants about the expiration
              console.log(`🔔 Notifying all participants about expiration...`);
              await this.notifyAllParticipants(listing, winner);
              console.log(`✅ Participant notifications sent`);
              
              // Create activity log
              console.log(`📝 Creating activity log...`);
              await this.createActivityLog(listing, winner);
              console.log(`✅ Activity log created`);
              
              console.log(`🎉 Successfully processed expired listing ${listing.id} with winner ${winner.userName}`);
              
            } catch (processingError) {
              console.error(`❌ Error processing expired listing ${listing.id} with winner:`, processingError);
              // Don't re-throw here to avoid breaking the whole process
            }
          } else {
            console.log(`📭 No winner found for listing ${listing.id}`);
            
            try {
              // No winner found, update status and notify seller
              console.log(`📝 Updating listing status to expired (no winner)...`);
              await this.updateListingStatus(listing.id, 'expired');
              console.log(`✅ Listing status updated successfully`);
              
              // Notify seller about no winner
              console.log(`🔔 Notifying seller about no winner...`);
              await this.notifySellerNoWinner(listing);
              console.log(`✅ No winner notification sent to seller`);
              
              // Notify all viewers that listing expired with no winner
              console.log(`🔔 Notifying all viewers about no winner...`);
              await this.notifyAllViewersNoWinner(listing);
              console.log(`✅ No winner notifications sent to viewers`);
              
              console.log(`📭 Successfully processed expired listing ${listing.id} with no winner`);
              
            } catch (noWinnerError) {
              console.error(`❌ Error processing expired listing ${listing.id} with no winner:`, noWinnerError);
              // Don't re-throw here to avoid breaking the whole process
            }
          }
        } catch (error) {
          console.error(`❌ Error processing expired listing ${listing.id}:`, error);
        } finally {
          // Remove from processing set
          this.processingListings.delete(listing.id);
        }
      }
      
      console.log(`✅ Expiration check completed. Processed ${expiredListings.length} expired listings`);
      return expiredListings.length;
      
    } catch (error) {
      console.error('❌ Error in expiration check:', error);
      throw error;
    }
  }

  // Get all actions for a listing
  async getListingActions(listingId) {
    try {
      const actionsRef = collection(db, 'activityLogs');
      const actionsQuery = query(
        actionsRef,
        where('listingId', '==', listingId),
        where('action', 'in', ['Mined', 'Stole', 'Locked', 'Bid'])
      );
      
      const actionsSnapshot = await getDocs(actionsQuery);
      const actions = [];
      
      actionsSnapshot.forEach((doc) => {
        actions.push({ id: doc.id, ...doc.data() });
      });
      
      return actions;
    } catch (error) {
      console.error('❌ Error getting listing actions:', error);
      return [];
    }
  }

  // Sort actions by priority to determine winner
  sortActionsByPriority(actions) {
    const priorityOrder = {
      'Locked': 1,
      'Mined': 2,
      'Stole': 3,
      'Bid': 4
    };
    
    return actions.sort((a, b) => {
      const priorityA = priorityOrder[a.action] || 999;
      const priorityB = priorityOrder[b.action] || 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same priority, sort by timestamp (earliest first)
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return timeA - timeB;
    });
  }

  // Update listing status
  async updateListingStatus(listingId, status, winner = null) {
    try {
      const listingRef = doc(db, 'listings', listingId);
      const updateData = {
        status: status,
        lastUpdated: serverTimestamp()
      };
      
      if (winner) {
        updateData.winnerId = winner.userId;
        updateData.winnerName = winner.userName;
        updateData.winnerAction = winner.action;
        updateData.expiredAt = serverTimestamp();
      }
      
      await updateDoc(listingRef, updateData);
      console.log(`✅ Listing ${listingId} status updated to ${status}`);
    } catch (error) {
      console.error('❌ Error updating listing status:', error);
      throw error;
    }
  }

  // Notify winner to proceed to payment
  async notifyWinnerToPay(listing, winner) {
    try {
      console.log(`🔔 Notifying winner ${winner.userId} for listing ${listing.id}`);
      
      // Validate inputs
      if (!winner || !winner.userId) {
        console.error('❌ Invalid winner data:', winner);
        return;
      }
      
      if (!listing || !listing.id) {
        console.error('❌ Invalid listing data:', listing);
        return;
      }
      
      const title = `🎉 You Won! Payment Required`;
      const body = `Congratulations! You won "${listing.title}" with ${winner.action} action. Please submit your payment proof to complete the purchase.`;
      
      // Simplified duplicate check - only check for very recent notifications (within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - (5 * 60 * 1000));
      const existingNotificationQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', winner.userId),
        where('data.type', '==', 'payment_required')
      );
      
      const existingSnapshot = await getDocs(existingNotificationQuery);
      // Client-side filtering for listingId and timestamp
      const recentNotifications = existingSnapshot.docs.filter(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();
        return createdAt && createdAt >= fiveMinutesAgo && data.data?.listingId === listing.id;
      });
      
      if (recentNotifications.length > 0) {
        console.log(`⏭️ Very recent notification already exists for winner ${winner.userId} and listing ${listing.id}`);
        return recentNotifications[0].id;
      }
      
      // Create database notification
      const notificationData = {
        type: 'payment_required',
        listingId: listing.id,
        actionType: winner.action,
        amount: this.extractAmountFromDetails(winner.details),
        sellerId: listing.sellerId,
      };
      
      console.log(`📬 Creating payment notification for winner ${winner.userId}`);
      console.log(`📬 Notification title: ${title}`);
      console.log(`📬 Notification body: ${body}`);
      console.log(`📬 Notification data:`, notificationData);
      
      const notificationId = await NotificationManager.createNotification(
        winner.userId,
        title,
        body,
        notificationData
      );
      
      if (notificationId) {
        console.log(`✅ Payment notification created successfully: ${notificationId}`);
        
        // Start payment timeout for the winner (this will create the payment record)
        try {
          await PaymentTimeoutService.startPaymentTimeout(
            listing.id,
            winner.userId,
            winner.action,
            this.extractAmountFromDetails(winner.details)
          );
          console.log(`✅ Payment timeout started for winner ${winner.userId}`);
        } catch (timeoutError) {
          console.error('❌ Error starting payment timeout:', timeoutError);
          // Don't fail the whole process if timeout service fails
        }
      } else {
        console.log(`❌ Payment notification creation failed for winner ${winner.userId}`);
      }
      
      return notificationId;
      
    } catch (error) {
      console.error('❌ Error notifying winner:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        listing: listing?.id,
        winner: winner?.userId
      });
      throw error; // Re-throw to ensure calling code knows about the failure
    }
  }

  // Notify seller about the winner
  async notifySellerAboutWinner(listing, winner) {
    try {
      console.log(`🔔 Notifying seller ${listing.sellerId} about winner for listing ${listing.id}`);
      
      // Validate inputs
      if (!listing || !listing.sellerId) {
        console.error('❌ Invalid listing or seller data:', listing);
        return;
      }
      
      if (!winner || !winner.userName) {
        console.error('❌ Invalid winner data:', winner);
        return;
      }
      
      const title = `🏆 Winner Determined!`;
      const body = `Your listing "${listing.title}" has expired. ${winner.userName} won with ${winner.action} action. They will submit payment proof soon.`;
      
      // Simplified duplicate check - only check for very recent notifications (within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - (5 * 60 * 1000));
      const existingNotificationQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', listing.sellerId),
        where('data.type', '==', 'winner_determined')
      );
      
      const existingSnapshot = await getDocs(existingNotificationQuery);
      // Client-side filtering for listingId and timestamp
      const recentNotifications = existingSnapshot.docs.filter(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();
        return createdAt && createdAt >= fiveMinutesAgo && data.data?.listingId === listing.id;
      });
      
      if (recentNotifications.length > 0) {
        console.log(`⏭️ Very recent notification already exists for seller ${listing.sellerId} and listing ${listing.id}`);
        return recentNotifications[0].id;
      }
      
      console.log(`📬 Creating winner notification for seller ${listing.sellerId}`);
      const notificationId = await NotificationManager.createNotification(
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
      
      if (notificationId) {
        console.log(`✅ Winner notification created successfully for seller: ${notificationId}`);
      } else {
        console.log(`⚠️ Winner notification creation returned null for seller ${listing.sellerId}`);
      }
      
      return notificationId;
      
    } catch (error) {
      console.error('❌ Error notifying seller:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        listing: listing?.id,
        seller: listing?.sellerId,
        winner: winner?.userId
      });
      throw error; // Re-throw to ensure calling code knows about the failure
    }
  }

  // Notify all participants about expiration
  async notifyAllParticipants(listing, winner) {
    try {
      // Validate inputs
      if (!listing || !listing.id) {
        console.error('❌ Invalid listing provided to notifyAllParticipants:', listing);
        return;
      }
      
      if (!winner || !winner.userId) {
        console.error('❌ Invalid winner provided to notifyAllParticipants:', winner);
        return;
      }
      
      console.log(`📊 Notifying participants for listing ${listing.id} with winner ${winner.userId}`);
      
      // Get all participants except the winner
      const participants = await this.getListingParticipants(listing.id);
      const otherParticipants = participants.filter(id => id !== winner.userId);
      
      // Also get all users who viewed this listing (tracked in listingViews)
      const viewers = await this.getListingViewers(listing.id);
      const otherViewers = viewers.filter(id => id !== winner.userId && !participants.includes(id));
      
      // Combine participants and viewers, removing duplicates
      const allInterestedUsers = [...new Set([...otherParticipants, ...otherViewers])];
      
      if (allInterestedUsers.length === 0) {
        console.log(`📊 No other interested users found for listing ${listing.id}`);
        return;
      }
      
      console.log(`📊 Found ${allInterestedUsers.length} interested users to notify for listing ${listing.id}`);
      
      const title = `⏰ Listing Expired - You Didn't Win`;
      const body = `The listing "${listing.title}" has expired. ${winner.userName} won with ${winner.action} action. Better luck next time!`;
      
      // Create database notifications for all interested users
      for (const userId of allInterestedUsers) {
        // Validate userId
        if (!userId || typeof userId !== 'string') {
          console.error('❌ Invalid userId in notifyAllParticipants:', userId);
          continue;
        }
        
        // Simplified duplicate check - only check for very recent notifications (within 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - (5 * 60 * 1000));
        const existingNotificationQuery = query(
          collection(db, 'notifications'),
          where('recipientId', '==', userId),
          where('data.type', '==', 'listing_expired_lost')
        );
        
        const existingSnapshot = await getDocs(existingNotificationQuery);
        // Client-side filtering for listingId and timestamp
        const recentNotifications = existingSnapshot.docs.filter(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate();
          return createdAt && createdAt >= fiveMinutesAgo && data.data?.listingId === listing.id;
        });
        
        if (recentNotifications.length > 0) {
          console.log(`⏭️ Very recent notification already exists for user ${userId} and listing ${listing.id}`);
          continue;
        }
        
        await NotificationManager.createNotification(
          userId,
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
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        listing: listing,
        winner: winner
      });
    }
  }

  // Get all users who have performed actions on a listing
  async getListingParticipants(listingId) {
    try {
      // Validate listingId
      if (!listingId || typeof listingId !== 'string') {
        console.error('❌ Invalid listingId provided to getListingParticipants:', listingId);
        return [];
      }
      
      console.log(`🎯 Getting participants for listing: ${listingId}`);
      
      // Get all activity logs for this listing
      const activityQuery = query(
        collection(db, 'activityLogs'),
        where('listingId', '==', listingId)
      );
      
      const activitySnapshot = await getDocs(activityQuery);
      const participants = new Set();
      
      activitySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId && typeof data.userId === 'string') {
          participants.add(data.userId);
        }
      });
      
      const participantArray = Array.from(participants);
      console.log(`🎯 Found ${participantArray.length} participants for listing ${listingId}`);
      
      return participantArray;
    } catch (error) {
      console.error('❌ Error getting listing participants:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        listingId: listingId
      });
      return [];
    }
  }

  // Get all users who have viewed a listing (tracked in listingViews collection)
  async getListingViewers(listingId) {
    try {
      // Validate listingId
      if (!listingId || typeof listingId !== 'string') {
        console.error('❌ Invalid listingId provided to getListingViewers:', listingId);
        return [];
      }
      
      console.log(`👀 Getting viewers for listing: ${listingId}`);
      
      // Get all views for this listing
      const viewsQuery = query(
        collection(db, 'listingViews'),
        where('listingId', '==', listingId)
      );
      
      const viewsSnapshot = await getDocs(viewsQuery);
      const viewers = new Set();
      
      viewsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId && typeof data.userId === 'string') {
          viewers.add(data.userId);
        }
      });
      
      const viewerArray = Array.from(viewers);
      console.log(`👀 Found ${viewerArray.length} viewers for listing ${listingId}`);
      
      return viewerArray;
    } catch (error) {
      console.error('❌ Error getting listing viewers:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        listingId: listingId
      });
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

  // Notify all viewers when listing expires with no winner
  async notifyAllViewersNoWinner(listing) {
    try {
      // Validate inputs
      if (!listing || !listing.id) {
        console.error('❌ Invalid listing provided to notifyAllViewersNoWinner:', listing);
        return;
      }
      
      console.log(`📊 Notifying viewers for listing ${listing.id} (no winner)`);
      
      // Get all users who viewed this listing
      const viewers = await this.getListingViewers(listing.id);
      
      if (viewers.length === 0) {
        console.log(`📊 No viewers found for listing ${listing.id}`);
        return;
      }
      
      console.log(`📊 Found ${viewers.length} viewers to notify for listing ${listing.id} (no winner)`);
      
      const title = `⏰ Listing Expired - No Winner`;
      const body = `The listing "${listing.title}" has expired with no actions performed. It may be reposted soon!`;
      
      // Create database notifications for all viewers
      for (const userId of viewers) {
        // Validate userId
        if (!userId || typeof userId !== 'string') {
          console.error('❌ Invalid userId in notifyAllViewersNoWinner:', userId);
          continue;
        }
        
        // Check if notification already exists for this user (simplified query to avoid index requirement)
        const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        const existingNotificationQuery = query(
          collection(db, 'notifications'),
          where('recipientId', '==', userId),
          where('data.type', '==', 'listing_expired_no_winner')
        );
        
        const existingSnapshot = await getDocs(existingNotificationQuery);
        // Client-side filtering for listingId and timestamp
        const recentNotifications = existingSnapshot.docs.filter(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate();
          return createdAt && createdAt >= oneDayAgo && data.data?.listingId === listing.id;
        });
        
        if (recentNotifications.length > 0) {
          console.log(`⏭️ Recent notification already exists for user ${userId} and listing ${listing.id}`);
          continue;
        }
        
        await NotificationManager.createNotification(
          userId,
          title,
          body,
          {
            type: 'listing_expired_no_winner',
            listingId: listing.id,
          }
        );
      }
      
    } catch (error) {
      console.error('❌ Error notifying viewers (no winner):', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        listing: listing
      });
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