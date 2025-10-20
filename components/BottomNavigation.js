import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const BottomNavigation = ({ currentScreen, onScreenChange }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // State for PLUS button expansion
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });
  
  // Clothing icons to cycle through
  const clothingIcons = ['shirt-outline', 'glasses-outline', 'watch-outline', 'footsteps-outline', 'bag-outline'];
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  
  const navItems = [
    { id: 'marketplace', icon: 'storefront-outline', label: 'Market', activeIcon: 'storefront' },
    { id: 'foryou', icon: 'sparkles-outline', label: 'For You', activeIcon: 'sparkles' },
    { id: 'plus', icon: clothingIcons[currentIconIndex], label: '', activeIcon: clothingIcons[currentIconIndex] },
    { id: 'people', icon: 'people-outline', label: 'People', activeIcon: 'people' },
    { id: 'profile', icon: 'person-outline', label: 'Me', activeIcon: 'person' },
  ];

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const iconFadeAnim = useRef(new Animated.Value(1)).current;

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

  // Icon cycling effect with fade animation
  useEffect(() => {
    const cycleIcon = () => {
      // Fade out
      Animated.timing(iconFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Change icon
        setCurrentIconIndex((prevIndex) => (prevIndex + 1) % clothingIcons.length);
        // Fade in
        Animated.timing(iconFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    };

    const interval = setInterval(cycleIcon, 3000); // Change icon every 3 seconds
    return () => clearInterval(interval);
  }, [iconFadeAnim]);

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

  // Animation for expanding circles
  const toggleExpansion = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    
    // Button press animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.85,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();

    // Ripple effect
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    
    Animated.parallel([
      Animated.spring(expandAnim, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(circle1Anim, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
        delay: toValue ? 100 : 0,
      }),
      Animated.spring(circle2Anim, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
        delay: toValue ? 150 : 0,
      }),
    ]).start();
  };

  const handlePress = async (screenId) => {
    if (screenId === 'plus') {
      toggleExpansion();
      return;
    }
    
    if (screenId === 'add') {
      // Check if user has payment methods before allowing to post listing
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const paymentMethods = userData.paymentMethods || [];
            if (paymentMethods.length === 0) {
              Alert.alert(
                'Payment Method Required',
                'You need to add at least one payment method to post listings. Go to Profile > My Payment Methods to add one.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Add Payment Method', 
                    onPress: () => onScreenChange('PaymentMethods')
                  }
                ]
              );
              return;
            }
          }
        } catch (error) {
          console.error('Error checking payment methods:', error);
          Alert.alert('Error', 'Unable to verify payment methods. Please try again.');
          return;
        }
      }
    }
    
    // Close expansion when navigating to other screens
    if (isExpanded) {
      setIsExpanded(false);
      Animated.parallel([
        Animated.spring(expandAnim, { toValue: 0, useNativeDriver: true }),
        Animated.spring(circle1Anim, { toValue: 0, useNativeDriver: true }),
        Animated.spring(circle2Anim, { toValue: 0, useNativeDriver: true }),
      ]).start();
    }
    
    onScreenChange(screenId);
  };

  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
      {navItems.map((item) => {
        const isActive = currentScreen === item.id;
        const isPlusButton = item.id === 'plus';
        
        if (isPlusButton) {
          return (
            <View key={item.id} style={styles.plusButtonContainer}>
              {/* Expanding circles */}
              <Animated.View 
                style={[
                  styles.expandingCircle,
                  styles.circle1,
                  {
                    opacity: circle1Anim,
                    transform: [
                      {
                        scale: circle1Anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                      },
                      {
                        translateY: circle1Anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -80],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity 
                  style={styles.circleButton}
                  onPress={() => handlePress('LiveStreams')}
                >
                  <Ionicons name="videocam" size={24} color="white" />
                </TouchableOpacity>
              </Animated.View>

              <Animated.View 
                style={[
                  styles.expandingCircle,
                  styles.circle2,
                  {
                    opacity: circle2Anim,
                    transform: [
                      {
                        scale: circle2Anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                      },
                      {
                        translateY: circle2Anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -80],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity 
                  style={styles.circleButton}
                  onPress={() => handlePress('add')}
                >
                  <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
              </Animated.View>

              {/* Ripple effect */}
              <Animated.View 
                style={[
                  styles.rippleEffect,
                  {
                    opacity: rippleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.6, 0.3, 0],
                    }),
                    transform: [
                      {
                        scale: rippleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 2],
                        }),
                      },
                    ],
                  },
                ]}
              />

              {/* Main PLUS button */}
              <Animated.View 
                style={[
                  styles.addButton, 
                  floatingStyle,
                  {
                    transform: [
                      ...floatingStyle.transform,
                      { scale: scaleAnim },
                    ],
                  },
                ]}
              >
                <TouchableOpacity 
                  style={styles.addButtonTouchable}
                  onPress={() => handlePress(item.id)}
                  activeOpacity={0.8}
                >
                  <Animated.View
                    style={{
                      opacity: iconFadeAnim,
                      transform: [{
                        rotate: expandAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '135deg'],
                        }),
                      }],
                    }}
                  >
                    <Ionicons 
                      name={item.icon} 
                      size={28} 
                      color="white" 
                    />
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={item.id}
            style={styles.bottomNavItem}
            onPress={() => handlePress(item.id)}
          >
            <View style={styles.iconContainer}>
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={20}
              color={isActive ? '#F68652' : 'white'}
            />
            </View>
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
  plusButtonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#F68652',
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#F68652',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    ...(Platform.OS === 'android' && {
      elevation: 12,
    }),
  },
  rippleEffect: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F68652',
    zIndex: -1,
  },
  addButtonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandingCircle: {
    position: 'absolute',
    backgroundColor: '#F68652',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    ...(Platform.OS === 'android' && {
      elevation: 6,
    }),
  },
  circle1: {
    left: -25,
  },
  circle2: {
    right: -25,
  },
  circleButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F68652',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#83AFA7',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
});

export default BottomNavigation;
