import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../config/cloudinary';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import NotificationService from '../services/NotificationService';
import StandardModal from '../components/StandardModal';

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout, getUserProfile, forceUpdatePushToken } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImageKey, setProfileImageKey] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState(null);
  
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

  // Show loading state
  if (loading || uploadingImage) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: 'Poppins-Regular', color: '#666' }}>
          {uploadingImage ? 'Uploading profile picture...' : 'Loading profile...'}
        </Text>
      </View>
    );
  }

  // Show error state if no user
  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: 'Poppins-Regular', color: '#666' }}>Please log in to view your profile</Text>
      </View>
    );
  }

  // Handle profile picture upload
  const handleImageUpload = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a profile picture.');
        return;
      }

      // Show image picker options
      Alert.alert(
        'Select Profile Picture',
        'Choose how you want to select your profile picture',
        [
          {
            text: 'Camera',
            onPress: () => pickImage('camera'),
          },
          {
            text: 'Photo Library',
            onPress: () => pickImage('library'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
    }
  };

  const pickImage = async (source) => {
    try {
      setUploadingImage(true);

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant camera permissions to take a photo.');
          setUploadingImage(false);
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadProfilePicture(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadProfilePicture = async (imageUri) => {
    try {
      setUploadingImage(true);

      // Upload to Cloudinary
      const imageUrl = await uploadImageToCloudinary(imageUri);
      
      if (user) {
        // For Android, use temporary URL for immediate display
        if (Platform.OS === 'android') {
          setTempImageUrl(imageUrl);
        }

        // Update local state immediately for instant UI update
        setUserProfile(prev => ({
          ...prev,
          photoURL: imageUrl
        }));

        // Force re-render of profile image
        setProfileImageKey(prev => prev + 1);

        // Additional refresh for Android after a short delay
        if (Platform.OS === 'android') {
          setTimeout(() => {
            setProfileImageKey(prev => prev + 1);
            setTempImageUrl(null); // Clear temp URL after refresh
          }, 1000);
        }

        // Update Firebase Auth user profile for real-time updates
        await updateProfile(auth.currentUser, {
          photoURL: imageUrl
        });

        // Update user profile in Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          photoURL: imageUrl,
          updatedAt: new Date()
        });

        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingImage(false);
    }
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


  // Dynamic stats based on user data
  const profileStats = [
    { 
      label: 'Items Sold', 
      value: userProfile?.itemsSold || '0', 
      icon: 'checkmark-circle-outline' 
    },
    { 
      label: 'Active Listings', 
      value: userProfile?.activeListings || '0', 
      icon: 'list-outline' 
    },
    { 
      label: 'Total Bids', 
      value: userProfile?.totalBids || '0', 
      icon: 'hammer-outline' 
    },
    { 
      label: 'Followers', 
      value: userProfile?.followers || '0', 
      icon: 'people-outline' 
    },
  ];

  // Seller Menu Items
  const sellerMenuItems = [
    { icon: 'storefront-outline', title: 'My Shop', subtitle: 'Manage your listings', color: '#83AFA7' },
    { icon: 'receipt-outline', title: 'My Sales', subtitle: 'Orders from buyers', color: '#4CAF50' },
    { icon: 'card-outline', title: 'My Payment Methods', subtitle: 'Manage payment methods', color: '#2196F3' },
    { icon: 'checkmark-circle-outline', title: 'My Payment Approvals', subtitle: 'Approve buyer payments', color: '#FF9800' },
  ];

  // Buyer Menu Items
  const buyerMenuItems = [
    { icon: 'card-outline', title: 'My Orders', subtitle: 'Purchased Item', color: '#2196F3' },
    { icon: 'heart-outline', title: 'My Favorites', subtitle: 'Saved items', color: '#F68652' },
  ];

  // General Menu Items
  const generalMenuItems = [
    { icon: 'location-outline', title: 'My Address', subtitle: 'Manage your address', color: '#4CAF50' },
    { icon: 'lock-closed-outline', title: 'My Password', subtitle: 'Change password', color: '#FF5722' },
    { icon: 'settings-outline', title: 'My Settings', subtitle: 'App preferences', color: '#2196F3' },
    { icon: 'help-circle-outline', title: 'My Help', subtitle: 'Get assistance', color: '#9C27B0' },
  ];

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  const handleMenuPress = (title) => {
    if (title === 'My Shop') {
      navigation.navigate('MyShop');
    } else if (title === 'My Sales') {
      navigation.navigate('MySales');
    } else if (title === 'My Payment Methods') {
      navigation.navigate('PaymentMethods');
    } else if (title === 'My Payment Approvals') {
      navigation.navigate('MyPaymentApprovals');
    } else if (title === 'My Orders') {
      navigation.navigate('MyPayments');
    } else if (title === 'My Favorites') {
      navigation.navigate('MyFavorites');
    } else if (title === 'My Address') {
      navigation.navigate('MyAddress');
    } else if (title === 'My Password') {
      navigation.navigate('MyPassword');
    } else if (title === 'My Settings') {
      navigation.navigate('MySettings');
    } else if (title === 'My Help') {
      navigation.navigate('MyHelp');
    } else {
      }
  };

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
        <Text style={[styles.headerTitle, { color: colors.accent }]}>Profile</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Ionicons name="create-outline" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={handleImageUpload} disabled={uploadingImage}>
              <View style={styles.profileImageContainer}>
            <Image 
                  key={profileImageKey}
                  source={{ 
                    uri: (tempImageUrl || user?.photoURL || userProfile?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face") + 
                    (Platform.OS === 'android' ? `?t=${Date.now()}` : '')
                  }}
              style={styles.profileImage}
                  onError={() => {
                    // Force refresh on error
                    setProfileImageKey(prev => prev + 1);
                  }}
                />
                {uploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <Ionicons name="cloud-upload-outline" size={20} color="white" />
                  </View>
                )}
                <View style={styles.editImageIcon}>
                  <Ionicons name="camera-outline" size={12} color="white" />
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {userProfile?.displayName || user?.displayName || 'User'}
              </Text>
              <Text style={styles.profileUsername}>
                @{userProfile?.username || 'username'}
              </Text>
              <Text style={styles.profileBio}>
                {userProfile?.bio || 'Welcome to COPit! Start exploring amazing deals and connect with the community.'}
              </Text>
            </View>
          </View>
          
          {/* Stats */}
          <View style={styles.statsContainer}>
            {profileStats.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <View style={styles.statIcon}>
                  <Ionicons name={stat.icon} size={20} color="#83AFA7" />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Seller Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seller</Text>
          {sellerMenuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.title)}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buyer Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buyer</Text>
          {buyerMenuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.title)}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
          ))}
        </View>

        {/* General Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          {generalMenuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.title)}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
          ))}
        </View>



        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF5252" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  profileSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editImageIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#83AFA7',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#333',
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#83AFA7',
    marginBottom: 4,
  },
  profileBio: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    lineHeight: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F8F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 1,
  },
  menuSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#FF5252',
    marginLeft: 6,
  },
});

export default ProfileScreen;
