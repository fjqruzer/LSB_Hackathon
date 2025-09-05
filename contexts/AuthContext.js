import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Firebase references are properly imported

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
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
      
      return userCredential.user;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
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

  const value = {
    user,
    signup,
    login,
    logout,
    getUserProfile,
    testFirestore,
    checkEmailExists,
    checkUsernameExists,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
