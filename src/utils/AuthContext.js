import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { getUserProfile } from './auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('useAuth must be used within an AuthProvider');
    // Return fallback values to prevent crashes
    return {
      currentUser: null,
      userProfile: null,
      loading: false,
      isAuthenticated: false,
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          console.log('🔐 User authenticated:', user.uid);
          setCurrentUser(user);
          
          // Fetch user profile immediately after authentication
          try {
            console.log('🔍 Fetching user profile after authentication...');
            const profile = await getUserProfile(user.uid);
            if (profile) {
              console.log('✅ User profile loaded in AuthContext:', profile.firstName);
              setUserProfile(profile);
            } else {
              console.log('ℹ️ No profile found, will be created later');
              setUserProfile(null);
            }
          } catch (error) {
            console.warn('⚠️ Could not fetch profile in AuthContext:', error.message);
            setUserProfile(null);
          }
        } else {
          console.log('🔓 User signed out');
          setCurrentUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('❌ Error in auth state change:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    error,
    isAuthenticated: !!currentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
