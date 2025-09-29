import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import NotificationManager from './NotificationManager';

class PaymentTimeoutService {
  constructor() {
    this.timeouts = new Map(); // Track active timeouts
    this.timeoutDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
  }

  // Start payment timeout for a listing
  async startPaymentTimeout(listingId, winnerId, actionType, amount) {
    try {
      
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
      if (existingSnapshot.empty) {
        // Create payment record for the winner
        await this.createPaymentRecord(listing, buyer);
      } else {
      }
      
      // Set new timeout
      const timeoutId = setTimeout(async () => {
        await this.handlePaymentTimeout(listingId, winnerId, actionType, amount);
      }, this.timeoutDuration);
      
      this.timeouts.set(listingId, {
        timeoutId,
        winnerId,
        actionType,
        amount,
        startTime: Date.now()
      });
      
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
      
      // Find the next buyer (skip the current winner)
      const nextBuyer = sortedActions.find(action => action.userId !== currentWinnerId);
      
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
      const title = `🎉 You're Next! Payment Required`;
      const body = `The previous buyer didn't submit payment in time. You're now the winner of "${listing.title}" with ${buyer.action} action. Please submit your payment proof within 3 minutes.`;
      
      await NotificationManager.createNotification(
        buyer.userId,
        title,
        body,
        {
          type: 'payment_required',
          listingId: listing.id,
          actionType: buyer.action,
          amount: this.extractAmountFromDetails(buyer.details),
          sellerId: listing.sellerId,
          isNextBuyer: true
        }
      );
      
    } catch (error) {
      console.error('❌ Error notifying next buyer:', error);
    }
  }

  // Notify seller that no one can pay
  async notifySellerNoPayment(listing, lastWinnerId) {
    try {
      const title = `⏰ Payment Timeout - No Buyers Available`;
      const body = `All potential buyers for "${listing.title}" have failed to submit payment within the time limit. The listing will be marked as expired with no sale.`;
      
      await NotificationManager.createNotification(
        listing.sellerId,
        title,
        body,
        {
          type: 'payment_timeout_no_buyers',
          listingId: listing.id,
          lastWinnerId
        }
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

  // Clear all timeouts (for cleanup)
  clearAllTimeouts() {
    this.timeouts.forEach((timeout, listingId) => {
      clearTimeout(timeout.timeoutId);
    });
    this.timeouts.clear();
  }
}

export default new PaymentTimeoutService();
