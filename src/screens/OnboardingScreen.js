import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

const COLORS = {
  background: '#F8F5ED',
  orange: '#F28C4A',
  teal: '#50A8A8',
  lightGrey: '#CCCCCC',
  shadowGrey: 'rgba(0, 0, 0, 0.2)',
};

const { width } = Dimensions.get('window');

const OnboardingScreen = ({ navigation }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // Define screens array first
  const screens = [
    {
      type: 'welcome',
      logo: require('./assets/logo.png'),
      titlePart1: 'Welcome to ',
      titlePart2: 'COPit!',
      description: 'Discover the thrill of competitive thrift shopping with our unique Mine-Steal-Lock system.',
    },
    {
      type: 'how-it-works-clothes',
      title: 'How it works?',
      image: require('./assets/clothes-rack.png'),
      steps: [
        { icon: 'cart-outline', text: 'Mine - Instantly claim an item' },
        { icon: 'sword', text: 'Steal - Outbid and take it.' },
        { icon: 'lock-outline', text: 'Lock - Secure the item at the highest price.' },
      ],
    },
    {
      type: 'how-it-works-bid',
      title: 'How it works?',
      image: require('./assets/auctioneer.png'),
      subtitle: 'Bid and Win!',
      description: 'Place your bids and stay on top. The highest bidder takes the win when the timer runs out!',
    },
    {
      type: 'get-started',
      logo: require('./assets/logo.png'),
      titlePart1: 'Pag nakita mo na, ',
      titlePart2: 'COPit-in mo!',
      buttonText: 'Get Started',
    },
  ];

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
  });

  // Animated values for content
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(50);

  // Animated values for pagination dots (fixed number of hooks)
  const dotScale0 = useSharedValue(1);
  const dotScale1 = useSharedValue(1);
  const dotScale2 = useSharedValue(1);
  const dotScale3 = useSharedValue(1);
  const dotScales = [dotScale0, dotScale1, dotScale2, dotScale3];

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Animate content when activeIndex changes
  useEffect(() => {
    contentOpacity.value = withTiming(1, { duration: 500 });
    contentTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });

    // Animate dot scales
    dotScales.forEach((scale, index) => {
      scale.value = withTiming(index === activeIndex ? 1.4 : 1, { duration: 300 });
    });
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ translateY: contentTranslateY.value }],
    };
  });

  // Animated styles for pagination dots (fixed number of hooks)
  const dotAnimatedStyle0 = useAnimatedStyle(() => {
    return {
      transform: [{ scale: dotScales[0].value }],
    };
  });

  const dotAnimatedStyle1 = useAnimatedStyle(() => {
    return {
      transform: [{ scale: dotScales[1].value }],
    };
  });

  const dotAnimatedStyle2 = useAnimatedStyle(() => {
    return {
      transform: [{ scale: dotScales[2].value }],
    };
  });

  const dotAnimatedStyle3 = useAnimatedStyle(() => {
    return {
      transform: [{ scale: dotScales[3].value }],
    };
  });

  const dotAnimatedStyles = [dotAnimatedStyle0, dotAnimatedStyle1, dotAnimatedStyle2, dotAnimatedStyle3];

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    if (currentIndex !== activeIndex) {
      // Reset content animation values for the new screen
      contentOpacity.value = 0;
      contentTranslateY.value = 50;
      runOnJS(setActiveIndex)(currentIndex);
    }
  };

  const handleDotPress = (index) => {
    scrollViewRef.current.scrollTo({ x: index * width, animated: true });
  };

  if (!fontsLoaded) {
    return null;
  }

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
          <View key={index} style={styles.slide}>
            <Animated.View style={[styles.contentWrapper, activeIndex === index ? contentAnimatedStyle : { opacity: 0 }]}>
                {screen.type === 'welcome' && (
                  <>
                    <Image source={screen.logo} style={styles.logo} />
                    <Text style={styles.welcomeTitle}>
                      <Text>{screen.titlePart1}</Text>
                      <Text style={{ color: COLORS.orange }}>{screen.titlePart2}</Text>
                    </Text>
                    <Text style={styles.welcomeDescription}>{screen.description}</Text>
                  </>
                )}
                {screen.type === 'how-it-works-clothes' && (
                  <>
                    <Text style={styles.howItWorksTitle}>{screen.title}</Text>
                    <Image source={screen.image} style={styles.illustration} />
                    <View style={styles.stepsContainer}>
                      {screen.steps && screen.steps.map((step, stepIndex) => (
                        <View key={stepIndex} style={styles.stepItem}>
                          <MaterialCommunityIcons name={step.icon} size={24} color={COLORS.orange} style={styles.stepIcon} />
                          <Text style={styles.stepText}>{step.text}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                {screen.type === 'how-it-works-bid' && (
                  <>
                    <Text style={styles.howItWorksTitle}>{screen.title}</Text>
                    <Image source={screen.image} style={styles.illustration} />
                    <Text style={styles.subtitle}>{screen.subtitle}</Text>
                    <Text style={styles.description}>{screen.description}</Text>
                  </>
                )}
                {screen.type === 'get-started' && (
                  <>
                    <Image source={screen.logo} style={styles.logo} />
                    <Text style={styles.getStartedTitle}>
                      <Text>{screen.titlePart1}</Text>
                      <Text style={{ color: COLORS.orange }}>{screen.titlePart2}</Text>
                    </Text>
                  </>
                )}
              </Animated.View>

            {screen.type === 'get-started' && (
              <View style={styles.getStartedCtaContainer} pointerEvents="box-none">
                <TouchableOpacity 
                  style={styles.getStartedButton}
                  onPress={() => navigation.navigate('Signup')}
                >
                  <Text style={styles.getStartedButtonText}>{screen.buttonText}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.pagination}>
        {screens.map((_, index) => (
          <TouchableOpacity key={index} onPress={() => handleDotPress(index)}>
            <Animated.View
              style={[
                styles.paginationDot,
                activeIndex === index && styles.paginationDotActive,
                dotAnimatedStyles[index],
              ]}
            />
          </TouchableOpacity>
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
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 0,
  },
  slideTopAligned: {
    justifyContent: 'center',
    paddingTop: 0,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 20,
    color: COLORS.teal,
  },
  welcomeDescription: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    color: COLORS.teal,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  howItWorksTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 30,
    color: COLORS.teal,
  },
  illustration: {
    width: '80%',
    height: 200,
    resizeMode: 'contain',
    marginBottom: 30,
  },
  stepsContainer: {
    alignSelf: 'flex-start',
    width: '100%',
    marginTop: 20,
    paddingLeft: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  stepIcon: {
    marginRight: 15,
  },
  stepText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: COLORS.orange,
    flex: 1,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 10,
    color: COLORS.orange,
  },
  description: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    color: COLORS.teal,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  getStartedTitle: {
    fontSize: 26,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 40,
    color: COLORS.teal,
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.lightGrey,
    marginHorizontal: 5,
  },
  paginationDotActive: {
    backgroundColor: COLORS.orange,
  },
  getStartedCtaContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 110,
    alignItems: 'center',
  },
  getStartedButton: {
    backgroundColor: COLORS.orange,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 0,
    shadowColor: COLORS.shadowGrey,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 2,
  },
  getStartedButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
  },
});

export default OnboardingScreen;
