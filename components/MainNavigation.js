import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, AppState } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigation from './BottomNavigation';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import PeopleScreen from '../screens/PeopleScreen';
import UpdatesScreen from '../screens/UpdatesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const MainNavigationContent = ({ navigation }) => {
  const [currentScreen, setCurrentScreen] = useState('marketplace');
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const appState = useRef(AppState.currentState);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Navigation bar color is handled by the system in edge-to-edge mode

  // Handle Android safe area conflicts when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (Platform.OS === "android" && 
          appState.current.match(/inactive|background/) && 
          nextAppState === 'active') {
        // Android app returned to foreground, forcing update
        setForceUpdate(prev => prev + 1);
        
        // Additional delay to ensure safe area insets are recalculated
        setTimeout(() => {
          setForceUpdate(prev => prev + 1);
        }, 100);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [forceUpdate]);

  // Set loading to false after a short delay to ensure smooth transition
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const renderScreen = () => {
    if (isLoading) {
      return null; // Don't render anything while loading
    }

    switch (currentScreen) {
      case 'marketplace':
        return <MarketplaceScreen />;
      case 'people':
        return <PeopleScreen />;
      case 'updates':
        return <UpdatesScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <MarketplaceScreen />;
    }
  };

  const handleScreenChange = (screenId) => {
    setCurrentScreen(screenId);
  };

  return (
    <View key={forceUpdate} style={styles.container}>
      {renderScreen()}
      {!isLoading && (
        <BottomNavigation 
          currentScreen={currentScreen}
          onScreenChange={handleScreenChange}
          navigation={navigation}
        />
      )}
    </View>
  );
};

const MainNavigation = ({ navigation }) => {
  return (
    <SafeAreaProvider>
      <MainNavigationContent navigation={navigation} />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MainNavigation;
