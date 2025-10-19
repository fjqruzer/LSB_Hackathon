// Test script for expiration notifications
// This script tests the notification system for listing expiration

import { db } from './config/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import ExpirationNotificationService from './services/ExpirationNotificationService';

async function testExpirationNotifications() {
  console.log('🧪 Testing expiration notification system...');
  
  try {
    // Create a test listing that expires in 1 minute
    const testListing = {
      id: 'test-listing-' + Date.now(),
      title: 'Test Item for Expiration',
      sellerId: 'test-seller-123',
      sellerName: 'Test Seller',
      status: 'active',
      endDateTime: new Date(Date.now() + 60000), // Expires in 1 minute
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
      { userId: 'viewer-1', userName: 'Test Viewer 1' },
      { userId: 'viewer-2', userName: 'Test Viewer 2' },
      { userId: 'viewer-3', userName: 'Test Viewer 3' },
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
    
    // Create test actions (participants)
    const testActions = [
      {
        listingId: testListing.id,
        userId: 'participant-1',
        userName: 'Test Participant 1',
        action: 'Mined',
        details: 'Mined for ₱100',
        timestamp: serverTimestamp()
      },
      {
        listingId: testListing.id,
        userId: 'participant-2',
        userName: 'Test Participant 2',
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
    
    console.log('⏰ Waiting for listing to expire (1 minute)...');
    console.log('📊 Test setup complete:');
    console.log(`   - Listing: ${testListing.id}`);
    console.log(`   - Viewers: ${testViewers.length}`);
    console.log(`   - Participants: ${testActions.length}`);
    console.log(`   - Expires at: ${testListing.endDateTime.toISOString()}`);
    
    // Wait for expiration
    setTimeout(async () => {
      console.log('🔍 Checking for expired listings...');
      
      try {
        // Manually trigger expiration check
        const expiredCount = await ExpirationNotificationService.checkExpiredListings();
        console.log(`✅ Found ${expiredCount} expired listings`);
        
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
          console.log(`   ${index + 1}. ${data.title} - ${data.recipientId}`);
        });
        
        console.log('✅ Test completed successfully!');
        
      } catch (error) {
        console.error('❌ Error during expiration check:', error);
      }
    }, 65000); // Wait 65 seconds (1 minute + 5 seconds buffer)
    
  } catch (error) {
    console.error('❌ Error setting up test:', error);
  }
}

// Run the test
testExpirationNotifications();
