import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import StandardModal from '../components/StandardModal';

const EditProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  
  // Helper functions for modals
  const showError = (message) => {
    setModalMessage(message);
    setShowErrorModal(true);
  };

  const showSuccess = (message) => {
    setModalMessage(message);
    setShowSuccessModal(true);
  };
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
          setDisplayName(profile?.displayName || user?.displayName || '');
          setUsername(profile?.username || '');
          setBio(profile?.bio || '');
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
      setLoading(false);
    };

    fetchUserProfile();
  }, [user, getUserProfile]);

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  const handleSave = async () => {
    if (!user) {
      showError('User not found');
      return;
    }

    // Validate inputs
    if (!displayName.trim()) {
      showError('Display name is required');
      return;
    }

    if (!username.trim()) {
      showError('Username is required');
      return;
    }

    // Check username format (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      showError('Username can only contain letters, numbers, and underscores');
      return;
    }

    // Check username length
    if (username.length < 3 || username.length > 20) {
      showError('Username must be between 3 and 20 characters');
      return;
    }

    try {
      setSaving(true);

      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
      });

      // Update Firestore profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        updatedAt: new Date(),
      });

      showSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      showError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowDiscardModal(true);
  };

  const confirmDiscard = () => {
    setShowDiscardModal(false);
    navigation.goBack();
  };

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar 
        style="dark" 
        backgroundColor="#DFECE2"
        translucent={Platform.OS === "android"}
        barStyle="dark-content"
        animated={true}
        hidden={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#83AFA7" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
          Edit Profile
        </Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.saveButton}
          disabled={saving}
        >
          <Text style={[styles.saveButtonText, { fontFamily: fontsLoaded ? 'Poppins-SemiBold' : undefined }]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Personal Information
          </Text>
          
          {/* Display Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Display Name *
            </Text>
            <TextInput
              style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              placeholderTextColor="#999"
              maxLength={50}
            />
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Username *
            </Text>
            <TextInput
              style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor="#999"
              maxLength={20}
              autoCapitalize="none"
            />
            <Text style={[styles.inputHint, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              3-20 characters, letters, numbers, and underscores only
            </Text>
          </View>

          {/* Bio */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Bio
            </Text>
            <TextInput
              style={[styles.textArea, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            <Text style={[styles.inputHint, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              {bio.length}/200 characters
            </Text>
          </View>
        </View>

        {/* Profile Picture Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Profile Picture
          </Text>
          <Text style={[styles.sectionDescription, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            To change your profile picture, go back to the Profile screen and tap on your current photo.
          </Text>
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Tips
          </Text>
          <View style={styles.tipsContainer}>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#83AFA7" />
              <Text style={[styles.tipText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Choose a display name that others can easily recognize
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#83AFA7" />
              <Text style={[styles.tipText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Your username will be visible to other users
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#83AFA7" />
              <Text style={[styles.tipText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                A good bio helps others get to know you better
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Error Modal */}
      <StandardModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message={modalMessage}
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
        message={modalMessage}
        confirmText="OK"
        onConfirm={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
        showCancel={false}
        confirmButtonStyle="success"
      />

      {/* Discard Changes Modal */}
      <StandardModal
        visible={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        title="Discard Changes"
        message="Are you sure you want to discard your changes?"
        confirmText="Discard"
        cancelText="Keep Editing"
        onConfirm={confirmDiscard}
        showCancel={true}
        confirmButtonStyle="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DFECE2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'android' ? 12 : 16,
    backgroundColor: '#DFECE2',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: '#83AFA7',
  },
  saveButton: {
    backgroundColor: '#83AFA7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
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
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: Platform.OS === 'android' ? 12 : 16,
  },
  label: {
    fontSize: Platform.OS === 'android' ? 12 : 14,
    color: '#333',
    marginBottom: Platform.OS === 'android' ? 6 : 8,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    fontSize: Platform.OS === 'android' ? 13 : 14,
    color: '#333',
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    fontSize: Platform.OS === 'android' ? 13 : 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  tipsContainer: {
    marginTop: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },
});

export default EditProfileScreen;
