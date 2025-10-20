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
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Process listings that expired within the last 24 hours
      
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
          
          // Process listings that expired within the last 24 hours to catch missed notifications
          if (!isNaN(endTime.getTime()) && endTime <= now && endTime >= twentyFourHoursAgo) {
            // Skip if listing is already locked (handled by lock action)
            if (listing.status === 'locked' || listing.lockedBy) {
              console.log(`⏭️ Skipping locked listing ${listing.id} - already handled by lock action`);
            } else {
              console.log(`⏰ Found recently expired listing: ${listing.id} (expired at: ${endTime.toISOString()})`);
              expiredListings.push(listing);
            }
          } else if (!isNaN(endTime.getTime()) && endTime < twentyFourHoursAgo) {
            console.log(`⏭️ Skipping old expired listing: ${listing.id} (expired at: ${endTime.toISOString()})`);
          }
        }
      });
      
      console.log(`📊 Found ${expiredListings.length} recently expired listings to process`);
      
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
      
      // Fetch the latest listing data to check current status
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const listingRef = doc(db, 'listings', listing.id);
      const listingSnapshot = await getDoc(listingRef);
      
      if (!listingSnapshot.exists()) {
        console.log(`⏭️ Listing ${listing.id} no longer exists`);
        this.processingListings.delete(listing.id);
        return;
      }
      
      const currentListing = listingSnapshot.data();
      
      // Skip if listing is already locked (handled by lock action)
      if (currentListing.status === 'locked' || currentListing.lockedBy) {
        console.log(`⏭️ Skipping locked listing ${listing.id} - already handled by lock action (status: ${currentListing.status}, lockedBy: ${currentListing.lockedBy})`);
        this.processingListings.delete(listing.id);
        return;
      }
      
      // Skip if listing is already expired (already processed)
      if (currentListing.status === 'expired') {
        console.log(`⏭️ Skipping listing ${listing.id} - already expired and processed (status: ${currentListing.status})`);
        this.processingListings.delete(listing.id);
        return;
      }
      
      // Skip if listing has been sold (already completed)
      if (currentListing.status === 'sold') {
        console.log(`⏭️ Skipping listing ${listing.id} - already sold (status: ${currentListing.status})`);
        this.processingListings.delete(listing.id);
        return;
      }
      
      // Simple check: look for any expiration-related activity logs (only check for the most important ones)
      const expirationActivityQuery = query(
        collection(db, 'activityLogs'),
        where('listingId', '==', listing.id),
        where('action', 'in', ['Listing Expired - Winner', 'Listing Expired - No Winner'])
      );
      
      const expirationActivitySnapshot = await getDocs(expirationActivityQuery);
      if (!expirationActivitySnapshot.empty) {
        console.log(`⏭️ Skipping listing ${listing.id} - expiration already processed (found activity logs)`);
        this.processingListings.delete(listing.id);
        return; // Skip processing if expiration was already handled
      }
      
      // Check for recent lock actions on this listing (within last 24 hours)
      const lockActivityQuery = query(
        collection(db, 'activityLogs'),
        where('listingId', '==', listing.id),
        where('action', '==', 'Locked')
      );
      
      const lockActivitySnapshot = await getDocs(lockActivityQuery);
      if (!lockActivitySnapshot.empty) {
        // Check if lock action was recent (within 24 hours)
        const recentLockActions = lockActivitySnapshot.docs.filter(doc => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate();
          const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
          return timestamp && timestamp >= twentyFourHoursAgo;
        });
        
        if (recentLockActions.length > 0) {
          console.log(`⏭️ Skipping listing ${listing.id} - recently locked by user action`);
        this.processingListings.delete(listing.id);
          return; // Skip processing if listing was recently locked by user action
        }
      }
      
      // Additional check: if listing has lockedAt timestamp, it was locked by user action
      if (currentListing.lockedAt) {
        console.log(`⏭️ Skipping listing ${listing.id} - has lockedAt timestamp (user action)`);
        this.processingListings.delete(listing.id);
        return;
      }
      
      // Determine the winner based on action type
      console.log(`🎯 Determining winner for listing ${listing.id}...`);
      const winner = await this.determineWinner(currentListing);
      
      if (winner && winner.userId && winner.userName) {
        console.log(`🏆 Winner found: ${winner.userName} (${winner.userId}) with action: ${winner.action}`);
        
        try {
        // Update listing status to expired with winner info
          console.log(`📝 Updating listing status to expired with winner info...`);
        await this.updateListingStatus(listing.id, 'expired', winner);
          console.log(`✅ Listing status updated successfully`);
          
        // Notify the winner to proceed to payment
          console.log(`🔔 Notifying winner to proceed to payment...`);
          const winnerNotificationId = await this.notifyWinnerToPay(currentListing, winner);
          if (winnerNotificationId) {
            console.log(`✅ Winner notification sent successfully: ${winnerNotificationId}`);
          } else {
            console.log(`⚠️ Winner notification failed or was skipped`);
          }
          
        // Notify seller about the winner
          console.log(`🔔 Notifying seller about winner...`);
          const sellerNotificationId = await this.notifySellerAboutWinner(currentListing, winner);
          if (sellerNotificationId) {
            console.log(`✅ Seller notification sent successfully: ${sellerNotificationId}`);
          } else {
            console.log(`⚠️ Seller notification failed or was skipped`);
          }
          
        // Notify all participants about the expiration
          console.log(`🔔 Notifying all participants about expiration...`);
        await this.notifyAllParticipants(currentListing, winner);
          console.log(`✅ Participant notifications sent`);
          
        // Create activity log
          console.log(`📝 Creating activity log...`);
        await this.createActivityLog(currentListing, winner);
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
        await this.notifySellerNoWinner(currentListing);
          console.log(`✅ No winner notification sent to seller`);
          
        // Notify all viewers that listing expired with no winner
          console.log(`🔔 Notifying all viewers about no winner...`);
        await this.notifyAllViewersNoWinner(currentListing);
          console.log(`✅ No winner notifications sent to viewers`);
          
          console.log(`🎉 Successfully processed expired listing ${listing.id} with no winner`);
          
        } catch (processingError) {
          console.error(`❌ Error processing expired listing ${listing.id} with no winner:`, processingError);
          // Don't re-throw here to avoid breaking the whole process
        }
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
        console.log(`⚠️ Notification creation returned null for winner ${winner.userId}`);
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
