import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';

import HomePage from '../screens/HomePage';
import NewListingScreen from '../screens/NewListingScreen';

const NativeStack = createNativeStackNavigator();
const WebStack = createStackNavigator();

const NavigationApp = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // You can add a loading screen here if needed
    return null;
  }

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebStack.Navigator 
          initialRouteName={isAuthenticated ? "Home" : "Onboarding"} 
          screenOptions={{ headerShown: false }}
        >
          {!isAuthenticated ? (
            // Auth screens - only shown when not authenticated
            <>
              <WebStack.Screen name="Onboarding" component={OnboardingScreen} />
              <WebStack.Screen name="LoginScreen" component={LoginScreen} />
              <WebStack.Screen name="Signup" component={SignupScreen} />

            </>
          ) : (
            // App screens - only shown when authenticated
            <>
              <WebStack.Screen name="Home" component={HomePage} />
              <WebStack.Screen name="NewListing" component={NewListingScreen} />
            </>
          )}
        </WebStack.Navigator>
      ) : (
        <NativeStack.Navigator 
          initialRouteName={isAuthenticated ? "Home" : "Onboarding"} 
          screenOptions={{ headerShown: false }}
        >
          {!isAuthenticated ? (
            // Auth screens - only shown when not authenticated
            <>
              <NativeStack.Screen name="Onboarding" component={OnboardingScreen} />
              <NativeStack.Screen name="LoginScreen" component={LoginScreen} />
              <NativeStack.Screen name="Signup" component={SignupScreen} />

            </>
          ) : (
            // App screens - only shown when authenticated
            <>
              <NativeStack.Screen name="Home" component={HomePage} />
              <NativeStack.Screen name="NewListing" component={NewListingScreen} />
            </>
          )}
        </NativeStack.Navigator>
      )}
    </>
  );
};

export default NavigationApp; 