import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import OTPInput from '../components/OTPInput';
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

const OTPVerificationScreen = ({ 
  navigation, 
  route 
}) => {
  const { email, type = 'signup', onVerificationSuccess } = route.params;
  
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  });

  // Check remaining time periodically
  useEffect(() => {
    const checkRemainingTime = async () => {
      const time = await OTPService.getRemainingTime(email);
      setRemainingTime(time);
    };

    checkRemainingTime();
    const interval = setInterval(checkRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [email]);

  const handleOTPComplete = async (otpCode) => {
    setOtp(otpCode);
    setError('');
    setLoading(true);

    try {
      const result = await OTPService.verifyOTP(email, otpCode);
      
      if (result.success) {
        // OTP verified successfully
        Alert.alert(
          'Success!',
          result.message,
          [
            {
              text: 'Continue',
              onPress: () => {
                if (onVerificationSuccess) {
                  onVerificationSuccess();
                } else {
                  // Navigate based on type
                  if (type === 'signup') {
                    navigation.navigate('Login');
                  } else {
                    navigation.goBack();
                  }
                }
              }
            }
          ]
        );
      } else {
        setError(result.message);
        setOtp('');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('An error occurred. Please try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError('');

    try {
      const result = await OTPService.sendOTP(email, type);
      
      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleBack = () => {
    Alert.alert(
      'Cancel Verification',
      'Are you sure you want to cancel? You will need to start the process again.',
      [
        { text: 'Continue', style: 'cancel' },
        { 
          text: 'Cancel', 
          style: 'destructive',
          onPress: () => {
            OTPService.clearOTP();
            navigation.goBack();
          }
        }
      ]
    );
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#83AFA7" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.teal} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.titleSection}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="email" size={50} color={COLORS.teal} />
              </View>
              
              <Text style={styles.mainTitle}>
                Verify Your Email
              </Text>
              
              <Text style={styles.subtitle}>
                We've sent a 6-digit verification code to
              </Text>
              
              <Text style={styles.emailText}>
                {email}
              </Text>
            </View>

            {remainingTime > 0 && (
              <View style={styles.timerContainer}>
                <MaterialIcons name="access-time" size={16} color={COLORS.teal} />
                <Text style={styles.timerText}>
                  Code expires in {formatTime(remainingTime)}
                </Text>
              </View>
            )}

            <View style={styles.otpSection}>
              <OTPInput
                length={6}
                onComplete={handleOTPComplete}
                onResend={handleResend}
                disabled={loading}
                error={error}
                resendCooldown={60}
              />
            </View>

            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={COLORS.teal} />
                <Text style={styles.loadingText}>
                  Verifying...
                </Text>
              </View>
            )}

            {resendLoading && (
              <View style={styles.resendLoading}>
                <ActivityIndicator size="small" color={COLORS.teal} />
                <Text style={styles.resendLoadingText}>
                  Sending new code...
                </Text>
              </View>
            )}

            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                Check your email inbox and spam folder for the verification code.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: height * 0.7,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 22,
    fontFamily: 'Poppins-SemiBold',
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: COLORS.darkGrey,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  emailText: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(131, 175, 167, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.teal,
  },
  timerText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: COLORS.teal,
    marginLeft: 4,
  },
  otpSection: {
    width: '100%',
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(254, 244, 216, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: COLORS.teal,
    marginTop: 12,
  },
  resendLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  resendLoadingText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    marginLeft: 8,
  },
  helpContainer: {
    marginTop: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  helpText: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: COLORS.darkGrey,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default OTPVerificationScreen;
