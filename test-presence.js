// Test script to verify presence system
// Run this with: node test-presence.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, getDoc } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCOfzExqkWGCaWK0UyL8y7G1h7SfyFm560",
  authDomain: "copit-ce43f.firebaseapp.com",
  projectId: "copit-ce43f",
  storageBucket: "copit-ce43f.firebasestorage.app",
  messagingSenderId: "357039645731",
  appId: "1:357039645731:web:460a02d30811bd83437d96",
  measurementId: "G-MQT39KJPG1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUserPresence() {
  try {
    console.log('🔍 Checking user presence status...\n');
    
    // Get all users
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    console.log(`📊 Found ${querySnapshot.docs.length} users in database\n`);
    
    querySnapshot.docs.forEach((doc, index) => {
      const userData = doc.data();
      console.log(`👤 User ${index + 1}: ${userData.displayName || 'Unknown'} (${userData.email})`);
      console.log(`   UID: ${doc.id}`);
      console.log(`   Online Status: ${userData.isOnline ? '🟢 Online' : '🔴 Offline'}`);
      console.log(`   Last Seen: ${userData.lastSeen ? new Date(userData.lastSeen.seconds * 1000).toLocaleString() : 'Never'}`);
      console.log(`   Presence Updated: ${userData.presenceUpdatedAt ? new Date(userData.presenceUpdatedAt.seconds * 1000).toLocaleString() : 'Never'}`);
      console.log('   ---');
    });
    
    // Check for online users
    const onlineUsers = querySnapshot.docs.filter(doc => {
      const userData = doc.data();
      return userData.isOnline === true;
    });
    
    console.log(`\n🟢 Online users: ${onlineUsers.length}`);
    
    // Check for offline users
    const offlineUsers = querySnapshot.docs.filter(doc => {
      const userData = doc.data();
      return userData.isOnline === false;
    });
    
    console.log(`🔴 Offline users: ${offlineUsers.length}`);
    
    // Check for users without presence data
    const noPresenceUsers = querySnapshot.docs.filter(doc => {
      const userData = doc.data();
      return userData.isOnline === undefined;
    });
    
    console.log(`❓ Users without presence data: ${noPresenceUsers.length}`);
    
    if (noPresenceUsers.length > 0) {
      console.log('\n⚠️ Users without presence data:');
      noPresenceUsers.forEach((doc, index) => {
        const userData = doc.data();
        console.log(`   ${index + 1}. ${userData.displayName || 'Unknown'} (${userData.email})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking user presence:', error);
  }
}

async function main() {
  try {
    console.log('🚀 Starting presence check...\n');
    await checkUserPresence();
    console.log('\n✅ Presence check complete!');
    console.log('\n💡 To test the presence system:');
    console.log('   1. Login to the app on a device');
    console.log('   2. Check if the user shows as online');
    console.log('   3. Close the app or put it in background');
    console.log('   4. Check if the user shows as offline');
    console.log('   5. Reopen the app');
    console.log('   6. Check if the user shows as online again');
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
