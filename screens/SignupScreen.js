  import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import OTPService from '../services/OTPService';

  const { width, height } = Dimensions.get('window');

const COLORS = {
  background: '#FEF4D8',
  orange: '#F68652',
  teal: '#83AFA7',
  lightGrey: '#CCCCCC',
    darkGrey: '#9B9B9B',
  shadowGrey: 'rgba(0, 0, 0, 0.2)',
};

// Debounce utility function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const SignupScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentSection, setCurrentSection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState({});
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Timeout refs for debounced validation
  const emailValidationTimeout = useRef(null);
  const usernameValidationTimeout = useRef(null);
  
  const { signup, checkEmailExists, checkUsernameExists } = useAuth();

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
      'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    });

    if (!fontsLoaded) {
      return null;
    }

      // Validation functions
  const validateEmail = async (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return 'Email is required';
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    if (email.length > 254) return 'Email is too long (max 254 characters)';
    
    // Check if email already exists
    const emailExists = await checkEmailExists(email.trim());
    if (emailExists) return 'This email is already registered';
    
    return null;
  };

  const validateUsername = async (username) => {
    if (!username.trim()) return 'Username is required';
    if (username.length < 3) return 'Username must be at least 3 characters long';
    if (username.length > 30) return 'Username must be less than 30 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
    if (!/^[a-zA-Z]/.test(username)) return 'Username must start with a letter';
    if (!/^[a-zA-Z0-9_]*[a-zA-Z0-9]$/.test(username)) return 'Username must end with a letter or number';
    
    // Check if username already exists
    const usernameExists = await checkUsernameExists(username.trim());
    if (usernameExists) return 'This username is already taken';
    
    return null;
  };

  const validateName = (name, fieldName) => {
    if (!name.trim()) return `${fieldName} is required`;
    return null;
  };

  const validatePassword = (password) => {
    if (!password.trim()) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (password.length > 128) return 'Password must be less than 128 characters';
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase) return 'Password must contain at least one uppercase letter';
    if (!hasLowerCase) return 'Password must contain at least one lowercase letter';
    if (!hasNumbers) return 'Password must contain at least one number';
    if (!hasSpecialChar) return 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)';
    
    return null;
  };

  // Check if current section is valid
  const isCurrentSectionValid = () => {
    if (currentSection === 1) {
      return email.trim() && username.trim() && !errors.email && !errors.username;
    } else if (currentSection === 2) {
      return firstName.trim() && lastName.trim() && !errors.firstName && !errors.lastName;
    } else if (currentSection === 3) {
      return password.trim() && confirmPassword.trim() && 
             password === confirmPassword && !errors.password && !errors.confirmPassword;
    }
    return false;
  };

  const handleFieldChange = async (fieldName, value) => {
    // Update the field value first
    switch (fieldName) {
      case 'email':
        setEmail(value);
        break;
      case 'username':
        setUsername(value);
        break;
      case 'firstName':
        setFirstName(value);
        break;
      case 'middleName':
        setMiddleName(value);
        break;
      case 'lastName':
        setLastName(value);
        break;
      case 'password':
        setPassword(value);
        break;
      case 'confirmPassword':
        setConfirmPassword(value);
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

    // Real-time validation for email and username with debouncing
    if (fieldName === 'email') {
      // Debounce email validation to avoid too many API calls
      clearTimeout(emailValidationTimeout.current);
      emailValidationTimeout.current = setTimeout(async () => {
        if (value.trim()) {
          setValidating(prev => ({ ...prev, email: true }));
          try {
            const emailError = await validateEmail(value);
            if (emailError) {
              setErrors(prev => ({ ...prev, email: emailError }));
            }
          } finally {
            setValidating(prev => ({ ...prev, email: false }));
          }
        }
      }, 500);
    }

    if (fieldName === 'username') {
      // Debounce username validation to avoid too many API calls
      clearTimeout(usernameValidationTimeout.current);
      usernameValidationTimeout.current = setTimeout(async () => {
        if (value.trim()) {
          setValidating(prev => ({ ...prev, username: true }));
          try {
            const usernameError = await validateUsername(value);
            if (usernameError) {
              setErrors(prev => ({ ...prev, username: usernameError }));
            }
          } finally {
            setValidating(prev => ({ ...prev, username: false }));
          }
        }
      }, 500);
    }

    // Real-time validation for other fields
    if (fieldName === 'firstName' && value.trim()) {
      const firstNameError = validateName(value, 'First name');
      if (firstNameError) {
        setErrors(prev => ({ ...prev, firstName: firstNameError }));
      }
    }

    if (fieldName === 'lastName' && value.trim()) {
      const lastNameError = validateName(value, 'Last name');
      if (lastNameError) {
        setErrors(prev => ({ ...prev, lastName: lastNameError }));
      }
    }

    if (fieldName === 'password' && value.trim()) {
      const passwordError = validatePassword(value);
      if (passwordError) {
        setErrors(prev => ({ ...prev, password: passwordError }));
      }
    }

    if (fieldName === 'confirmPassword' && value.trim()) {
      if (password !== value) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.confirmPassword;
          return newErrors;
        });
      }
    }
  };

  const handleNext = async () => {
    
    if (currentSection === 1) {
      // Validate first section
      const newErrors = {};
      
      const emailError = await validateEmail(email);
      if (emailError) newErrors.email = emailError;
      
      const usernameError = await validateUsername(username);
      if (usernameError) newErrors.username = usernameError;
      
      if (Object.keys(newErrors).length === 0) {
        setCurrentSection(2);
      } else {
        setErrors(newErrors);
      }
    } else if (currentSection === 2) {
      // Validate second section
      const newErrors = {};
      
      const firstNameError = validateName(firstName, 'First name');
      if (firstNameError) newErrors.firstName = firstNameError;
      
      const lastNameError = validateName(lastName, 'Last name');
      if (lastNameError) newErrors.lastName = lastNameError;
      
      // Validate middle name if provided (optional, no validation required)
      // Middle name can be any length and contain any characters
      
      if (Object.keys(newErrors).length === 0) {
        setCurrentSection(3);
      } else {
        setErrors(newErrors);
      }
    } else if (currentSection === 3) {
      // Validate third section
      const newErrors = {};
      
      const passwordError = validatePassword(password);
      if (passwordError) newErrors.password = passwordError;
      
      if (!confirmPassword.trim()) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      
      if (Object.keys(newErrors).length === 0) {
        // Send OTP for verification instead of direct signup
        setLoading(true);
        try {
          const result = await OTPService.sendOTP(email.trim(), 'signup');
          
          if (result.success) {
            // Navigate to OTP verification screen
            navigation.navigate('OTPVerification', {
              email: email.trim(),
              type: 'signup',
              onVerificationSuccess: async () => {
                // After OTP verification, proceed with signup
                try {
                  const displayName = `${firstName} ${lastName}`.trim();
                  const userData = {
                    username: username.trim(),
                    firstName: firstName.trim(),
                    middleName: middleName.trim(),
                    lastName: lastName.trim()
                  };
                  
                  await signup(email.trim(), password, displayName, userData);
                  // Success - navigation to main app happens automatically via AuthContext
                } catch (error) {
                  let errorMessage = 'An error occurred during signup';
                  
                  if (error.code === 'auth/email-already-in-use') {
                    Alert.alert('Error', 'An account with this email already exists');
                  } else if (error.code === 'auth/invalid-email') {
                    Alert.alert('Error', 'Please enter a valid email address');
                  } else if (error.code === 'auth/weak-password') {
                    Alert.alert('Error', 'Password is too weak. Please choose a stronger password');
                  } else {
                    Alert.alert('Error', errorMessage);
                  }
                }
              }
            });
          } else {
            Alert.alert('Error', result.message);
          }
        } catch (error) {
          console.error('OTP send error:', error);
          Alert.alert('Error', 'Failed to send verification code. Please try again.');
        } finally {
          setLoading(false);
        }
      } else {
        setErrors(newErrors);
      }
    }
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
            <Text style={styles.mainTitle}>
              {currentSection === 1 
                ? 'Mine, Steal or Lock it!'
                : currentSection === 2
                ? 'Mine, Steal or Lock it!'
                : 'Choose a password'
              }
            </Text>
            <Text style={styles.subtitle}>
              {currentSection === 1 
                ? 'Register or sign in and we\'ll get started'
                : currentSection === 2
                ? 'Tell us your name to get started'
                : 'Create a password'
              }
            </Text>
          </View>
      </View>

      {/* Main Content */}
        <View style={styles.content}>
        
        {/* Input Fields */}
          <View style={styles.inputSection}>
            {currentSection === 1 ? (
              // First Section: Email & Username
              <>
        <View style={styles.inputContainer}>
          <View style={styles.inputFieldContainer}>
          <TextInput
                                   style={[styles.inputField, errors.email && styles.inputFieldError]}
            placeholder="Enter your email"
              placeholderTextColor={COLORS.darkGrey}
            value={email}
              onChangeText={(value) => handleFieldChange('email', value)}
              
            keyboardType="email-address"
            autoCapitalize="none"
          />
            {validating.email && (
              <View style={styles.validationIndicator}>
                <ActivityIndicator size="small" color={COLORS.teal} />
              </View>
            )}
          </View>
                             {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>
                 
                 <View style={styles.inputContainer}>
                   <View style={styles.inputFieldContainer}>
                     <TextInput
                       style={[styles.inputField, errors.username && styles.inputFieldError]}
                       placeholder="Username"
                       placeholderTextColor={COLORS.darkGrey}
                       value={username}
                       onChangeText={(value) => handleFieldChange('username', value)}
  
                       autoCapitalize="none"
                     />
                     {validating.username && (
                       <View style={styles.validationIndicator}>
                         <ActivityIndicator size="small" color={COLORS.teal} />
                       </View>
                     )}
                   </View>
                   {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
                 </View>
              </>
            ) : currentSection === 2 ? (
              // Second Section: Names
              <>
                                 <View style={styles.inputContainer}>
                   <TextInput
                     style={[styles.inputField, errors.firstName && styles.inputFieldError]}
                     placeholder="First Name"
                     placeholderTextColor={COLORS.darkGrey}
                     value={firstName}
                     onChangeText={(value) => handleFieldChange('firstName', value)}

                     autoCapitalize="words"
                   />
                   {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
                 </View>
                 
                 <View style={styles.inputContainer}>
          <TextInput
            style={styles.inputField}
                     placeholder="Middle Name (Optional)"
                     placeholderTextColor={COLORS.darkGrey}
                     value={middleName}
                     onChangeText={(value) => handleFieldChange('middleName', value)}
                     autoCapitalize="words"
                   />
                 </View>

                 <View style={styles.inputContainer}>
                   <TextInput
                     style={[styles.inputField, errors.lastName && styles.inputFieldError]}
                     placeholder="Last Name"
                     placeholderTextColor={COLORS.darkGrey}
                     value={lastName}
                     onChangeText={(value) => handleFieldChange('lastName', value)}

                     autoCapitalize="words"
                   />
                   {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
                 </View>
              </>
            ) : (
              // Third Section: Password
              <>
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
                 
                                  <View style={styles.inputContainer}>
                   <View style={styles.inputFieldContainer}>
                     <TextInput
                       style={[styles.inputField, errors.confirmPassword && styles.inputFieldError]}
                       placeholder="Re-enter your password"
                       placeholderTextColor={COLORS.darkGrey}
                       value={confirmPassword}
                       onChangeText={(value) => handleFieldChange('confirmPassword', value)}
                       secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
          />
                     <TouchableOpacity
                       style={styles.passwordToggle}
                       onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                     >
                       <MaterialIcons 
                         name={showConfirmPassword ? 'visibility-off' : 'visibility'} 
                         size={24} 
                         color={COLORS.darkGrey} 
                       />
                     </TouchableOpacity>
                   </View>
                   {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                 </View>
              </>
            )}
        </View>

                   {/* General Error Display */}
         {errors.general && (
           <Text style={styles.generalErrorText}>{errors.general}</Text>
         )}
        
        {/* Next Button */}
         <TouchableOpacity 
           style={[
             styles.nextButton, 
             !isCurrentSectionValid() && styles.nextButtonDisabled
           ]}
           onPress={handleNext}
           disabled={!isCurrentSectionValid() || loading}
         >
           <Text style={[
             styles.nextButtonText,
             !isCurrentSectionValid() && styles.nextButtonTextDisabled
           ]}>
             {loading ? 'Creating Account...' : currentSection === 1 ? 'Next' : currentSection === 2 ? 'Next' : 'Submit'}
           </Text>
        </TouchableOpacity>
        
          {/* Legal Disclaimer */}
          <View style={styles.legalSection}>
          <Text style={styles.legalText}>
            By signing up, you agree to our{' '}
              <Text style={styles.linkText}>Terms of Service</Text>
            {' '}and{' '}
              <Text style={styles.linkText}>Privacy Policy</Text>
          </Text>
        </View>

          {/* Sign In Option */}
          <View style={styles.signInSection}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
        </View>
        
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
    alignItems: 'center'
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
  nextButton: {
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
      nextButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.lightGrey,
    opacity: 0.6,
  },
  nextButtonTextDisabled: {
    color: COLORS.darkGrey,
  },
    legalSection: {
      marginBottom: 30,
    paddingHorizontal: 20,
  },
  legalText: {
      fontSize: 12,
    fontFamily: 'Poppins-Regular',
      color: COLORS.teal,
    textAlign: 'center',
      lineHeight: 18,
  },
    linkText: {
    color: COLORS.orange,
    fontFamily: 'Poppins-SemiBold',
  },
    signInSection: {
      flexDirection: 'row',
    alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    signInText: {
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      color: COLORS.teal,
    },
    signInLink: {
    fontSize: 14,
      fontFamily: 'Poppins-SemiBold',
      color: COLORS.orange,
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
  validationIndicator: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  passwordToggle: {
    position: 'absolute',
    right: 15,
    top: '40%',
    transform: [{ translateY: -12 }],
    padding: 5,
  },
});

export default SignupScreen;
