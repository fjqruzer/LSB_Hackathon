// Test script to verify expiration notification fixes
// This script tests the improved notification system for listing expiration

import { db } from './config/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import ExpirationNotificationService from './services/ExpirationNotificationService';

async function testExpirationFix() {
  console.log('🧪 Testing improved expiration notification system...');
  
  try {
    // Create a test listing that expires in 30 seconds
    const testListing = {
      id: 'test-listing-fix-' + Date.now(),
      title: 'Test Item for Expiration Fix',
      sellerId: 'test-seller-fix-123',
      sellerName: 'Test Seller Fix',
      status: 'active',
      endDateTime: new Date(Date.now() + 30000), // Expires in 30 seconds
      priceType: 'msl',
      minePrice: 100,
      stealPrice: 150,
      lockPrice: 200,
      createdAt: serverTimestamp(),
    };
    
    console.log('📝 Creating test listing:', testListing.id);
    
    // Create test listing in Firestore
    await addDoc(collection(db, 'listings'), testListing);
    
    // Create test viewers
    const testViewers = [
      { userId: 'viewer-fix-1', userName: 'Test Viewer Fix 1' },
      { userId: 'viewer-fix-2', userName: 'Test Viewer Fix 2' },
    ];
    
    console.log('👀 Creating test viewers...');
    
    // Add viewers to listingViews collection
    for (const viewer of testViewers) {
      await addDoc(collection(db, 'listingViews'), {
        listingId: testListing.id,
        userId: viewer.userId,
        viewedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    }
    
    // Create test actions (participants) - one will be the winner
    const testActions = [
      {
        listingId: testListing.id,
        userId: 'participant-fix-1',
        userName: 'Test Participant Fix 1',
        action: 'Mined',
        details: 'Mined for ₱100',
        timestamp: serverTimestamp()
      },
      {
        listingId: testListing.id,
        userId: 'participant-fix-2',
        userName: 'Test Participant Fix 2',
        action: 'Bid',
        details: 'Bid for ₱120',
        timestamp: serverTimestamp()
      }
    ];
    
    console.log('🎯 Creating test actions...');
    
    // Add actions to activityLogs collection
    for (const action of testActions) {
      await addDoc(collection(db, 'activityLogs'), action);
    }
    
    console.log('⏰ Waiting for listing to expire (30 seconds)...');
    console.log('📊 Test setup complete:');
    console.log(`   - Listing: ${testListing.id}`);
    console.log(`   - Viewers: ${testViewers.length}`);
    console.log(`   - Participants: ${testActions.length}`);
    console.log(`   - Expires at: ${testListing.endDateTime.toISOString()}`);
    console.log(`   - Expected winner: ${testActions[0].userName} (Mined action has higher priority)`);
    
    // Wait for expiration
    setTimeout(async () => {
      console.log('🔍 Checking for expired listings...');
      
      try {
        // Manually trigger expiration check
        const expiredCount = await ExpirationNotificationService.checkExpiredListings();
        console.log(`✅ Found ${expiredCount} expired listings`);
        
        // Wait a moment for notifications to be created
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if notifications were created
        const notificationsQuery = collection(db, 'notifications');
        const notificationsSnapshot = await getDocs(notificationsQuery);
        
        const testNotifications = notificationsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.data?.listingId === testListing.id;
        });
        
        console.log(`📬 Created ${testNotifications.length} notifications for test listing`);
        
        // Log notification details
        testNotifications.forEach((doc, index) => {
          const data = doc.data();
          console.log(`   ${index + 1}. ${data.title} - ${data.recipientId} (${data.data?.type})`);
        });
        
        // Check for specific notification types
        const paymentRequiredNotifications = testNotifications.filter(doc => 
          doc.data().data?.type === 'payment_required'
        );
        const winnerDeterminedNotifications = testNotifications.filter(doc => 
          doc.data().data?.type === 'winner_determined'
        );
        const expiredLostNotifications = testNotifications.filter(doc => 
          doc.data().data?.type === 'listing_expired_lost'
        );
        
        console.log('📊 Notification breakdown:');
        console.log(`   - Payment required: ${paymentRequiredNotifications.length}`);
        console.log(`   - Winner determined: ${winnerDeterminedNotifications.length}`);
        console.log(`   - Listing expired (lost): ${expiredLostNotifications.length}`);
        
        // Check if activity logs were created
        const activityQuery = query(
          collection(db, 'activityLogs'),
          where('listingId', '==', testListing.id),
          where('action', '==', 'Listing Expired - Winner')
        );
        
        const activitySnapshot = await getDocs(activityQuery);
        console.log(`📝 Activity logs created: ${activitySnapshot.size}`);
        
        if (testNotifications.length >= 3) {
          console.log('✅ Test PASSED: All expected notifications were created!');
        } else {
          console.log('❌ Test FAILED: Expected at least 3 notifications (winner, seller, participants)');
        }
        
        console.log('✅ Test completed successfully!');
        
      } catch (error) {
        console.error('❌ Error during expiration check:', error);
      }
    }, 35000); // Wait 35 seconds (30 seconds + 5 seconds buffer)
    
  } catch (error) {
    console.error('❌ Error setting up test:', error);
  }
}

// Run the test
testExpirationFix();
