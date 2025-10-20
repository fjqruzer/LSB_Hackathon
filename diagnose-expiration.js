// Diagnostic script to check expiration notification system
// This script will help identify why notifications aren't working

import { db } from './config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import ExpirationCheckService from './services/ExpirationCheckService';
import ExpirationNotificationService from './services/ExpirationNotificationService';

async function diagnoseExpirationSystem() {
  console.log('🔍 DIAGNOSTIC: Checking expiration notification system...');
  
  try {
    // 1. Check ExpirationCheckService status
    console.log('\n📊 1. ExpirationCheckService Status:');
    const serviceStatus = ExpirationCheckService.getStatus();
    console.log('   Service Status:', serviceStatus);
    
    // 2. Check for active listings
    console.log('\n📋 2. Checking active listings...');
    const activeListingsQuery = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      orderBy('endDateTime', 'desc'),
      limit(10)
    );
    
    const activeListingsSnapshot = await getDocs(activeListingsQuery);
    console.log(`   Found ${activeListingsSnapshot.size} active listings`);
    
    const now = new Date();
    const expiredListings = [];
    const soonToExpire = [];
    
    activeListingsSnapshot.forEach((doc) => {
      const listing = { id: doc.id, ...doc.data() };
      
      if (listing.endDateTime) {
        let endTime;
        
        // Handle different date formats
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
        
        const timeUntilExpiry = endTime.getTime() - now.getTime();
        const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
        
        if (timeUntilExpiry <= 0) {
          expiredListings.push({
            id: listing.id,
            title: listing.title,
            expiredAt: endTime.toISOString(),
            hoursAgo: Math.abs(hoursUntilExpiry).toFixed(2)
          });
        } else if (hoursUntilExpiry <= 1) {
          soonToExpire.push({
            id: listing.id,
            title: listing.title,
            expiresAt: endTime.toISOString(),
            hoursLeft: hoursUntilExpiry.toFixed(2)
          });
        }
      }
    });
    
    console.log(`   Expired listings: ${expiredListings.length}`);
    expiredListings.forEach(listing => {
      console.log(`     - ${listing.title} (expired ${listing.hoursAgo}h ago)`);
    });
    
    console.log(`   Soon to expire (within 1 hour): ${soonToExpire.length}`);
    soonToExpire.forEach(listing => {
      console.log(`     - ${listing.title} (expires in ${listing.hoursLeft}h)`);
    });
    
    // 3. Check for recent notifications
    console.log('\n📬 3. Checking recent notifications...');
    const notificationsQuery = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const notificationsSnapshot = await getDocs(notificationsQuery);
    console.log(`   Found ${notificationsSnapshot.size} recent notifications`);
    
    const expirationNotifications = [];
    notificationsSnapshot.forEach((doc) => {
      const notification = doc.data();
      if (notification.data?.type && 
          ['payment_required', 'winner_determined', 'listing_expired_lost'].includes(notification.data.type)) {
        expirationNotifications.push({
          id: doc.id,
          title: notification.title,
          type: notification.data.type,
          recipientId: notification.recipientId,
          createdAt: notification.createdAt?.toDate?.()?.toISOString() || 'Unknown'
        });
      }
    });
    
    console.log(`   Expiration-related notifications: ${expirationNotifications.length}`);
    expirationNotifications.forEach(notif => {
      console.log(`     - ${notif.title} (${notif.type}) - ${notif.createdAt}`);
    });
    
    // 4. Check for activity logs
    console.log('\n📝 4. Checking recent activity logs...');
    const activityQuery = query(
      collection(db, 'activityLogs'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    
    const activitySnapshot = await getDocs(activityQuery);
    console.log(`   Found ${activitySnapshot.size} recent activity logs`);
    
    const expirationActivities = [];
    activitySnapshot.forEach((doc) => {
      const activity = doc.data();
      if (activity.action && 
          ['Listing Expired - Winner', 'Listing Expired - No Winner', 'Winner Determined'].includes(activity.action)) {
        expirationActivities.push({
          id: doc.id,
          action: activity.action,
          listingId: activity.listingId,
          timestamp: activity.timestamp?.toDate?.()?.toISOString() || 'Unknown'
        });
      }
    });
    
    console.log(`   Expiration-related activities: ${expirationActivities.length}`);
    expirationActivities.forEach(activity => {
      console.log(`     - ${activity.action} (${activity.listingId}) - ${activity.timestamp}`);
    });
    
    // 5. Test manual expiration check
    console.log('\n🧪 5. Testing manual expiration check...');
    try {
      const expiredCount = await ExpirationNotificationService.checkExpiredListings();
      console.log(`   Manual check found ${expiredCount} expired listings to process`);
    } catch (error) {
      console.error('   Error in manual check:', error);
    }
    
    // 6. Summary and recommendations
    console.log('\n📋 SUMMARY:');
    console.log(`   - Service running: ${serviceStatus.isRunning}`);
    console.log(`   - Active listings: ${activeListingsSnapshot.size}`);
    console.log(`   - Expired listings: ${expiredListings.length}`);
    console.log(`   - Recent expiration notifications: ${expirationNotifications.length}`);
    console.log(`   - Recent expiration activities: ${expirationActivities.length}`);
    
    if (!serviceStatus.isRunning) {
      console.log('\n❌ ISSUE: ExpirationCheckService is not running!');
      console.log('   Solution: Check if user is logged in and service is started');
    }
    
    if (expiredListings.length === 0) {
      console.log('\n⚠️  INFO: No expired listings found');
      console.log('   This might be why no notifications are sent');
    }
    
    if (expiredListings.length > 0 && expirationNotifications.length === 0) {
      console.log('\n❌ ISSUE: Found expired listings but no notifications!');
      console.log('   This indicates the notification system is not working');
    }
    
    console.log('\n✅ Diagnostic completed!');
    
  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
  }
}

// Run the diagnostic
diagnoseExpirationSystem();
