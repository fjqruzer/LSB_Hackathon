import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firebase Authentication with persistence
let auth;
try {
  // Always initialize with persistence to ensure login state is preserved
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log('✅ Firebase Auth initialized with persistence');
} catch (error) {
  console.log('Auth already initialized, getting existing instance...');
  if (error.code === 'auth/already-initialized') {
    // If already initialized, get the existing instance
    auth = getAuth(app);
    console.log('✅ Firebase Auth retrieved (already initialized)');
  } else {
    console.error('❌ Error initializing Firebase Auth:', error);
    throw error;
  }
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app, 'gs://copit-ce43f.firebasestorage.app');

export { auth, db, storage };
export default app;
