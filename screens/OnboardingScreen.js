import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Import MaterialCommunityIcons

SplashScreen.preventAutoHideAsync();

const COLORS = {
  background: '#FEF4D8',
  orange: '#F68652',
  teal: '#83AFA7',
  lightGrey: '#CCCCCC',
  shadowGrey: 'rgba(0, 0, 0, 0.2)',
};

const { width } = Dimensions.get('window');

const OnboardingScreen = ({ onComplete }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef(null);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'Poppins-BoldItalic': require('../assets/fonts/Poppins-BoldItalic.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  });

  // Font loading status

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const handleGetStarted = async () => {
    try {
      // Mark onboarding as completed
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setActiveIndex(currentIndex);
  };

  const screens = [
    {
      type: 'welcome',
      logo: require('../assets/images/logo.png'),
      titlePart1: 'Welcome to ',
      titlePart2: 'COPit!',
      description: 'Discover the thrill of competitive thrift shopping with our unique Mine-Steal-Lock system.',
      showSmallLogo: false,
    },
    {
      type: 'how-it-works-clothes',
      title: 'How it works?',
      image: require('../assets/images/msl.png'),
      steps: [
        
        { icon: 'cart-outline', text: 'Mine - Instantly claim an item' },
        { icon: 'sword', text: 'Steal - Outbid and take it.' }, 
        { icon: 'lock-outline', text: 'Lock - Secure the item at the highest price.' },
      ],
      showSmallLogo: false,
    },
    {
      type: 'how-it-works-bid',
      title: 'How it works?',
      image: require('../assets/images/bid.png'),
      subtitle: 'Bid and Win!',
      description: 'Place your bids and stay on top. The highest bidder takes the win when the timer runs out!',
      showSmallLogo: false,
    },
    {
      type: 'get-started',
      logo: require('../assets/images/logo.png'),
      titlePart1: 'See it, ',
      titlePart2: 'Like it?',
      buttonText: 'CopIt!',
      showSmallLogo: false,
    },
  ];

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {screens.map((screen, index) => (
          <View key={index} style={[
            styles.slide, 
            (screen.type === 'how-it-works-clothes' || screen.type === 'how-it-works-bid') && styles.slideTopAligned,
            screen.type === 'get-started' && styles.slideGetStarted
          ]}>
            {screen.type === 'welcome' && (
              <>
                <View style={styles.welcomeContent}>
                  <Image source={screen.logo} style={styles.logo} />
                  <Text style={[styles.sectionTitle, styles.welcomeTitle]}>
                    <Text>Welcome to </Text>
                    <Text style={{ color: COLORS.orange }}>COP</Text>
                    <Text style={{ color: COLORS.teal }}>it</Text>
                    <Text>!</Text>
                  </Text>
                </View>
                <Text style={[styles.sectionDescription, styles.welcomeDescription]} numberOfLines={0} ellipsizeMode="tail">{screen.description}</Text>
              </>
            )}
            {screen.type === 'how-it-works-clothes' && (
              <>
                <View style={styles.howItWorksContent}>
                  <Text style={[styles.sectionTitle, styles.howItWorksTitle]}>
                    <Text>How it </Text>
                    <Text style={{ color: COLORS.orange }}>works</Text>
                    <Text>?</Text>
                  </Text>
                  <Image source={screen.image} style={styles.illustration} />
                </View>
                <View style={styles.stepsContainer}>
                  {screen.steps.map((step, stepIndex) => (
                    <View key={stepIndex} style={styles.stepItem}>
                      {/* Render MaterialCommunityIcons icon */}
                      <MaterialCommunityIcons name={step.icon} size={24} color={COLORS.orange} style={styles.stepIcon} />
                      <Text style={[styles.sectionDescription, styles.stepText]} numberOfLines={0} ellipsizeMode="tail">{step.text}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {screen.type === 'how-it-works-bid' && (
              <>
                <View style={styles.howItWorksContent}>
                  <Text style={[styles.sectionTitle, styles.howItWorksTitle]}>
                    <Text>How it </Text>
                    <Text style={{ color: COLORS.orange }}>works</Text>
                    <Text>?</Text>
                  </Text>
                  <Image source={screen.image} style={styles.illustration} />
                </View>
                <View style={styles.bottomContent}>
                  <Text style={styles.subtitle} numberOfLines={0} ellipsizeMode="tail">{screen.subtitle}</Text>
                  <Text style={[styles.sectionDescription, styles.description]} numberOfLines={0} ellipsizeMode="tail">{screen.description}</Text>
                </View>
              </>
            )}
            {screen.type === 'get-started' && (
              <>
                <View style={styles.getStartedTopContent}>
                  <Image source={screen.logo} style={styles.getStartedLogo} />
                </View>
                <View style={styles.getStartedBottomContent}>
                  <Text style={styles.getStartedTitle}>
                    <Text style={styles.getStartedTitlePart1}>See It. Like It. </Text>
                    <Text style={styles.getStartedTitlePart2}>COP</Text>
                    <Text style={styles.getStartedTitlePart3}>it</Text>
                    <Text style={styles.getStartedTitlePart4}>!</Text>
                  </Text>
                                  <TouchableOpacity 
                  style={styles.getStartedButton}
                  onPress={handleGetStarted}
                >
                  <Text style={styles.getStartedButtonText}>{screen.buttonText}</Text>
                </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.pagination}>
        {screens.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              activeIndex === index && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  slide: {
    width: width,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 80,
    paddingBottom: 100,
    flex: 1,
  },
  slideTopAligned: {
    justifyContent: 'flex-start',
    paddingTop: 80,
    flex: 1,
  },
  slideGetStarted: {
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 60,
  },
  logo: {
    width: 146,
    height: 146,
    resizeMode: 'contain',
  },
  // Common title style for all sections
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-BoldItalic',
    textAlign: 'center',
    color: COLORS.teal,
    lineHeight: 26,
  },
  // Welcome specific styles
  welcomeTitle: {
    marginBottom: 16,
  },
  welcomeContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  // Common description style for all sections
  sectionDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    color: COLORS.teal,
    lineHeight: 20,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  // Welcome specific description styles
  welcomeDescription: {
    paddingHorizontal: 25,
    maxWidth: 280,
    marginBottom: 40,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  // How it works specific styles
  howItWorksTitle: {
    marginBottom: 25,
    lineHeight: 28,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  howItWorksContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  bottomContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: 20,
  },
  illustration: {
    width: '90%',
    height: 220,
    resizeMode: 'contain',
    marginBottom: 35,
  },
  stepsContainer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 350,
    marginTop: 25,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    width: '100%',
    justifyContent: 'center',
  },
  stepIcon: {
    marginRight: 15,
    marginTop: 2,
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
    marginLeft: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
    textAlign: 'left',
    maxWidth: '65%',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 65,
    color: COLORS.orange,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  description: {
    paddingHorizontal: 20,
    lineHeight: 24,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  getStartedTopContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  getStartedLogo: {
    width: 146,
    height: 146,
    resizeMode: 'contain',
    marginBottom: 0,
  },
  getStartedBottomContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: 20,
  },
  getStartedTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-BoldItalic',
    textAlign: 'center',
    lineHeight: 22,
    flexWrap: 'wrap',
    flexShrink: 1,
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  getStartedTitlePart1: {
    color: COLORS.teal,
    display: 'block',
  },
  getStartedTitlePart2: {
    color: COLORS.orange,
    display: 'block',
  },
  getStartedTitlePart3: {
    color: COLORS.orange,
    display: 'block',
  },
  getStartedTitlePart4: {
    color: COLORS.teal,
    display: 'block',
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.lightGrey,
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: COLORS.orange,
  },
  getStartedButton: {
    backgroundColor: COLORS.teal,
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 0,
    shadowColor: COLORS.shadowGrey,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  getStartedButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
});

export default OnboardingScreen;
