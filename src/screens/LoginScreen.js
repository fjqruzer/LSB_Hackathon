import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { validateCredentials, loginUser } from '../utils/auth';
import { validateEmail, validatePassword } from '../utils/validation';

SplashScreen.preventAutoHideAsync();

const COLORS = {
  background: '#F8F5ED',
  orange: '#F28C4A',
  teal: '#50A8A8',
  lightGreyText: '#888888',
  shadowGrey: 'rgba(0, 0, 0, 0.2)',
  error: '#FF6B6B',
  success: '#4CAF50',
};

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const clearErrors = (fields) => {
    const newErrors = { ...errors };
    fields.forEach(field => delete newErrors[field]);
    setErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate email
    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      console.log('🔐 Signing in...');
      
      // Direct Firebase authentication
      const result = await loginUser(email.trim().toLowerCase(), password.trim());
      
      if (result.success) {
        console.log('✅ Login successful!');
        // AuthContext will handle the navigation to Home
      } else {
        setErrors({ general: result.error });
      }
    } catch (error) {
      console.error('Login process error:', error);
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Signup');
  };



  const handleSignInLater = () => {
    navigation.replace('Home');
  };

  const handleTermsPress = () => {
    console.log('Navigating to Terms of Service');
    // Open terms of service link
  };

  const handlePrivacyPress = () => {
    console.log('Navigating to Privacy Policy');
    // Open privacy policy link
  };

  const renderError = (field) => {
    if (errors[field]) {
      return <Text style={styles.errorText}>{errors[field]}</Text>;
    }
    return null;
  };

  const renderGeneralError = () => {
    if (errors.general) {
      return (
        <View style={styles.generalErrorContainer}>
          <Text style={styles.generalErrorText}>{errors.general}</Text>
        </View>
      );
    }
    return null;
  };

  const canSignIn = email.trim() && password.trim() && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      onLayout={onLayoutRootView}
    >
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        {/* Back Arrow - positioned absolutely */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.teal} />
        </TouchableOpacity>

        <Image source={require('./assets/logo.png')} style={styles.logo} />

        <Text style={styles.title}>Mine, Steal or Lock it!</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {renderGeneralError()}

        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Enter your email"
          placeholderTextColor={COLORS.lightGreyText}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) clearErrors(['email']);
          }}
        />
        {renderError('email')}

        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Enter your password"
          placeholderTextColor={COLORS.lightGreyText}
          secureTextEntry
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) clearErrors(['password']);
          }}
        />
        {renderError('password')}

        <TouchableOpacity 
          style={[styles.signInButton, !canSignIn && styles.btnDisabled]} 
          onPress={handleSignIn}
          disabled={!canSignIn}
          activeOpacity={canSignIn ? 0.7 : 1}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.loadingText}>Signing in...</Text>
            </View>
          ) : (
            <Text style={styles.signInButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>





        <View style={styles.legalTextContainer}>
          <Text style={styles.legalText}>
            By signing up, you agree to our{' '}
            <Text style={styles.legalLink} onPress={handleTermsPress}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={handlePrivacyPress}>
              Privacy Policy
            </Text>
          </Text>
        </View>

        <TouchableOpacity onPress={handleRegister}>
          <Text style={styles.linkText}>Register</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignInLater}>
          <Text style={styles.linkText}>Sign In Later</Text>
        </TouchableOpacity>

        <View style={styles.bottomPhraseContainer}>
          <Text style={styles.bottomPhrase}>
            Pag nakita mo na,{' '}
            <Text style={{ color: COLORS.orange }}>COPit-in mo!</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 1,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 20,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 10,
    color: COLORS.teal,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    marginBottom: 20,
    color: COLORS.lightGreyText,
    paddingHorizontal: 20,
  },

  input: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.background,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.orange,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    marginBottom: 15,
    shadowColor: COLORS.shadowGrey,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  signInButton: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.teal,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: COLORS.shadowGrey,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  signInButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    marginLeft: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  errorText: {
    color: COLORS.error,
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 20,
    alignSelf: 'flex-start',
  },
  generalErrorContainer: {
    backgroundColor: COLORS.error + '20',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  generalErrorText: {
    color: COLORS.error,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  legalTextContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  legalText: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    color: COLORS.lightGreyText,
    lineHeight: 14,
  },
  legalLink: {
    color: COLORS.orange,
    textDecorationLine: 'underline',
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: COLORS.lightGreyText,
    marginTop: 15,
    textDecorationLine: 'underline',
  },
  bottomPhraseContainer: {
    marginTop: 'auto',
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  bottomPhrase: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    color: COLORS.teal,
  },
});

export default LoginScreen;
