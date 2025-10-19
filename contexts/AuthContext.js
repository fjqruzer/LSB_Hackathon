import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import NotificationService from '../services/NotificationService';
import EmailService from '../services/EmailService';
import PresenceService from '../services/PresenceService';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe;
    
    // Add a small delay to ensure Firebase is fully initialized
    const initializeAuth = async () => {
      try {
        // Wait a bit to ensure Firebase is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          console.log('🔐 Auth state changed:', user ? `User logged in: ${user.email}` : 'User logged out');
          console.log('🔐 User object:', user ? { uid: user.uid, email: user.email, displayName: user.displayName } : 'null');
          
          if (user) {
            // User logged in - initialize presence tracking
            await PresenceService.initializePresence(user.uid);
          } else {
            // User logged out - cleanup presence tracking
            await PresenceService.cleanup();
          }
          
          setUser(user);
          setLoading(false);
        });
      } catch (error) {
        console.error('❌ Error setting up auth state listener:', error);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      // Cleanup presence tracking when AuthProvider unmounts
      PresenceService.cleanup();
    };
  }, []);

  const signup = async (email, password, displayName, userData) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name
      if (displayName) {
        await updateProfile(userCredential.user, {
          displayName: displayName
        });
      }
      
      // Store additional user data in Firestore
      if (userData) {
        const userDoc = {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          username: userData.username,
          firstName: userData.firstName,
          middleName: userData.middleName || '',
          lastName: userData.lastName,
          displayName: displayName,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
        } catch (firestoreError) {
          console.error('Firestore error:', firestoreError);
          throw firestoreError;
        }
      }
      
      // Send welcome email (don't wait for it to complete)
      try {
        const firstName = userData?.firstName || displayName?.split(' ')[0] || 'there';
        EmailService.sendWelcomeEmail(email, firstName).catch(error => {
          console.error('Welcome email error (non-blocking):', error);
        });
      } catch (error) {
        console.error('Welcome email error (non-blocking):', error);
      }
      
      return userCredential.user;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Update push token after successful login
      await updateUserPushToken(userCredential.user.uid);
      
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const forgotPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  };

  // Delete user account completely (both Auth and Firestore)
  const deleteUserAccount = async () => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      // Delete user data from Firestore
      await deleteDoc(doc(db, 'users', user.uid));
      // Delete user from Firebase Auth
      await deleteUser(user);
      // Sign out the user
      await signOut(auth);
      
      return true;
    } catch (error) {
      console.error('Error deleting user account:', error);
      throw error;
    }
  };

  const getUserProfile = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  };

  // Check if email already exists
  const checkEmailExists = async (email) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking email existence:', error);
      return false; // Assume it doesn't exist if there's an error
    }
  };

  // Check if username already exists
  const checkUsernameExists = async (username) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking username existence:', error);
      return false; // Assume it doesn't exist if there's an error
    }
  };

  // Update user's push notification token
  const updateUserPushToken = async (uid) => {
    try {
      const pushToken = await NotificationService.registerForPushNotificationsAsync();
      if (pushToken) {
        // Only store actual push tokens, not placeholder values
        if (pushToken !== 'local-notifications-enabled') {
          await updateDoc(doc(db, 'users', uid), {
            pushToken: pushToken,
            pushTokenUpdatedAt: new Date()
          });
          } else {
          // Store a flag that notifications are enabled
          await updateDoc(doc(db, 'users', uid), {
            notificationsEnabled: true,
            pushTokenUpdatedAt: new Date()
          });
        }
      } else {
        }
    } catch (error) {
      console.error('❌ Error updating push token:', error);
    }
  };

  // Force update push token (for testing)
  const forceUpdatePushToken = async () => {
    if (user) {
      await updateUserPushToken(user.uid);
    }
  };

  // Get user's push token
  const getUserPushToken = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data().pushToken;
      }
      return null;
    } catch (error) {
      console.error('Error getting user push token:', error);
      return null;
    }
  };

  // Test function to verify Firestore connection
  const testFirestore = async () => {
    try {
      const testDoc = {
        test: true,
        timestamp: new Date()
      };
      
      await setDoc(doc(db, 'test', 'test123'), testDoc);
      
      // Clean up test document
      // await deleteDoc(doc(db, 'test', 'test123'));
      
      return true;
    } catch (error) {
      console.error('Firestore test failed:', error);
      return false;
    }
  };

  // Update presence status manually
  const updatePresenceStatus = async (isOnline) => {
    if (user) {
      await PresenceService.updatePresence(user.uid, isOnline);
    }
  };

  // Get current presence status
  const getPresenceStatus = () => {
    return PresenceService.getPresenceStatus();
  };

  const value = {
    user,
    signup,
    login,
    logout,
    forgotPassword,
    deleteUserAccount,
    getUserProfile,
    testFirestore,
    checkEmailExists,
    checkUsernameExists,
    updateUserPushToken,
    forceUpdatePushToken,
    getUserPushToken,
    updatePresenceStatus,
    getPresenceStatus,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};