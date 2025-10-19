import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export const registerUser = async (userData) => {
  try {
    // Create user account with email and password
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );

    const user = userCredential.user;

    // Prepare user data for Firestore (excluding password)
    const userProfile = {
      uid: user.uid,
      email: userData.email,
      firstName: userData.firstName,
      middleName: userData.middleName || '',
      lastName: userData.lastName,
      region: userData.region,
      province: userData.province,
      city: userData.city,
      barangay: userData.barangay,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isProfileComplete: true,
      profilePicture: null,
      phoneNumber: null,
      bio: null,
      preferences: {
        notifications: true,
        emailUpdates: true
      }
    };

    // Save user profile to Firestore
    await setDoc(doc(db, 'users', user.uid), userProfile);

    return {
      success: true,
      user: userProfile,
      message: 'Account created successfully!'
    };
  } catch (error) {
    let errorMessage = 'An error occurred during registration.';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'An account with this email already exists.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Please enter a valid email address.';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password should be at least 6 characters long.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      default:
        errorMessage = error.message || errorMessage;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user profile from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userProfile = userDoc.exists() ? userDoc.data() : null;

    // Even if profile fetch fails, authentication succeeded
    // The AuthContext will handle profile creation/fetching later
    console.log('Login process completed successfully');
    console.log('Final user profile:', userProfile);
    console.log('User UID:', user.uid);
    console.log('User email:', user.email);
    
    return {
      success: true,
      user: userProfile,
      message: 'Login successful!',
      uid: user.uid,
      email: user.email,
      isNewProfile: userProfile?.isNewUser || false
    };
  } catch (error) {
    let errorMessage = 'An error occurred during login.';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Please enter a valid email address.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      default:
        errorMessage = error.message || errorMessage;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: 'Failed to logout' };
  }
};

export const getUserProfile = async (uid) => {
  try {
    console.log('🔍 Attempting to fetch profile for UID:', uid);
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (userDoc.exists()) {
      const profile = userDoc.data();
      console.log('✅ User profile found:', profile.firstName);
      return profile;
    }
    
    console.log('ℹ️ No user profile found for:', uid);
    return null;
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    
    // Check if it's a permission error
    if (error.code === 'permission-denied' || error.message.includes('permissions')) {
      console.log('ℹ️ Permission denied - user might not be fully authenticated yet');
      return null;
    }
    
    // Check if it's a not-found error
    if (error.code === 'not-found') {
      console.log('ℹ️ Profile not found in database');
      return null;
    }
    
    // For other errors, just log and return null
    console.log('ℹ️ Could not fetch user profile:', error.message);
    return null;
  }
};

// Direct Account Creation (No OTP Required)
export const createAccountDirectly = async (userData) => {
  try {
    console.log('🚀 Creating account directly for:', userData.email);
    
    // Create user account with Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );

    const user = userCredential.user;
    console.log('✅ User account created successfully:', user.uid);

    // Prepare user profile for Firestore
    const userProfile = {
      uid: user.uid,
      email: userData.email,
      firstName: userData.firstName,
      middleName: userData.middleName || '',
      lastName: userData.lastName,
      region: userData.region,
      province: userData.province,
      city: userData.city,
      barangay: userData.barangay,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isProfileComplete: true,
      profilePicture: null,
      phoneNumber: null,
      bio: null,
      preferences: {
        notifications: true,
        emailUpdates: true
      }
    };

    // Save user profile to Firestore
    await setDoc(doc(db, 'users', user.uid), userProfile);
    console.log('✅ User profile saved to Firestore');

    return {
      success: true,
      user: userProfile,
      message: 'Account created successfully!'
    };
  } catch (error) {
    console.error('❌ Error in createAccountDirectly:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-in-use') {
      return {
        success: false,
        error: 'An account with this email already exists. Please use a different email or try logging in.'
      };
    } else if (error.code === 'auth/weak-password') {
      return {
        success: false,
        error: 'Password is too weak. Please choose a stronger password.'
      };
    } else if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        error: 'Invalid email address. Please enter a valid email.'
      };
    } else {
      return {
        success: false,
        error: 'Failed to create account. Please try again.'
      };
    }
  }
};

// Simple authentication test function
export const testBasicAuth = async (email, password) => {
  try {
    console.log('🧪 Testing basic authentication for:', email);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ Basic authentication successful!');
    console.log('User ID:', user.uid);
    console.log('User email:', user.email);
    
    // Sign out after test
    await signOut(auth);
    console.log('✅ Test completed, user signed out');
    
    return {
      success: true,
      uid: user.uid,
      email: user.email,
      message: 'Basic authentication test successful!'
    };
    
  } catch (error) {
    console.error('❌ Basic authentication test failed:', error);
    
    let errorMessage = 'Authentication failed.';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      default:
        errorMessage = error.message || errorMessage;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};
