import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import NotificationManager from './NotificationManager';

class PaymentTimeoutService {
  constructor() {
    this.timeouts = new Map(); // Track active timeouts
    this.timeoutDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
    this.notifiedBuyers = new Map(); // Track notified buyers per listing
  }

  // Start payment timeout for a listing
  async startPaymentTimeout(listingId, winnerId, actionType, amount) {
    try {
      console.log(`⏰ Starting payment timeout for listing ${listingId}, winner ${winnerId}`);
      
      // Clear any existing timeout for this listing
      this.clearPaymentTimeout(listingId);
      
      // Get listing details to create payment record
      const listingDoc = await getDoc(doc(db, 'listings', listingId));
      if (!listingDoc.exists()) {
        console.error('❌ Listing not found:', listingId);
        return;
      }
      
      const listing = { id: listingDoc.id, ...listingDoc.data() };
      
      // Get buyer details from activity logs
      const actionsQuery = query(
        collection(db, 'activityLogs'),
        where('listingId', '==', listingId),
        where('userId', '==', winnerId),
        where('action', 'in', ['Mined', 'Stole', 'Locked', 'Bid'])
      );
      
      const actionsSnapshot = await getDocs(actionsQuery);
      if (actionsSnapshot.empty) {
        console.error('❌ No actions found for winner:', winnerId);
        return;
      }
      
      const buyer = actionsSnapshot.docs[0].data();
      
      // Check if payment record already exists before creating
      const existingPaymentQuery = query(
        collection(db, 'payments'),
        where('listingId', '==', listingId),
        where('buyerId', '==', winnerId)
      );
      
      const existingSnapshot = await getDocs(existingPaymentQuery);
      let paymentId = null;
      
      if (existingSnapshot.empty) {
        // Create payment record for the winner
        paymentId = await this.createPaymentRecord(listing, buyer);
      } else {
        // Update existing payment to pending_payment status
        const existingPayment = existingSnapshot.docs[0];
        paymentId = existingPayment.id;
        await updateDoc(doc(db, 'payments', paymentId), {
          status: 'pending_payment',
          expirationTime: new Date(Date.now() + this.timeoutDuration),
          lastUpdated: serverTimestamp()
        });
      }
      
      // Set new timeout with payment cancellation
      const timeoutId = setTimeout(async () => {
        await this.handlePaymentTimeoutWithCancellation(listingId, winnerId, actionType, amount, paymentId);
      }, this.timeoutDuration);
      
      this.timeouts.set(listingId, {
        timeoutId,
        winnerId,
        actionType,
        amount,
        paymentId,
        startTime: Date.now()
      });
      
      console.log(`✅ Payment timeout started for listing ${listingId}, payment ID: ${paymentId}`);
      
    } catch (error) {
      console.error('❌ Error starting payment timeout:', error);
    }
  }

  // Clear payment timeout for a listing
  clearPaymentTimeout(listingId) {
    const timeout = this.timeouts.get(listingId);
    if (timeout) {
      clearTimeout(timeout.timeoutId);
      this.timeouts.delete(listingId);
    }
  }

  // Handle payment timeout with automatic cancellation - notify next buyer
  async handlePaymentTimeoutWithCancellation(listingId, currentWinnerId, actionType, amount, paymentId) {
    try {
      console.log(`⏰ Payment timeout reached for listing ${listingId}, payment ${paymentId}`);
      
      // First, automatically cancel the current payment
      if (paymentId) {
        await this.autoCancelPayment(paymentId, 'Payment timeout - buyer did not submit payment within time limit');
      }
      
      // Then proceed with the normal timeout handling
      await this.handlePaymentTimeout(listingId, currentWinnerId, actionType, amount);
      
    } catch (error) {
      console.error('❌ Error handling payment timeout with cancellation:', error);
    }
  }

  // Handle payment timeout - notify next buyer
  async handlePaymentTimeout(listingId, currentWinnerId, actionType, amount) {
    try {
      
      // Validate listingId
      if (!listingId) {
        console.error('❌ Invalid listingId provided to handlePaymentTimeout');
        return;
      }
      
      // Get listing details
      const listingDoc = await getDoc(doc(db, 'listings', listingId));
      if (!listingDoc.exists()) {
        return;
      }
      
      const listing = { id: listingDoc.id, ...listingDoc.data() };
      
      // Get all actions for this listing
      const actionsQuery = query(
        collection(db, 'activityLogs'),
        where('listingId', '==', listingId),
        where('action', 'in', ['Mined', 'Stole', 'Locked', 'Bid'])
      );
      
      const actionsSnapshot = await getDocs(actionsQuery);
      const actions = [];
      
      actionsSnapshot.forEach((doc) => {
        actions.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort by timestamp in JavaScript (since we can't use orderBy in the query)
      actions.sort((a, b) => {
        const timestampA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const timestampB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return timestampB - timestampA; // Descending order
      });
      
      if (actions.length === 0) {
        return;
      }
      
      // Sort actions by priority and amount
      const sortedActions = this.sortActionsByPriority(actions);
      
      // Mark current winner's payment as cancelled if it exists
      await this.markPaymentAsCancelled(listingId, currentWinnerId);
      
      // Find the next buyer (skip the current winner and anyone with pending payments)
      const nextBuyer = await this.findNextAvailableBuyer(listingId, currentWinnerId, sortedActions);
      
      if (!nextBuyer) {
        // Notify seller that no one can pay
        await this.notifySellerNoPayment(listing, currentWinnerId);
        return;
      }
      
      // Create payment record for the next buyer
      await this.createPaymentRecord(listing, nextBuyer);
      
      // Notify the next buyer
      await this.notifyNextBuyer(listing, nextBuyer, actionType, amount);
      
      // Start timeout for the next buyer
      await this.startPaymentTimeout(
        listingId, 
        nextBuyer.userId, 
        nextBuyer.action, 
        this.extractAmountFromDetails(nextBuyer.details)
      );
      
    } catch (error) {
      console.error('❌ Error handling payment timeout:', error);
    }
  }

  // Notify next buyer about payment opportunity
  async notifyNextBuyer(listing, buyer, actionType, amount) {
    try {
      // Validate required fields
      if (!buyer.userId) {
        console.error('❌ Cannot send notification: buyer.userId is missing');
        return;
      }
      
      if (!listing.id) {
        console.error('❌ Cannot send notification: listing.id is missing');
        return;
      }
      
      // Check if this buyer has already been notified for this listing
      if (!this.notifiedBuyers.has(listing.id)) {
        this.notifiedBuyers.set(listing.id, new Set());
      }
      
      const notifiedBuyersForListing = this.notifiedBuyers.get(listing.id);
      
      if (notifiedBuyersForListing.has(buyer.userId)) {
        console.log(`⚠️ Buyer ${buyer.userId} already notified for listing ${listing.id}, skipping duplicate notification`);
        return;
      }
      
      const title = `🎉 You're Next! Payment Required`;
      const body = `The previous buyer didn't submit payment in time. You're now the winner of "${listing.title}" with ${buyer.action} action. Please submit your payment proof within 3 minutes.`;
      
      const notificationData = {
        type: 'payment_required',
        listingId: listing.id,
        actionType: buyer.action || null,
        amount: this.extractAmountFromDetails(buyer.details) || 0,
        sellerId: listing.sellerId || null,
        isNextBuyer: true
      };
      
      // Remove undefined values
      Object.keys(notificationData).forEach(key => {
        if (notificationData[key] === undefined) {
          delete notificationData[key];
        }
      });
      
      await NotificationManager.createNotification(
        buyer.userId,
        title,
        body,
        notificationData
      );
      
      // Mark this buyer as notified for this listing
      notifiedBuyersForListing.add(buyer.userId);
      console.log(`📱 Notification sent to buyer ${buyer.userId} for listing ${listing.id}`);
      
    } catch (error) {
      console.error('❌ Error notifying next buyer:', error);
    }
  }

  // Notify buyer about payment cancellation
  async notifyBuyerPaymentCancelled(paymentData, reason) {
    try {
      // Validate required fields
      if (!paymentData.buyerId) {
        console.error('❌ Cannot send notification: buyerId is missing');
        return;
      }
      
      if (!paymentData.id) {
        console.error('❌ Cannot send notification: paymentId is missing');
        return;
      }
      
      const title = `❌ Payment Cancelled`;
      const body = `Your payment for "${paymentData.listingTitle || 'the item'}" has been automatically cancelled. ${reason}`;
      
      const notificationData = {
        type: 'payment_cancelled',
        listingId: paymentData.listingId || null,
        paymentId: paymentData.id,
        reason: reason || 'Payment cancelled'
      };
      
      // Remove undefined values
      Object.keys(notificationData).forEach(key => {
        if (notificationData[key] === undefined) {
          delete notificationData[key];
        }
      });
      
      await NotificationManager.createNotification(
        paymentData.buyerId,
        title,
        body,
        notificationData
      );
      
      console.log(`📱 Payment cancellation notification sent to buyer: ${paymentData.buyerId}`);
      
    } catch (error) {
      console.error('❌ Error notifying buyer about payment cancellation:', error);
    }
  }

  // Notify seller that no one can pay
  async notifySellerNoPayment(listing, lastWinnerId) {
    try {
      // Validate required fields
      if (!listing.sellerId) {
        console.error('❌ Cannot send notification: listing.sellerId is missing');
        return;
      }
      
      if (!listing.id) {
        console.error('❌ Cannot send notification: listing.id is missing');
        return;
      }
      
      const title = `⏰ Payment Timeout - No Buyers Available`;
      const body = `All potential buyers for "${listing.title}" have failed to submit payment within the time limit. The listing will be marked as expired with no sale.`;
      
      const notificationData = {
        type: 'payment_timeout_no_buyers',
        listingId: listing.id,
        lastWinnerId: lastWinnerId || null
      };
      
      // Remove undefined values
      Object.keys(notificationData).forEach(key => {
        if (notificationData[key] === undefined) {
          delete notificationData[key];
        }
      });
      
      await NotificationManager.createNotification(
        listing.sellerId,
        title,
        body,
        notificationData
      );
      
      // Update listing status to expired with no sale
      await updateDoc(doc(db, 'listings', listing.id), {
        status: 'expired_no_sale',
        expiredAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
      
    } catch (error) {
      console.error('❌ Error notifying seller about payment timeout:', error);
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
      const amountA = this.extractAmountFromDetails(a.details);
      const amountB = this.extractAmountFromDetails(b.details);
      
      return amountB - amountA;
    });
  }

  // Create payment record for buyer
  async createPaymentRecord(listing, buyer) {
    try {
      
      // Validate required fields
      if (!listing || !listing.id) {
        throw new Error('Invalid listing data: missing listing or listing.id');
      }
      
      if (!buyer || !buyer.userId) {
        throw new Error('Invalid buyer data: missing buyer or buyer.userId');
      }
      
      // Check if payment record already exists for this listing and buyer (any status)
      const existingPaymentQuery = query(
        collection(db, 'payments'),
        where('listingId', '==', listing.id),
        where('buyerId', '==', buyer.userId)
      );
      
      const existingSnapshot = await getDocs(existingPaymentQuery);
      if (!existingSnapshot.empty) {
        const existingPayment = existingSnapshot.docs[0];
        return existingPayment.id;
      }
      
      const amount = this.extractAmountFromDetails(buyer.details);
      const expirationTime = new Date(Date.now() + (3 * 60 * 1000)); // 3 minutes from now
      
      const paymentData = {
        listingId: listing.id,
        buyerId: buyer.userId,
        buyerName: buyer.userName,
        sellerId: listing.sellerId,
        actionType: buyer.action,
        amount: amount,
        status: 'pending_payment', // pending_payment, submitted, approved, rejected
        expirationTime: expirationTime,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      };
      
      // Final check right before creating - double-check for race conditions
      const finalCheckQuery = query(
        collection(db, 'payments'),
        where('listingId', '==', listing.id),
        where('buyerId', '==', buyer.userId)
      );
      
      const finalCheckSnapshot = await getDocs(finalCheckQuery);
      if (!finalCheckSnapshot.empty) {
        const existingPayment = finalCheckSnapshot.docs[0];
        return existingPayment.id;
      }
      
      const paymentRef = await addDoc(collection(db, 'payments'), paymentData);
      
      return paymentRef.id;
    } catch (error) {
      console.error('❌ Error creating payment record:', error);
      throw error;
    }
  }

  // Extract amount from action details
  extractAmountFromDetails(details) {
    const match = details?.match(/₱(\d+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  // Payment submitted successfully - clear timeout
  async onPaymentSubmitted(listingId) {
    this.clearPaymentTimeout(listingId);
  }

  // Get active timeouts (for debugging)
  getActiveTimeouts() {
    return Array.from(this.timeouts.entries()).map(([listingId, timeout]) => ({
      listingId,
      winnerId: timeout.winnerId,
      actionType: timeout.actionType,
      amount: timeout.amount,
      timeRemaining: this.timeoutDuration - (Date.now() - timeout.startTime)
    }));
  }

  // Automatically cancel a specific payment by ID
  async autoCancelPayment(paymentId, reason = 'Payment timeout - buyer did not submit payment within time limit') {
    try {
      console.log(`🔄 Auto-cancelling payment: ${paymentId}`);
      
      // Get the payment document
      const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
      
      if (!paymentDoc.exists()) {
        console.log(`ℹ️ Payment document not found: ${paymentId}`);
        return;
      }
      
      const paymentData = { id: paymentId, ...paymentDoc.data() };
      
      // Only cancel if payment is still pending (NOT submitted)
      if (paymentData.status === 'pending_payment') {
        await updateDoc(doc(db, 'payments', paymentId), {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelledReason: reason,
          lastUpdated: serverTimestamp()
        });
        
        console.log(`✅ Payment auto-cancelled: ${paymentId} - ${reason}`);
        
        // Notify the buyer about the cancellation
        await this.notifyBuyerPaymentCancelled(paymentData, reason);
      } else {
        console.log(`ℹ️ Payment ${paymentId} is already ${paymentData.status}, skipping cancellation`);
      }
      
    } catch (error) {
      console.error('❌ Error auto-cancelling payment:', error);
    }
  }

  // Mark payment as cancelled when timeout occurs
  async markPaymentAsCancelled(listingId, buyerId) {
    try {
      console.log(`🔄 Marking payment as cancelled for listing ${listingId}, buyer ${buyerId}`);
      
      // Find the payment record for this buyer and listing (only pending payments)
      const paymentQuery = query(
        collection(db, 'payments'),
        where('listingId', '==', listingId),
        where('buyerId', '==', buyerId),
        where('status', '==', 'pending_payment')
      );
      
      const paymentSnapshot = await getDocs(paymentQuery);
      
      if (!paymentSnapshot.empty) {
        const paymentDoc = paymentSnapshot.docs[0];
        await updateDoc(doc(db, 'payments', paymentDoc.id), {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelledReason: 'Payment timeout - buyer did not submit payment within time limit'
        });
        
        console.log(`✅ Payment marked as cancelled: ${paymentDoc.id}`);
      } else {
        console.log(`ℹ️ No payment record found to cancel for buyer ${buyerId}`);
      }
    } catch (error) {
      console.error('❌ Error marking payment as cancelled:', error);
    }
  }

  // Find next available buyer (skip those already notified for this listing)
  async findNextAvailableBuyer(listingId, currentWinnerId, sortedActions) {
    try {
      // Initialize notified buyers set for this listing if not exists
      if (!this.notifiedBuyers.has(listingId)) {
        this.notifiedBuyers.set(listingId, new Set());
      }
      
      const notifiedBuyersForListing = this.notifiedBuyers.get(listingId);
      
      console.log(`🔍 Already notified buyers for listing ${listingId}:`, Array.from(notifiedBuyersForListing));
      console.log(`🔍 Total participants for listing ${listingId}:`, sortedActions.length);
      console.log(`🔍 Current winner: ${currentWinnerId}`);
      
      // Find the next buyer who hasn't been notified yet and isn't the current winner
      const nextBuyer = sortedActions.find(action => 
        action.userId !== currentWinnerId && 
        !notifiedBuyersForListing.has(action.userId)
      );
      
      if (nextBuyer) {
        console.log(`✅ Found next available buyer: ${nextBuyer.userId}`);
        // Note: We don't mark as notified here anymore - that's done in notifyNextBuyer
      } else {
        console.log(`❌ No available buyers found (all participants already notified)`);
      }
      
      return nextBuyer;
    } catch (error) {
      console.error('❌ Error finding next available buyer:', error);
      return null;
    }
  }

  // Clear notified buyers for a specific listing (when listing is completed)
  clearNotifiedBuyers(listingId) {
    this.notifiedBuyers.delete(listingId);
    console.log(`🧹 Cleared notified buyers for listing: ${listingId}`);
  }

  // Test function to simulate notification behavior
  testNotificationSystem(listingId, participants) {
    console.log(`🧪 TESTING NOTIFICATION SYSTEM for listing ${listingId}`);
    console.log(`🧪 Participants:`, participants);
    
    // Initialize notified buyers for this listing
    if (!this.notifiedBuyers.has(listingId)) {
      this.notifiedBuyers.set(listingId, new Set());
    }
    
    const notifiedBuyersForListing = this.notifiedBuyers.get(listingId);
    
    // Simulate multiple timeouts
    participants.forEach((participant, index) => {
      console.log(`\n🧪 Simulating timeout ${index + 1} - Current winner: ${participant}`);
      
      const nextBuyer = participants.find(p => 
        p !== participant && !notifiedBuyersForListing.has(p)
      );
      
      if (nextBuyer) {
        console.log(`✅ Next buyer: ${nextBuyer}`);
        notifiedBuyersForListing.add(nextBuyer);
        console.log(`📝 Notified buyers so far:`, Array.from(notifiedBuyersForListing));
      } else {
        console.log(`❌ No more buyers available`);
      }
    });
    
    console.log(`\n🧪 Final notified buyers:`, Array.from(notifiedBuyersForListing));
    console.log(`🧪 All participants notified: ${notifiedBuyersForListing.size === participants.length}`);
  }

  // Check and cancel expired payments
  async checkAndCancelExpiredPayments() {
    try {
      console.log('🔍 Checking for expired payments...');
      
      const now = new Date();
      
      // Query only pending payments and filter by expiration time in JavaScript
      // This avoids the need for a composite index
      const pendingPaymentsQuery = query(
        collection(db, 'payments'),
        where('status', '==', 'pending_payment')
      );
      
      const pendingSnapshot = await getDocs(pendingPaymentsQuery);
      
      if (pendingSnapshot.empty) {
        console.log('✅ No pending payments found');
        return;
      }
      
      console.log(`📋 Found ${pendingSnapshot.size} pending payments, checking expiration...`);
      
      // Filter expired payments in JavaScript
      const expiredPayments = [];
      pendingSnapshot.forEach((doc) => {
        const paymentData = doc.data();
        if (paymentData.expirationTime) {
          const expirationTime = paymentData.expirationTime.toDate ? 
            paymentData.expirationTime.toDate() : 
            new Date(paymentData.expirationTime);
          
          if (expirationTime <= now) {
            expiredPayments.push({ id: doc.id, ...paymentData });
          }
        }
      });
      
      if (expiredPayments.length === 0) {
        console.log('✅ No expired payments found');
        return;
      }
      
      console.log(`🔄 Found ${expiredPayments.length} expired payments, cancelling...`);
      
      const cancelPromises = expiredPayments.map(async (payment) => {
        await this.autoCancelPayment(payment.id, 'Payment expired - automatic cleanup');
        return payment;
      });
      
      const cancelledPayments = await Promise.all(cancelPromises);
      
      console.log(`✅ Cancelled ${cancelledPayments.length} expired payments`);
      
    } catch (error) {
      console.error('❌ Error checking and cancelling expired payments:', error);
      
      // If it's still the index error, log a helpful message
      if (error.message && error.message.includes('index')) {
        console.log('💡 Note: This error should be resolved with the updated query. If it persists, please restart the app.');
      }
    }
  }

  // Start periodic cleanup of expired payments
  startExpiredPaymentCleanup() {
    // Check every 30 seconds for expired payments
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.checkAndCancelExpiredPayments();
      } catch (error) {
        // If there's an index error, disable the cleanup service temporarily
        if (error.message && error.message.includes('index')) {
          console.log('⚠️ Disabling expired payment cleanup due to index error. Please restart the app.');
          this.stopExpiredPaymentCleanup();
        }
      }
    }, 30 * 1000);
    
    console.log('🧹 Started expired payment cleanup service');
  }

  // Stop periodic cleanup
  stopExpiredPaymentCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 Stopped expired payment cleanup service');
    }
  }

  // Manual cleanup method (for testing or when interval is disabled)
  async manualCleanupExpiredPayments() {
    console.log('🔧 Running manual cleanup of expired payments...');
    await this.checkAndCancelExpiredPayments();
  }

  // Clear all timeouts (for cleanup)
  clearAllTimeouts() {
    this.timeouts.forEach((timeout, listingId) => {
      clearTimeout(timeout.timeoutId);
    });
    this.timeouts.clear();
    this.notifiedBuyers.clear();
    this.stopExpiredPaymentCleanup();
  }
}

export default new PaymentTimeoutService();
