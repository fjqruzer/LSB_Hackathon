// Comprehensive test to check expiration notification system
// This will help identify the exact issue

import { db } from './config/firebase';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import ExpirationCheckService from './services/ExpirationCheckService';
import ExpirationNotificationService from './services/ExpirationNotificationService';

async function comprehensiveTest() {
  console.log('🧪 COMPREHENSIVE EXPIRATION TEST STARTING...');
  console.log('=' .repeat(60));
  
  try {
    // 1. Check service status
    console.log('\n📊 1. SERVICE STATUS CHECK');
    const status = ExpirationCheckService.getStatus();
    console.log('   ExpirationCheckService Status:', status);
    
    if (!status.isRunning) {
      console.log('❌ SERVICE NOT RUNNING - Starting it now...');
      ExpirationCheckService.start();
      
      // Wait a moment and check again
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStatus = ExpirationCheckService.getStatus();
      console.log('   New Status:', newStatus);
    }
    
    // 2. Create a test listing that expires in 10 seconds
    console.log('\n📝 2. CREATING TEST LISTING');
    const testListingId = 'test-expiration-' + Date.now();
    const testListing = {
      id: testListingId,
      title: 'Test Expiration Listing',
      sellerId: 'test-seller-' + Date.now(),
      sellerName: 'Test Seller',
      status: 'active',
      endDateTime: new Date(Date.now() + 10000), // Expires in 10 seconds
      priceType: 'msl',
      minePrice: 100,
      stealPrice: 150,
      lockPrice: 200,
      createdAt: serverTimestamp(),
    };
    
    console.log('   Creating listing:', testListingId);
    console.log('   Expires at:', testListing.endDateTime.toISOString());
    
    // Add to Firestore
    await addDoc(collection(db, 'listings'), testListing);
    
    // Add test participants
    const testActions = [
      {
        listingId: testListingId,
        userId: 'test-participant-1',
        userName: 'Test Participant 1',
        action: 'Mined',
        details: 'Mined for ₱100',
        timestamp: serverTimestamp()
      }
    ];
    
    for (const action of testActions) {
      await addDoc(collection(db, 'activityLogs'), action);
    }
    
    console.log('   Added test participants');
    
    // 3. Wait for expiration
    console.log('\n⏰ 3. WAITING FOR EXPIRATION (15 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // 4. Check if listing is still active
    console.log('\n🔍 4. CHECKING LISTING STATUS');
    const listingQuery = query(
      collection(db, 'listings'),
      where('id', '==', testListingId)
    );
    
    const listingSnapshot = await getDocs(listingQuery);
    if (listingSnapshot.empty) {
      console.log('❌ Test listing not found!');
      return;
    }
    
    const listing = listingSnapshot.docs[0].data();
    console.log('   Listing status:', listing.status);
    console.log('   End time:', listing.endDateTime?.toDate?.()?.toISOString());
    
    // 5. Manually trigger expiration check
    console.log('\n🔍 5. MANUAL EXPIRATION CHECK');
    try {
      const expiredCount = await ExpirationNotificationService.checkExpiredListings();
      console.log('   Manual check result:', expiredCount, 'expired listings');
    } catch (error) {
      console.error('   Manual check error:', error);
    }
    
    // 6. Check for notifications
    console.log('\n📬 6. CHECKING FOR NOTIFICATIONS');
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('data.listingId', '==', testListingId)
    );
    
    const notificationsSnapshot = await getDocs(notificationsQuery);
    console.log('   Notifications found:', notificationsSnapshot.size);
    
    notificationsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`     ${index + 1}. ${data.title} - ${data.recipientId} (${data.data?.type})`);
    });
    
    // 7. Check for activity logs
    console.log('\n📝 7. CHECKING FOR ACTIVITY LOGS');
    const activityQuery = query(
      collection(db, 'activityLogs'),
      where('listingId', '==', testListingId)
    );
    
    const activitySnapshot = await getDocs(activityQuery);
    console.log('   Activity logs found:', activitySnapshot.size);
    
    activitySnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`     ${index + 1}. ${data.action} - ${data.userName}`);
    });
    
    // 8. Test service interval
    console.log('\n⏰ 8. TESTING SERVICE INTERVAL');
    console.log('   Waiting 20 seconds to see if service processes the listing...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Check again
    const finalNotificationsSnapshot = await getDocs(notificationsQuery);
    console.log('   Final notifications count:', finalNotificationsSnapshot.size);
    
    // 9. Summary
    console.log('\n📋 9. TEST SUMMARY');
    console.log('=' .repeat(40));
    console.log(`   Service Running: ${ExpirationCheckService.getStatus().isRunning}`);
    console.log(`   Test Listing Created: ${testListingId}`);
    console.log(`   Notifications Created: ${finalNotificationsSnapshot.size}`);
    console.log(`   Activity Logs Created: ${activitySnapshot.size}`);
    
    if (finalNotificationsSnapshot.size === 0) {
      console.log('\n❌ ISSUE IDENTIFIED: No notifications were created!');
      console.log('   Possible causes:');
      console.log('   1. Service not running properly');
      console.log('   2. Firebase query issues');
      console.log('   3. Notification creation failing');
      console.log('   4. Duplicate prevention too aggressive');
    } else {
      console.log('\n✅ SUCCESS: Notifications were created!');
    }
    
    console.log('\n🎉 COMPREHENSIVE TEST COMPLETED!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
comprehensiveTest();
