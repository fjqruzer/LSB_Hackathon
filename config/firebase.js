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
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firebase Authentication with persistence
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app, 'gs://copit-090603.firebasestorage.app');

export { auth, db, storage };
export default app;
