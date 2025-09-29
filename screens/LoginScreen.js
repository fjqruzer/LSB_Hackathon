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
} from 'react-native';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const COLORS = {
  background: '#FEF4D8',
  orange: '#F68652',
  teal: '#83AFA7',
  lightGrey: '#CCCCCC',
  darkGrey: '#9B9B9B',
  shadowGrey: 'rgba(0, 0, 0, 0.2)',
};

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const { login } = useAuth();

  // Check if login form is valid
  const isLoginFormValid = () => {
    return email.trim() && password.trim() && !errors.email && !errors.password;
  };

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return 'Email is required';
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    if (email.length > 254) return 'Email is too long (max 254 characters)';
    return null;
  };

  const validatePassword = (password) => {
    if (!password.trim()) return 'Password is required';
    if (password.length < 1) return 'Password is required';
    return null;
  };

  const handleFieldChange = (fieldName, value) => {
    // Update the field value first
    switch (fieldName) {
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        break;
    }

    // Clear previous error
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }

    // Real-time validation with small delay for better UX
    setTimeout(() => {
      if (fieldName === 'email' && value.trim()) {
        const emailError = validateEmail(value);
        if (emailError) {
          setErrors(prev => ({ ...prev, email: emailError }));
        }
      }

      if (fieldName === 'password' && value.trim()) {
        const passwordError = validatePassword(value);
        if (passwordError) {
          setErrors(prev => ({ ...prev, password: passwordError }));
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

  const handleLogin = async () => {
    if (loading) return;
    
    // Validate fields
    const newErrors = {};
    
    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;
    
    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Navigation to main app happens automatically via AuthContext
    } catch (error) {
      let errorMessage = 'An error occurred during login';
      
      if (error.code === 'auth/user-not-found') {
        setErrors({ email: 'No account found with this email address' });
      } else if (error.code === 'auth/wrong-password') {
        setErrors({ password: 'Incorrect password. Please try again' });
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: 'Please enter a valid email address' });
      } else if (error.code === 'auth/too-many-requests') {
        setErrors({ general: 'Too many failed attempts. Please try again later' });
      } else {
        setErrors({ general: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Handle forgot password logic here
  };

  const handleSignUp = async () => {
    try {
      // Mark onboarding as completed when user goes to signup
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
    }
    // Navigate to signup screen
    navigation.navigate('Signup');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
      </View>

      {/* Logo and Title Container */}
      <View style={styles.logoTitleContainer}>
        <Image 
          source={require('../assets/images/logo.png')} 
          style={styles.logo}
        />
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Sign in to continue your journey</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Input Fields */}
        <View style={styles.inputSection}>
                     <View style={styles.inputContainer}>
             <TextInput
                                    style={[styles.inputField, errors.email && styles.inputFieldError]}
               placeholder="Enter your email"
               placeholderTextColor={COLORS.darkGrey}
               value={email}
               onChangeText={(value) => handleFieldChange('email', value)}
               
               keyboardType="email-address"
               autoCapitalize="none"
             />
                                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
           </View>
           
                            <View style={styles.inputContainer}>
                   <View style={styles.inputFieldContainer}>
                     <TextInput
                       style={[styles.inputField, errors.password && styles.inputFieldError]}
                       placeholder="Enter your password"
                       placeholderTextColor={COLORS.darkGrey}
                       value={password}
                       onChangeText={(value) => handleFieldChange('password', value)}
                       secureTextEntry={!showPassword}
                       autoCapitalize="none"
                     />
                     <TouchableOpacity
                       style={styles.passwordToggle}
                       onPress={() => setShowPassword(!showPassword)}
                     >
                       <MaterialIcons 
                         name={showPassword ? 'visibility-off' : 'visibility'} 
                         size={24} 
                         color={COLORS.darkGrey} 
                       />
                     </TouchableOpacity>
                   </View>
                   {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                 </View>
        </View>

        {/* Forgot Password */}
        <TouchableOpacity 
          style={styles.forgotPasswordButton}
          onPress={handleForgotPassword}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* General Error Display */}
        {errors.general && (
          <Text style={styles.generalErrorText}>{errors.general}</Text>
        )}
        
        {/* Login Button */}
        <TouchableOpacity 
          style={[
            styles.loginButton,
            !isLoginFormValid() && styles.loginButtonDisabled
          ]}
          onPress={handleLogin}
          disabled={!isLoginFormValid() || loading}
        >
          <Text style={[
            styles.loginButtonText,
            !isLoginFormValid() && styles.loginButtonTextDisabled
          ]}>
            {loading ? 'Signing In...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        {/* Sign Up Option */}
        <View style={styles.signUpSection}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity onPress={handleSignUp}>
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Sign In Later */}
        <TouchableOpacity 
          style={styles.signInLaterButton}
          onPress={() => {}}
        >
          <Text style={styles.signInLaterText}>Sign In Later</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 30,
  },
  logoTitleContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
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
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputSection: {
    width: '100%',
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    textAlign: 'right',
  },
  loginButton: {
    backgroundColor: COLORS.teal,
    paddingVertical: 10,
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
  loginButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.lightGrey,
    opacity: 0.6,
  },
  loginButtonTextDisabled: {
    color: COLORS.darkGrey,
  },
  signUpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  signUpText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
  },
  signUpLink: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: COLORS.orange,
  },
  signInLaterButton: {
    marginBottom: 30,
  },
  signInLaterText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    textAlign: 'center',
  },
  bottomTagline: {
    paddingBottom: 80,
    alignItems: 'center',
  },
  taglineText: {
    fontSize: 16,
    fontFamily: 'Poppins-BoldItalic',
    textAlign: 'center',
    lineHeight: 22,
  },
  taglinePart1: {
    color: COLORS.teal,
  },
  taglinePart2: {
    color: COLORS.orange,
  },
  taglinePart3: {
    color: COLORS.orange,
  },
  taglinePart4: {
    color: COLORS.teal,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    marginTop: 5,
    marginLeft: 5,
    textAlign: 'left',
  },
  inputFieldError: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  generalErrorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: '#FFE6E6',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: 15,
    top: '40%',
    transform: [{ translateY: -12 }],
    padding: 5,
  },
});

export default LoginScreen;
