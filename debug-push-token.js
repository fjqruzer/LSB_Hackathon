// Debug script to test push token registration
// Run this with: node debug-push-token.js

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

async function checkUserPushTokens() {
  try {
    console.log('🔍 Checking user push tokens in database...\n');
    
    // Get all users
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    console.log(`📊 Found ${querySnapshot.docs.length} users in database\n`);
    
    querySnapshot.docs.forEach((doc, index) => {
      const userData = doc.data();
      console.log(`👤 User ${index + 1}: ${userData.displayName || 'Unknown'} (${userData.email})`);
      console.log(`   UID: ${doc.id}`);
      console.log(`   Push Token: ${userData.pushToken || 'Not set'}`);
      console.log(`   Token Status: ${userData.tokenStatus || 'Not set'}`);
      console.log(`   Token Type: ${userData.tokenType || 'Not set'}`);
      console.log(`   Notifications Enabled: ${userData.notificationsEnabled || false}`);
      console.log(`   Last Updated: ${userData.pushTokenUpdatedAt ? new Date(userData.pushTokenUpdatedAt.seconds * 1000).toLocaleString() : 'Not set'}`);
      console.log('   ---');
    });
    
    // Check for users with "local-notifications-enabled" token
    const problematicUsers = querySnapshot.docs.filter(doc => {
      const userData = doc.data();
      return userData.pushToken === 'local-notifications-enabled' || 
             userData.pushToken === 'push-token-failed' ||
             userData.pushToken === 'no-permissions' ||
             userData.pushToken === 'expo-go-mode' ||
             userData.pushToken === 'no-project-id';
    });
    
    if (problematicUsers.length > 0) {
      console.log(`\n⚠️ Found ${problematicUsers.length} users with problematic push tokens:`);
      problematicUsers.forEach((doc, index) => {
        const userData = doc.data();
        console.log(`   ${index + 1}. ${userData.displayName || 'Unknown'} - Token: ${userData.pushToken}`);
      });
    } else {
      console.log('\n✅ All users have valid push tokens!');
    }
    
    // Check for users with valid push tokens
    const validUsers = querySnapshot.docs.filter(doc => {
      const userData = doc.data();
      return userData.pushToken && 
             userData.pushToken.startsWith('ExponentPushToken[') && 
             userData.pushToken.endsWith(']');
    });
    
    console.log(`\n📱 Users with valid push tokens: ${validUsers.length}`);
    
  } catch (error) {
    console.error('❌ Error checking user push tokens:', error);
  }
}

async function main() {
  try {
    console.log('🚀 Starting push token debug...\n');
    await checkUserPushTokens();
    console.log('\n✅ Debug complete!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();

