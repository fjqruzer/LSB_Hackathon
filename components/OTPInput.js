import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

const COLORS = {
  background: '#FEF4D8',
  orange: '#F68652',
  teal: '#83AFA7',
  lightGrey: '#CCCCCC',
  darkGrey: '#9B9B9B',
  shadowGrey: 'rgba(0, 0, 0, 0.2)',
};

const OTPInput = ({
  length = 6,
  onComplete,
  onResend,
  disabled = false,
  resendCooldown = 60,
  error = false,
  autoFocus = true,
}) => {
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  });

  const inputRefs = useRef([]);

  // Resend timer effect
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleOTPChange = (text, index) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, '');
    
    if (numericText.length <= 1) {
      const newOtp = otp.split('');
      newOtp[index] = numericText;
      const updatedOtp = newOtp.join('');
      setOtp(updatedOtp);

      // Auto-focus next input
      if (numericText && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if OTP is complete
      if (updatedOtp.length === length && updatedOtp.replace(/\s/g, '').length === length) {
        onComplete(updatedOtp);
      }
    }
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    if (resendTimer === 0) {
      setResendTimer(resendCooldown);
      onResend();
    }
  };

  const clearOTP = () => {
    setOtp('');
    inputRefs.current[0]?.focus();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.otpContainer}>
        {Array.from({ length }, (_, index) => (
          <TextInput
            key={index}
            ref={ref => (inputRefs.current[index] = ref)}
            style={[
              styles.otpInput,
              error && styles.otpInputError,
              otp[index] && styles.otpInputFilled,
              { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
            ]}
            value={otp[index] || ''}
            onChangeText={text => handleOTPChange(text, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            keyboardType="numeric"
            maxLength={1}
            editable={!disabled}
            autoFocus={autoFocus && index === 0}
            selectTextOnFocus
            textAlign="center"
          />
        ))}
      </View>

      {otp.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={clearOTP}>
          <MaterialIcons name="clear" size={18} color={COLORS.darkGrey} />
          <Text style={[styles.clearText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            Clear
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.resendContainer}>
        <Text style={[styles.resendText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
          Didn't receive the code?
        </Text>
        
        <TouchableOpacity
          style={[styles.resendButton, resendTimer > 0 && styles.resendButtonDisabled]}
          onPress={handleResend}
          disabled={resendTimer > 0 || disabled}
        >
          <Text style={[
            styles.resendButtonText,
            resendTimer > 0 && styles.resendButtonTextDisabled,
            { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
          ]}>
            {resendTimer > 0 ? `Resend in ${formatTime(resendTimer)}` : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={16} color="#FF4444" />
          <Text style={[styles.errorText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
    width: '100%',
  },
  otpInput: {
    width: 45,
    height: 45,
    borderWidth: 2,
    borderColor: COLORS.orange,
    borderRadius: 22.5,
    fontSize: 18,
    color: COLORS.teal,
    backgroundColor: 'transparent',
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
    lineHeight: 20,
  },
  otpInputFilled: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(131, 175, 167, 0.1)',
  },
  otpInputError: {
    borderColor: '#FF4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(131, 175, 167, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.teal,
  },
  clearText: {
    fontSize: 14,
    color: COLORS.darkGrey,
    marginLeft: 6,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.darkGrey,
    marginBottom: 12,
  },
  resendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.teal,
  },
  resendButtonDisabled: {
    backgroundColor: COLORS.lightGrey,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontFamily: 'Poppins-Medium',
  },
  resendButtonTextDisabled: {
    color: COLORS.darkGrey,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF4444',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FF4444',
    marginLeft: 6,
  },
});

export default OTPInput;
