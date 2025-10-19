import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { NotificationListenerProvider } from './contexts/NotificationListenerContext';
import { NotificationNavigationProvider, useNotificationNavigation } from './contexts/NotificationNavigationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import OTPVerificationScreen from './screens/OTPVerificationScreen';
import MainNavigation from './components/MainNavigation';
import NotificationService from './services/NotificationService';
import ExpirationNotificationService from './services/ExpirationNotificationService';
import ExpirationCheckService from './services/ExpirationCheckService';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './config/firebase';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const AuthStack = createStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator 
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    </AuthStack.Navigator>
  );
}

// Suppress Expo notifications warnings and errors
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  const message = args[0]?.toString() || '';
  if (message.includes('expo-notifications') || 
      message.includes('reading dataString is deprecated') ||
      message.includes('not fully supported in Expo Go') ||
      message.includes('We recommend you instead use a development build')) {
    return;
  }
  originalWarn.apply(console, args);
};

console.error = (...args) => {
  const message = args[0]?.toString() || '';
  if (message.includes('expo-notifications') ||
      message.includes('Android Push notifications') ||
      message.includes('was removed from Expo Go') ||
      message.includes('Use a development build instead')) {
    return;
  }
  originalError.apply(console, args);
};

function AppNavigator() {
  const { user, loading } = useAuth();
  const { handleNotificationClick } = useNotificationNavigation();
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(true);

  // Initialize notifications and expiration check service
  useEffect(() => {
    // Only run if user is logged in
    if (!user) {
      console.log('⚠️ No user logged in, skipping service initialization');
      return;
    }

    const initializeServices = async () => {
      try {
        // Ensure Firebase is initialized before proceeding
        console.log('🔥 Initializing Firebase services...');
        console.log('👤 Current user:', user.uid);
        
        const token = await NotificationService.registerForPushNotificationsAsync();
        console.log('📱 Received token from NotificationService:', token);
        console.log('📱 Token type:', typeof token);
        console.log('📱 Token length:', token ? token.length : 'null');
        
        if (user) {
          // Determine if this is a valid push token
          const isValidPushToken = token && 
            token.startsWith('ExponentPushToken[') && 
            token.endsWith(']') &&
            token !== 'local-notifications-enabled' &&
            token !== 'push-token-failed' &&
            token !== 'no-permissions' &&
            token !== 'expo-go-mode' &&
            token !== 'no-project-id';
          
          // Always save token information to user profile
          const tokenData = {
            pushToken: token || 'No token',
            pushTokenUpdatedAt: new Date(),
            notificationsEnabled: isValidPushToken,
            lastUpdated: new Date(),
            tokenStatus: isValidPushToken ? 'valid' : 'invalid',
            tokenType: token === 'expo-go-mode' ? 'expo-go' : 
                      token === 'no-permissions' ? 'no-permissions' :
                      token === 'push-token-failed' ? 'failed' :
                      token === 'no-project-id' ? 'no-project-id' :
                      isValidPushToken ? 'push-token' : 'unknown'
          };
          
          console.log('💾 Saving push token data to user profile:', tokenData);
          console.log('📊 Token analysis:', {
            originalToken: token,
            isValidPushToken: isValidPushToken,
            tokenType: tokenData.tokenType,
            willReceivePushNotifications: isValidPushToken
          });
          
          try {
            await setDoc(doc(db, 'users', user.uid), tokenData, { merge: true });
            console.log('✅ Push token data saved to user profile successfully');
            
            // Log the final state for debugging
            console.log('📊 Final push token state:', {
              token: tokenData.pushToken,
              isRealToken: isValidPushToken,
              tokenType: tokenData.tokenType,
              timestamp: tokenData.pushTokenUpdatedAt
            });
          } catch (error) {
            console.error('❌ Error saving push token to user profile:', error);
          }
        } else {
          console.log('⚠️ No user logged in, skipping token storage');
        }
        
        // Start expiration check service
        ExpirationCheckService.start();
        
        // Start expired payment cleanup service
        const { default: PaymentTimeoutService } = await import('./services/PaymentTimeoutService');
        PaymentTimeoutService.startExpiredPaymentCleanup();
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    initializeServices();
    
    // Cleanup on unmount
    return () => {
      ExpirationCheckService.stop();
    };
  }, [user]);

  // Set up notification response listener for direct navigation
  useEffect(() => {
    const setupNotificationListener = async () => {
      try {
        const { addNotificationResponseReceivedListener } = await import('expo-notifications');
        
        const responseListener = addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          
          // Handle navigation using context
          if (data && data.type === 'payment_required' && data.listingId) {
            handleNotificationClick(data);
          } else if (data && data.type === 'payment_submitted' && data.listingId) {
            handleNotificationClick(data);
          } else if (data && data.type === 'payment_approved' && data.listingId) {
            handleNotificationClick(data);
          } else if (data && data.type === 'payment_rejected' && data.listingId) {
            handleNotificationClick(data);
          }
        });
        
        return () => {
          responseListener.remove();
        };
      } catch (error) {
        console.error('Error setting up notification listener:', error);
      }
    };
    
    const cleanup = setupNotificationListener();
    return () => {
      if (cleanup) {
        cleanup.then(cleanupFn => cleanupFn && cleanupFn());
      }
    };
  }, []);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
        setIsFirstLaunch(hasCompletedOnboarding !== 'true');
        setOnboardingLoading(false);
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setIsFirstLaunch(true);
        setOnboardingLoading(false);
        await SplashScreen.hideAsync();
      }
    };

    checkOnboardingStatus();
  }, []);

  const handleOnboardingComplete = () => {
    const checkStatus = async () => {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
        setIsFirstLaunch(hasCompletedOnboarding !== 'true');
        setOnboardingLoading(false);
      } catch (error) {
        console.error('Error re-checking onboarding status:', error);
        setIsFirstLaunch(false);
        setOnboardingLoading(false);
      }
    };
    checkStatus();
  };

  // Show loading screen while checking onboarding status or auth loading
  if (onboardingLoading || loading || isFirstLaunch === null) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0'
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{
          fontSize: 18,
          color: '#333',
          marginTop: 20,
          textAlign: 'center'
        }}>
          Loading...
        </Text>
      </View>
    );
  }

  // Render the appropriate screen based on state
  if (isFirstLaunch === true) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar style="auto" />
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </NavigationContainer>
      </GestureHandlerRootView>
    );
  } else if (user) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar style="auto" />
          <MainNavigation />
        </NavigationContainer>
      </GestureHandlerRootView>
    );
  } else {
  return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar style="auto" />
          <AuthNavigator />
        </NavigationContainer>
      </GestureHandlerRootView>
    );
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <NotificationListenerProvider>
              <NotificationNavigationProvider>
              <AppNavigator />
              </NotificationNavigationProvider>
            </NotificationListenerProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}