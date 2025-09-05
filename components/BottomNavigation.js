import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';

const BottomNavigation = ({ currentScreen, onScreenChange, navigation }) => {
  const insets = useSafeAreaInsets();
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });
  
  const navItems = [
    { id: 'marketplace', icon: 'storefront-outline', label: 'Market', activeIcon: 'storefront' },
    { id: 'people', icon: 'people-outline', label: 'People', activeIcon: 'people' },
    { id: 'add', icon: 'add', label: '', activeIcon: 'add' },
    { id: 'updates', icon: 'trending-up-outline', label: 'Updates', activeIcon: 'trending-up' },
    { id: 'profile', icon: 'person-outline', label: 'Me', activeIcon: 'person' },
  ];

  // Animation value for the floating effect
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Start the continuous floating animation
  useEffect(() => {
    const startFloating = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startFloating();
  }, [floatAnim]);

  // Interpolate the floating animation
  const floatingStyle = {
    transform: [
      {
        translateY: floatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -12], // Move up by 12 pixels (increased from 8)
        }),
      },
    ],
  };

  const handlePress = (screenId) => {
    if (screenId === 'add') {
      // Navigate to PostListingScreen
      navigation.navigate('PostListing');
    } else {
      onScreenChange(screenId);
    }
  };

  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
      {navItems.map((item) => {
        const isActive = currentScreen === item.id;
        const isAddButton = item.id === 'add';
        
        if (isAddButton) {
          return (
            <Animated.View key={item.id} style={[styles.addButton, floatingStyle]}>
              <TouchableOpacity 
                style={styles.addButtonTouchable}
                onPress={() => handlePress(item.id)}
              >
                <Ionicons name={item.icon} size={28} color="white" />
              </TouchableOpacity>
            </Animated.View>
          );
        }

        return (
          <TouchableOpacity
            key={item.id}
            style={styles.bottomNavItem}
            onPress={() => handlePress(item.id)}
          >
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={20}
              color={isActive ? '#F68652' : 'white'}
            />
            <Text 
              style={[
                styles.bottomNavText, 
                { fontFamily: fontsLoaded ? 'Poppins-Medium' : undefined },
                isActive && styles.activeText
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
              allowFontScaling={false}
              ellipsizeMode="tail"
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: '#83AFA7',
    paddingVertical: 14,
    paddingBottom: 18,
    paddingHorizontal: 6,
    minHeight: 75,
    ...(Platform.OS === 'android' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  bottomNavItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 75,
    paddingHorizontal: 2,
    justifyContent: 'center',
    maxWidth: 80,
  },
  bottomNavText: {
    fontSize: 10,
    color: 'white',
    marginTop: 3,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 12,
  },
  activeText: {
    color: '#F68652',
  },
  addButton: {
    backgroundColor: '#F68652',
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    ...(Platform.OS === 'android' && {
      elevation: 8,
    }),
  },
  addButtonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BottomNavigation;
