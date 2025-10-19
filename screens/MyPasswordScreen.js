import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import StandardModal from '../components/StandardModal';

const MyPasswordScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
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

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword.trim()) {
      showError('Please enter your current password');
      return;
    }

    if (!newPassword.trim()) {
      showError('Please enter a new password');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      showError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      showError('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      showSuccess('Password changed successfully!');
    } catch (error) {
      console.error('Password change error:', error);
      
      let errorMsg = 'Failed to change password. Please try again.';
      
      switch (error.code) {
        case 'auth/wrong-password':
          errorMsg = 'Current password is incorrect';
          break;
        case 'auth/weak-password':
          errorMsg = 'New password is too weak. Please choose a stronger password.';
          break;
        case 'auth/requires-recent-login':
          errorMsg = 'Please log out and log back in before changing your password';
          break;
        case 'auth/too-many-requests':
          errorMsg = 'Too many failed attempts. Please try again later.';
          break;
        default:
          errorMsg = error.message || errorMsg;
      }
      
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: topPadding, backgroundColor: colors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar
        style={isDarkMode ? "light" : "dark"}
        backgroundColor={colors.primary}
        translucent={Platform.OS === "android"}
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        animated={true}
        hidden={false}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
          Change Password
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Password Form */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Change Password
          </Text>

          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Current Password
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter your current password"
                placeholderTextColor="#999"
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Ionicons 
                  name={showCurrentPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              New Password
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter your new password"
                placeholderTextColor="#999"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Ionicons 
                  name={showNewPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Confirm New Password
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your new password"
                placeholderTextColor="#999"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsSection}>
            <Text style={[styles.requirementsTitle, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Password Requirements:
            </Text>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={newPassword.length >= 8 ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={newPassword.length >= 8 ? "#4CAF50" : "#CCC"} 
              />
              <Text style={[styles.requirementText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                At least 8 characters
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={/[A-Z]/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={/[A-Z]/.test(newPassword) ? "#4CAF50" : "#CCC"} 
              />
              <Text style={[styles.requirementText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                At least one uppercase letter
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={/[a-z]/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={/[a-z]/.test(newPassword) ? "#4CAF50" : "#CCC"} 
              />
              <Text style={[styles.requirementText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                At least one lowercase letter
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={/\d/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={/\d/.test(newPassword) ? "#4CAF50" : "#CCC"} 
              />
              <Text style={[styles.requirementText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                At least one number
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? "#4CAF50" : "#CCC"} 
              />
              <Text style={[styles.requirementText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                At least one special character
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={newPassword !== currentPassword && newPassword.length > 0 ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={newPassword !== currentPassword && newPassword.length > 0 ? "#4CAF50" : "#CCC"} 
              />
              <Text style={[styles.requirementText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Different from current password
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={newPassword === confirmPassword && confirmPassword.length > 0 ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={newPassword === confirmPassword && confirmPassword.length > 0 ? "#4CAF50" : "#CCC"} 
              />
              <Text style={[styles.requirementText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Passwords match
              </Text>
            </View>
          </View>

          {/* Change Password Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              loading && styles.submitButtonDisabled
            ]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="white" />
                <Text style={[styles.submitButtonText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, marginLeft: 8 }]}>
                  Changing Password...
                </Text>
              </View>
            ) : (
              <Text style={[styles.submitButtonText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Change Password
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Error Modal */}
      <StandardModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message={errorMessage}
        confirmText="OK"
        onConfirm={() => setShowErrorModal(false)}
        showCancel={false}
        confirmButtonStyle="primary"
      />

      {/* Success Modal */}
      <StandardModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success"
        message={successMessage}
        confirmText="OK"
        onConfirm={handleSuccess}
        showCancel={false}
        confirmButtonStyle="success"
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'android' ? 12 : 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: Platform.OS === 'android' ? 16 : 24,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#83AFA7',
    marginBottom: Platform.OS === 'android' ? 12 : 16,
  },
  inputGroup: {
    marginBottom: Platform.OS === 'android' ? 12 : 16,
  },
  label: {
    fontSize: Platform.OS === 'android' ? 12 : 14,
    color: '#333',
    marginBottom: Platform.OS === 'android' ? 6 : 8,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: Platform.OS === 'android' ? 13 : 14,
    color: '#333',
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
  },
  eyeButton: {
    padding: Platform.OS === 'android' ? 6 : 8,
  },
  requirementsSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: Platform.OS === 'android' ? 12 : 16,
    marginBottom: Platform.OS === 'android' ? 16 : 24,
  },
  requirementsTitle: {
    fontSize: Platform.OS === 'android' ? 12 : 14,
    color: '#333',
    marginBottom: Platform.OS === 'android' ? 8 : 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 6 : 8,
  },
  requirementText: {
    fontSize: Platform.OS === 'android' ? 11 : 13,
    color: '#666',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#83AFA7',
    borderRadius: 25,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonText: {
    fontSize: 14,
    color: 'white',
  },
  submitButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default MyPasswordScreen;
