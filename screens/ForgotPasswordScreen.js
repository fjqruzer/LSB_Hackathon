import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const COLORS = {
  background: '#FEF4D8',
  orange: '#F68652',
  teal: '#83AFA7',
  lightGrey: '#CCCCCC',
  darkGrey: '#9B9B9B',
  shadowGrey: 'rgba(0, 0, 0, 0.2)',
  success: '#4CAF50',
  error: '#FF6B6B',
};

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errors, setErrors] = useState({});
  
  const { forgotPassword } = useAuth();

  // Check if email is valid
  const isEmailValid = () => {
    return email.trim() && !errors.email;
  };

  // Validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return 'Email is required';
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    if (email.length > 254) return 'Email is too long (max 254 characters)';
    return null;
  };

  const handleFieldChange = (value) => {
    setEmail(value);
    
    // Clear previous error
    if (errors.email) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }

    // Real-time validation with small delay for better UX
    setTimeout(() => {
      if (value.trim()) {
        const emailError = validateEmail(value);
        if (emailError) {
          setErrors(prev => ({ ...prev, email: emailError }));
        }
      }
    }, 300);
  };

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleSendResetEmail = async () => {
    if (loading) return;
    
    // Validate email
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }
    
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setEmailSent(true);
    } catch (error) {
      let errorMessage = 'An error occurred while sending the reset email';
      
      if (error.code === 'auth/user-not-found') {
        setErrors({ email: 'No account found with this email address' });
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: 'Please enter a valid email address' });
      } else if (error.code === 'auth/too-many-requests') {
        setErrors({ general: 'Too many requests. Please try again later' });
      } else {
        setErrors({ general: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  const handleResendEmail = () => {
    setEmailSent(false);
    setEmail('');
    setErrors({});
  };

  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackToLogin}
            >
              <MaterialIcons name="arrow-back" size={24} color={COLORS.teal} />
            </TouchableOpacity>
          </View>

          {/* Success Content */}
          <View style={styles.content}>
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <MaterialIcons name="check-circle" size={80} color={COLORS.success} />
              </View>
              
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successMessage}>
                We've sent a password reset link to{'\n'}
                <Text style={styles.emailText}>{email}</Text>
              </Text>
              
              <Text style={styles.instructionsText}>
                Please check your email and follow the instructions to reset your password. 
                The link will expire in 1 hour.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={handleBackToLogin}
              >
                <Text style={styles.primaryButtonText}>Back to Login</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={handleResendEmail}
              >
                <Text style={styles.secondaryButtonText}>Resend Email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackToLogin}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.teal} />
          </TouchableOpacity>
        </View>

        {/* Logo and Title Container */}
        <View style={styles.logoTitleContainer}>
          <Image 
            source={require('../assets/images/logo.png')} 
            style={styles.logo}
          />
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Forgot Password?</Text>
            <Text style={styles.subtitle}>No worries! Enter your email and we'll send you a reset link</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Input Field */}
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.inputField, errors.email && styles.inputFieldError]}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.darkGrey}
                value={email}
                onChangeText={handleFieldChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus={true}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>
          </View>

          {/* General Error Display */}
          {errors.general && (
            <Text style={styles.generalErrorText}>{errors.general}</Text>
          )}
          
          {/* Send Reset Email Button */}
          <TouchableOpacity 
            style={[
              styles.resetButton,
              !isEmailValid() && styles.resetButtonDisabled
            ]}
            onPress={handleSendResetEmail}
            disabled={!isEmailValid() || loading}
          >
            <Text style={[
              styles.resetButtonText,
              !isEmailValid() && styles.resetButtonTextDisabled
            ]}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>

          {/* Back to Login */}
          <TouchableOpacity 
            style={styles.backToLoginButton}
            onPress={handleBackToLogin}
          >
            <Text style={styles.backToLoginText}>Remember your password? Sign In</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  logoTitleContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontFamily: 'Poppins-SemiBold',
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  inputSection: {
    width: '100%',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputField: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.orange,
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    backgroundColor: 'transparent',
    color: COLORS.darkGrey,
  },
  resetButton: {
    backgroundColor: COLORS.teal,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginBottom: 20,
    shadowColor: COLORS.shadowGrey,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    width: '100%',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  resetButtonDisabled: {
    backgroundColor: COLORS.lightGrey,
    opacity: 0.6,
  },
  resetButtonTextDisabled: {
    color: COLORS.darkGrey,
  },
  backToLoginButton: {
    marginBottom: 30,
  },
  backToLoginText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    marginTop: 5,
    marginLeft: 5,
    textAlign: 'left',
  },
  inputFieldError: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  generalErrorText: {
    color: COLORS.error,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: '#FFE6E6',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  // Success screen styles
  successContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: 'Poppins-SemiBold',
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: COLORS.darkGrey,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  emailText: {
    fontFamily: 'Poppins-SemiBold',
    color: COLORS.teal,
  },
  instructionsText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: COLORS.darkGrey,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: COLORS.teal,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginBottom: 15,
    shadowColor: COLORS.shadowGrey,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.teal,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.teal,
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
});

export default ForgotPasswordScreen;
