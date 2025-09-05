import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyB4FFOzyf2km_d0rfn3LeknJzHIwCL3Ujw",
  authDomain: "copit-090603.firebaseapp.com",
  projectId: "copit-090603",
  storageBucket: "copit-090603.firebasestorage.app",
  messagingSenderId: "188423320531",
  appId: "1:188423320531:web:6f988f7b47634ce7b5f526"
};

// Initialize Firebase
let app;
try {
  // Check if Firebase app is already initialized
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('Firebase app initialized');
  } else {
    app = getApp();
    console.log('Firebase app already initialized, using existing instance');
  }
} catch (error) {
  console.error('Firebase app initialization error:', error);
  throw error;
}

// Initialize Firebase Authentication and get a reference to the service
let auth;
try {
  // Check if auth is already initialized
  try {
    auth = getAuth(app);
    console.log('Firebase auth already initialized, using existing instance');
  } catch (error) {
    // If getAuth fails, initialize auth
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log('Firebase auth initialized');
  }
} catch (error) {
  console.error('Firebase auth initialization error:', error);
  throw error;
}

// Initialize Firestore and get a reference to the service
let db;
try {
  db = getFirestore(app);
} catch (error) {
  console.error('Firestore db initialization error:', error);
  throw error;
}

// Initialize Firebase Storage and get a reference to the service
let storage;
try {
  console.log('Initializing Firebase Storage...');
  console.log('App instance:', app);
  storage = getStorage(app, 'gs://copit-090603.firebasestorage.app');
  console.log('Firebase Storage initialized successfully:', storage);
} catch (error) {
  console.error('Firebase storage initialization error:', error);
  throw error;
}

export { auth, db, storage };
export default app;
