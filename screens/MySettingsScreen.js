import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import StandardModal from '../components/StandardModal';

const MySettingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    notifications: {
      pushNotifications: true,
      emailNotifications: true,
      bidAlerts: true,
      paymentReminders: true,
      listingUpdates: true,
    },
    privacy: {
      showProfile: true,
      showActivity: true,
      allowMessages: true,
    },
    preferences: {
      language: 'English',
      currency: 'PHP',
    },
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.settings) {
            setSettings(prevSettings => ({
              ...prevSettings,
              ...userData.settings,
            }));
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Save settings to Firestore
  const saveSettings = async (newSettings) => {
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        settings: newSettings,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  // Handle toggle switches
  const handleToggle = async (category, setting) => {
    // Special handling for dark mode
    if (category === 'preferences' && setting === 'darkMode') {
      toggleTheme();
      return;
    }

    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [setting]: !settings[category][setting],
      },
    };
    
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  // Handle logout
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      navigation.navigate('Login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  // Handle language change
  const handleLanguageChange = (language) => {
    const newSettings = {
      ...settings,
      preferences: {
        ...settings.preferences,
        language,
      },
    };
    setSettings(newSettings);
    saveSettings(newSettings);
    setShowLanguageModal(false);
  };

  // Handle currency change
  const handleCurrencyChange = (currency) => {
    const newSettings = {
      ...settings,
      preferences: {
        ...settings.preferences,
        currency,
      },
    };
    setSettings(newSettings);
    saveSettings(newSettings);
    setShowCurrencyModal(false);
  };

  // Helper function to create setting items
  const createSettingItem = (icon, title, description, value, onToggle, isSwitch = true) => (
    <View style={[styles.settingItem, { backgroundColor: colors.secondary }]}>
      <View style={styles.settingInfo}>
        <Ionicons name={icon} size={24} color={colors.accent} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined, color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.settingDescription, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined, color: colors.textSecondary }]}>
            {description}
          </Text>
        </View>
      </View>
      {isSwitch ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={value ? '#FFFFFF' : '#FFFFFF'}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </View>
  );

  // Helper function to create navigation setting items
  const createNavigationItem = (icon, title, description, onPress, isLogout = false) => (
    <TouchableOpacity 
      style={[
        styles.settingItem, 
        { backgroundColor: colors.secondary },
        isLogout && { borderLeftWidth: 4, borderLeftColor: colors.error }
      ]}
      onPress={onPress}
    >
      <View style={styles.settingInfo}>
        <Ionicons name={icon} size={24} color={isLogout ? colors.error : colors.accent} />
        <View style={styles.settingText}>
          <Text style={[
            styles.settingTitle, 
            { 
              fontFamily: fontsLoaded ? "Poppins-Medium" : undefined, 
              color: isLogout ? colors.error : colors.text 
            }
          ]}>
            {title}
          </Text>
          <Text style={[styles.settingDescription, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined, color: colors.textSecondary }]}>
            {description}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, backgroundColor: colors.primary }]}>
        <StatusBar
          style={isDarkMode ? "light" : "dark"}
          backgroundColor={colors.primary}
          translucent={Platform.OS === "android"}
          barStyle={isDarkMode ? "light-content" : "dark-content"}
          animated={true}
          hidden={false}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined, color: colors.textSecondary }]}>
            Loading settings...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: colors.primary }]}>
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
          Settings
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.text }]}>
            Notifications
          </Text>
          
          {createSettingItem(
            'notifications-outline',
            'Push Notifications',
            'Receive push notifications',
            settings.notifications.pushNotifications,
            () => handleToggle('notifications', 'pushNotifications')
          )}

          {createSettingItem(
            'mail-outline',
            'Email Notifications',
            'Receive email updates',
            settings.notifications.emailNotifications,
            () => handleToggle('notifications', 'emailNotifications')
          )}

          {createSettingItem(
            'hammer-outline',
            'Bid Alerts',
            'Get notified about new bids',
            settings.notifications.bidAlerts,
            () => handleToggle('notifications', 'bidAlerts')
          )}

          {createSettingItem(
            'time-outline',
            'Payment Reminders',
            'Reminders for pending payments',
            settings.notifications.paymentReminders,
            () => handleToggle('notifications', 'paymentReminders')
          )}

          {createSettingItem(
            'list-outline',
            'Listing Updates',
            'Updates about your listings',
            settings.notifications.listingUpdates,
            () => handleToggle('notifications', 'listingUpdates')
          )}
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.text }]}>
            Privacy
          </Text>
          
          {createSettingItem(
            'person-outline',
            'Show Profile',
            'Make your profile visible to others',
            settings.privacy.showProfile,
            () => handleToggle('privacy', 'showProfile')
          )}

          {createSettingItem(
            'eye-outline',
            'Show Activity',
            'Display your activity to others',
            settings.privacy.showActivity,
            () => handleToggle('privacy', 'showActivity')
          )}

          {createSettingItem(
            'chatbubble-outline',
            'Allow Messages',
            'Let others send you messages',
            settings.privacy.allowMessages,
            () => handleToggle('privacy', 'allowMessages')
          )}
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.text }]}>
            Preferences
          </Text>
          
          {createNavigationItem(
            'language-outline',
            'Language',
            settings.preferences.language,
            () => setShowLanguageModal(true),
            false
          )}

          {createNavigationItem(
            'cash-outline',
            'Currency',
            settings.preferences.currency,
            () => setShowCurrencyModal(true),
            false
          )}

          {createSettingItem(
            'moon-outline',
            'Dark Mode',
            'Switch to dark theme',
            isDarkMode,
            () => handleToggle('preferences', 'darkMode')
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.text }]}>
            Account
          </Text>
          
          {createNavigationItem(
            'lock-closed-outline',
            'Change Password',
            'Update your password',
            () => navigation.navigate('MyPassword'),
            false
          )}

          {createNavigationItem(
            'person-outline',
            'Edit Profile',
            'Update your profile information',
            () => navigation.navigate('EditProfile'),
            false
          )}

          {createNavigationItem(
            'log-out-outline',
            'Logout',
            'Sign out of your account',
            handleLogout,
            true
          )}
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <StandardModal
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title="Select Language"
        message="Choose your preferred language"
        confirmText="Cancel"
        onConfirm={() => setShowLanguageModal(false)}
        showCancel={false}
        confirmButtonStyle="primary"
      >
        <View style={styles.modalContent}>
          {['English', 'Filipino', 'Spanish', 'Chinese', 'Japanese'].map((language) => (
            <TouchableOpacity
              key={language}
              style={[styles.modalOption, { borderBottomColor: colors.border }]}
              onPress={() => handleLanguageChange(language)}
            >
              <Text style={[styles.modalOptionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined, color: colors.text }]}>
                {language}
              </Text>
              {settings.preferences.language === language && (
                <Ionicons name="checkmark" size={20} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </StandardModal>

      {/* Currency Selection Modal */}
      <StandardModal
        visible={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        title="Select Currency"
        message="Choose your preferred currency"
        confirmText="Cancel"
        onConfirm={() => setShowCurrencyModal(false)}
        showCancel={false}
        confirmButtonStyle="primary"
      >
        <View style={styles.modalContent}>
          {['PHP', 'USD', 'EUR', 'JPY', 'GBP'].map((currency) => (
            <TouchableOpacity
              key={currency}
              style={[styles.modalOption, { borderBottomColor: colors.border }]}
              onPress={() => handleCurrencyChange(currency)}
            >
              <Text style={[styles.modalOptionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined, color: colors.text }]}>
                {currency}
              </Text>
              {settings.preferences.currency === currency && (
                <Ionicons name="checkmark" size={20} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </StandardModal>

      {/* Logout Confirmation Modal */}
      <StandardModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={confirmLogout}
        showCancel={true}
        confirmButtonStyle="danger"
      />
    </View>
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
    fontSize: Platform.OS === 'android' ? 16 : 18,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
  },
  modalContent: {
    maxHeight: 200,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
  },
});

export default MySettingsScreen;