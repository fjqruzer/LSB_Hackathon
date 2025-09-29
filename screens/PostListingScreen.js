import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadMultipleImages } from '../config/cloudinary';
import CustomPopup from '../components/CustomPopup';
import StandardModal from '../components/StandardModal';

const PostListingScreen = ({ navigation, selectedPhotos, setSelectedPhotos }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const { notifyNewListing } = useNotifications();
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // State management
  const [condition, setCondition] = useState('new');
  const [priceType, setPriceType] = useState('msl');
  const [dealMethod, setDealMethod] = useState('delivery');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [renderKey, setRenderKey] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Helper function to show error modal
  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };
  
  // Popup state
  const [popup, setPopup] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    showCancel: false,
    onConfirm: null,
  });
  
  // Selection modals
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);

  // Selection data
  const typeOptions = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags', 'Jewelry'];
  const categoryOptions = ["Men's Fashion", "Women's Fashion", "Unisex", "Kids' Fashion", "Vintage", "Streetwear", "Formal", "Casual"];
  const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size', 'Custom'];

  // Form data
  const [formData, setFormData] = useState({
    type: 'Bottoms',
    category: "Men's Fashion",
    listingTitle: '',
    description: '',
    brand: '',
    size: '',
    // MSL prices
    minePrice: '',
    stealPrice: '',
    lockPrice: '',
    // Bidding prices
    startingPrice: '',
    minimumBidIncrement: '',
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Helper function to show popup
  const showPopup = (title, message, type = 'info', showCancel = false, onConfirm = null, showButton = false) => {
    setPopup({
      visible: true,
      title,
      message,
      type,
      showCancel,
      onConfirm,
      showButton,
    });
  };

  const hidePopup = () => {
    setPopup(prev => ({ ...prev, visible: false }));
  };

  // Upload images to Cloudinary
  const uploadImages = async (images) => {
    try {
      const uploadedUrls = await uploadMultipleImages(images);
      return uploadedUrls;
    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      throw error;
    }
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event, time) => {
    setShowTimePicker(false);
    if (time) {
      setSelectedTime(time);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to make this work!',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const newPhoto = result.assets[0].uri;
        const newPhotos = [...selectedPhotos, newPhoto];
        setSelectedPhotos(newPhotos);
        setRenderKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showError('Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera permissions to make this work!',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedPhotos(prev => {
          const newPhotos = [...prev, result.assets[0].uri];
          return newPhotos;
        });
        setRenderKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showError('Failed to take photo. Please try again.');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const removePhoto = (index) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Form validation
  const validateForm = () => {
    if (!formData.listingTitle.trim()) {
      showPopup('', 'Please enter a listing title for your item.', 'warning');
      return false;
    }

    if (selectedPhotos.length === 0) {
      showPopup('', 'Add at least one photo to showcase your item!', 'warning');
      return false;
    }

    if (priceType === 'msl') {
      if (!formData.minePrice || !formData.stealPrice || !formData.lockPrice) {
        showPopup('', 'Complete all MSL prices - Mine, Steal, and Lock prices are required.', 'warning');
        return false;
      }
      
      const mine = parseFloat(formData.minePrice);
      const steal = parseFloat(formData.stealPrice);
      const lock = parseFloat(formData.lockPrice);
      
      if (mine >= steal || steal >= lock) {
        showPopup('', 'MSL prices must follow the pattern: Mine < Steal < Lock for fair bidding.', 'warning');
        return false;
      }
    } else {
      if (!formData.startingPrice || !formData.minimumBidIncrement) {
        showPopup('', 'Set your starting bid price and minimum bid increment for the auction.', 'warning');
        return false;
      }
    }

    // Check if end date/time is in the future
    const endDateTime = new Date(selectedDate);
    endDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    
    if (endDateTime <= new Date()) {
      showPopup('', 'Set an end date and time in the future so buyers have time to bid!', 'warning');
      return false;
    }

    return true;
  };

  // Submit listing
  const handleSubmit = async () => {
    if (!user) {
      showPopup('', 'You need to be logged in to post your thrift finds!', 'error');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setIsUploading(true);

    try {
      // Upload images to Cloudinary first
      setUploadProgress(0);
      const uploadedImageUrls = await uploadImages(selectedPhotos);
      setUploadProgress(100);
      setIsUploading(false);

      // Combine date and time
      const endDateTime = new Date(selectedDate);
      endDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes());

      // Prepare listing data
      const listingData = {
        // Basic info
        title: formData.listingTitle.trim(),
        description: formData.description.trim(),
        type: formData.type,
        category: formData.category,
        brand: formData.brand.trim(),
        size: formData.size,
        condition: condition,
        
        // Pricing
        priceType: priceType,
        ...(priceType === 'msl' ? {
          minePrice: parseFloat(formData.minePrice),
          stealPrice: parseFloat(formData.stealPrice),
          lockPrice: parseFloat(formData.lockPrice),
        } : {
          startingPrice: parseFloat(formData.startingPrice),
          minimumBidIncrement: parseFloat(formData.minimumBidIncrement),
          currentBid: parseFloat(formData.startingPrice),
        }),
        
        // Deal method
        dealMethod: dealMethod,
        
        // Timing
        endDateTime: endDateTime,
        
        // Images - now using uploaded URLs
        images: uploadedImageUrls,
        
        // User info
        sellerId: user.uid,
        sellerName: user.displayName || 'Anonymous',
        sellerEmail: user.email,
        
        // Status and timestamps
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        
        // Additional fields
        views: 0,
        likes: 0,
        bids: priceType === 'bidding' ? 1 : 0, // Starting bid counts as 1
      };

      // Add to Firestore
      const docRef = await addDoc(collection(db, 'listings'), listingData);
      
      // Show success popup with appropriate theme based on price type
      const successType = priceType === 'msl' ? 'steal' : 'bid';
      const successMessage = priceType === 'msl' 
        ? 'Your MSL listing is now live! Buyers can now Mine, Steal, or Lock your item.'
        : 'Your auction is now live! Bidders can start competing for your item.';
      
      showPopup(
        '', 
        successMessage,
        successType,
        false,
        () => {
          // Reset form
          setFormData({
            type: 'Bottoms',
            category: "Men's Fashion",
            listingTitle: '',
            description: '',
            brand: '',
            size: '',
            minePrice: '',
            stealPrice: '',
            lockPrice: '',
            startingPrice: '',
            minimumBidIncrement: '',
          });
          setSelectedPhotos([]);
          setCondition('new');
          setPriceType('msl');
          setDealMethod('delivery');
          setSelectedDate(new Date());
          setSelectedTime(new Date());
          
          // Navigate back
          navigation.goBack();
        },
        true // showButton = true
      );

    } catch (error) {
      console.error('Error posting listing:', error);
      setIsUploading(false);
      
      // Check if it's a Cloudinary upload error and offer fallback
      if (error.message.includes('Cloudinary') || error.message.includes('upload')) {
        showPopup(
          '', 
          'Image upload failed, but we can still save your listing with local image references. Other users may not see the images until this is fixed. Continue?',
          'warning',
          true,
          async () => {
            // Fallback: save with local URIs for now
            try {
              const endDateTime = new Date(selectedDate);
              endDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes());

              const listingData = {
                title: formData.listingTitle.trim(),
                description: formData.description.trim(),
                type: formData.type,
                category: formData.category,
                brand: formData.brand.trim(),
                size: formData.size,
                condition: condition,
                priceType: priceType,
                ...(priceType === 'msl' ? {
                  minePrice: parseFloat(formData.minePrice),
                  stealPrice: parseFloat(formData.stealPrice),
                  lockPrice: parseFloat(formData.lockPrice),
                } : {
                  startingPrice: parseFloat(formData.startingPrice),
                  minimumBidIncrement: parseFloat(formData.minimumBidIncrement),
                  currentBid: parseFloat(formData.startingPrice),
                }),
                dealMethod: dealMethod,
                endDateTime: endDateTime,
                images: selectedPhotos, // Use local URIs as fallback
                sellerId: user.uid,
                sellerName: user.displayName || 'Anonymous',
                sellerEmail: user.email,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                likes: 0,
                bids: priceType === 'bidding' ? 1 : 0,
              };

              await addDoc(collection(db, 'listings'), listingData);
              
              showPopup(
                '', 
                'Listing saved successfully! Note: Images may not be visible to other users due to upload issues.',
                'success',
                false,
                async () => {
                  // Send notification for new listing
                  try {
                    await notifyNewListing(formData.listingTitle, user.displayName || 'A seller');
                  } catch (error) {
                    console.error('Error sending notification:', error);
                  }

                  // Reset form and navigate back
                  setFormData({
                    type: 'Bottoms',
                    category: "Men's Fashion",
                    listingTitle: '',
                    description: '',
                    brand: '',
                    size: '',
                    minePrice: '',
                    stealPrice: '',
                    lockPrice: '',
                    startingPrice: '',
                    minimumBidIncrement: '',
                  });
                  setSelectedPhotos([]);
                  setCondition('new');
                  setPriceType('msl');
                  setDealMethod('delivery');
                  setSelectedDate(new Date());
                  setSelectedTime(new Date());
                  navigation.goBack();
                }
              );
            } catch (fallbackError) {
              console.error('Fallback save error:', fallbackError);
              showPopup('', 'Failed to save listing. Please try again later.', 'error');
            }
          }
        );
      } else {
        showPopup('', 'Oops! Something went wrong while posting your listing. Please try again.', 'error');
      }
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
          Post Listing
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Listing Details Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Listing Details
          </Text>

                    {/* Photo */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Photos</Text>
            <View key={renderKey} style={styles.photoContainer}>
              {selectedPhotos.map((photo, index) => (
                <View key={index} style={styles.photoSlot}>
                  <Image 
                    source={{ uri: photo }}
                    style={styles.photoImage}
                  />
                  <TouchableOpacity 
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity 
                style={styles.addPhotoButton}
                onPress={showImageOptions}
              >
                <Ionicons name="add" size={24} color="#83AFA7" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Type */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Type</Text>
            <TouchableOpacity 
              style={styles.dropdownInput}
              onPress={() => setShowTypeModal(true)}
            >
              <Text style={[styles.dropdownText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                {formData.type}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#83AFA7" />
            </TouchableOpacity>
          </View>

          {/* Category */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Category</Text>
            <TouchableOpacity 
              style={styles.dropdownInput}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={[styles.dropdownText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                {formData.category}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#83AFA7" />
            </TouchableOpacity>
          </View>

          {/* Listing Title */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Listing Title</Text>
            <TextInput
              style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
              placeholder="Name your listing"
              placeholderTextColor="#999"
              value={formData.listingTitle}
              onChangeText={(value) => handleInputChange('listingTitle', value)}
            />
          </View>
        </View>

        {/* About the Item Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            About the item
          </Text>

          {/* Condition */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Condition</Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.selectionButton,
                  condition === 'new' && styles.selectedButton
                ]}
                onPress={() => setCondition('new')}
              >
                <Text style={[
                  styles.selectionButtonText,
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                  condition === 'new' && styles.selectedButtonText
                ]}>
                  New
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.selectionButton,
                  condition === 'used' && styles.selectedButton
                ]}
                onPress={() => setCondition('used')}
              >
                <Text style={[
                  styles.selectionButtonText,
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                  condition === 'used' && styles.selectedButtonText
                ]}>
                  Used
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Price Type */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Price</Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.selectionButton,
                  priceType === 'msl' && styles.selectedButton
                ]}
                onPress={() => setPriceType('msl')}
              >
                <Text style={[
                  styles.selectionButtonText,
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                  priceType === 'msl' && styles.selectedButtonText
                ]}>
                  M-S-L
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.selectionButton,
                  priceType === 'bidding' && styles.selectedButton
                ]}
                onPress={() => setPriceType('bidding')}
              >
                <Text style={[
                  styles.selectionButtonText,
                  { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined },
                  priceType === 'bidding' && styles.selectedButtonText
                ]}>
                  Bidding
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Conditional Price Inputs */}
          {priceType === 'msl' ? (
            <View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Mine</Text>
                <TextInput
                  style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.minePrice}
                  onChangeText={(value) => handleInputChange('minePrice', value)}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Steal</Text>
                <TextInput
                  style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.stealPrice}
                  onChangeText={(value) => handleInputChange('stealPrice', value)}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Lock</Text>
                <TextInput
                  style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.lockPrice}
                  onChangeText={(value) => handleInputChange('lockPrice', value)}
                />
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Starting Price</Text>
                <TextInput
                  style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.startingPrice}
                  onChangeText={(value) => handleInputChange('startingPrice', value)}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Minimum Bid Increment</Text>
                <TextInput
                  style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.minimumBidIncrement}
                  onChangeText={(value) => handleInputChange('minimumBidIncrement', value)}
                />
              </View>
            </View>
          )}

          {/* Date and Time Picker - Available for both MSL and Bidding */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>End Date</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.dateTimeText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    {formatDate(selectedDate)}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#83AFA7" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>End Time</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={[styles.dateTimeText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    {formatTime(selectedTime)}
                  </Text>
                  <Ionicons name="time-outline" size={20} color="#83AFA7" />
                </TouchableOpacity>
              </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Description (Optional)
            </Text>
            <TextInput
              style={[styles.textArea, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
              placeholder="Describe your item and include details buyers would love, especially any unique story!"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
            />
          </View>
        </View>

        {/* Brand and Size */}
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Brand</Text>
            <TextInput
              style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
              placeholder="Enter brand"
              placeholderTextColor="#999"
              value={formData.brand}
              onChangeText={(value) => handleInputChange('brand', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Size</Text>
            <TouchableOpacity 
              style={styles.dropdownInput}
              onPress={() => setShowSizeModal(true)}
            >
              <Text style={[styles.dropdownText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                {formData.size || 'Choose'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#83AFA7" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Deal Method Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Deal Method
          </Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setDealMethod('meetup')}
            >
              <View style={styles.radioButton}>
                {dealMethod === 'meetup' && <View style={styles.radioSelected} />}
              </View>
              <Text style={[styles.radioText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Meet-Up
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setDealMethod('delivery')}
            >
              <View style={styles.radioButton}>
                {dealMethod === 'delivery' && <View style={styles.radioSelected} />}
              </View>
              <Text style={[styles.radioText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Delivery
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitButton, (isSubmitting || isUploading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || isUploading}
        >
          {isSubmitting || isUploading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="white" />
              <Text style={[styles.submitButtonText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, marginLeft: 8 }]}>
                Posting...
              </Text>
            </View>
          ) : (
          <Text style={[styles.submitButtonText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Post Listing
          </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}

      {/* Type Selection Modal */}
      <Modal
        visible={showTypeModal}
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'slide' : 'fade'}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Type</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionsList}>
              {typeOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.optionItem}
                  onPress={() => {
                    handleInputChange('type', option);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                    formData.type === option && styles.selectedOptionText
                  ]}>
                    {option}
                  </Text>
                  {formData.type === option && (
                    <Ionicons name="checkmark" size={20} color="#83AFA7" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'slide' : 'fade'}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionsList}>
              {categoryOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.optionItem}
                  onPress={() => {
                    handleInputChange('category', option);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                    formData.category === option && styles.selectedOptionText
                  ]}>,
                    {option}
                  </Text>
                  {formData.category === option && (
                    <Ionicons name="checkmark" size={20} color="#83AFA7" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Size Selection Modal */}
      <Modal
        visible={showSizeModal}
        transparent={true}
        animationType={Platform.OS === 'ios' ? 'slide' : 'fade'}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSizeModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Size</Text>
              <TouchableOpacity onPress={() => setShowSizeModal(false)}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionsList}>
              {sizeOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.optionItem}
                  onPress={() => {
                    handleInputChange('size', option);
                    setShowSizeModal(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                    formData.size === option && styles.selectedOptionText
                  ]}>
                    {option}
                  </Text>
                  {formData.size === option && (
                    <Ionicons name="checkmark" size={20} color="#83AFA7" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <StandardModal
        visible={popup.visible}
        onClose={hidePopup}
        title={popup.title}
        message={popup.message}
        confirmText="OK"
        onConfirm={popup.onConfirm || hidePopup}
        showCancel={false}
        confirmButtonStyle="success"
      />

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
    paddingVertical: 16,
  },
  closeButton: {
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#83AFA7',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
  },
  dropdownInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  selectionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  selectedButton: {
    borderColor: '#83AFA7',
    backgroundColor: '#F0F8F6',
  },
  selectionButtonText: {
    fontSize: 14,
    color: '#666',
  },
  selectedButtonText: {
    color: '#83AFA7',
  },
  photoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoSlot: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'visible',
    borderWidth: 2,
    borderColor: '#83AFA7',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 1000,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  dateTimeButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: {
    fontSize: 14,
    color: '#333',
  },
  radioGroup: {
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#83AFA7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#83AFA7',
  },
  radioText: {
    fontSize: 14,
    color: '#333',
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
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    ...(Platform.OS === 'android' && {
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#83AFA7',
    fontFamily: 'Poppins-Medium',
  },
  modalDoneText: {
    fontSize: 16,
    color: '#83AFA7',
    fontFamily: 'Poppins-SemiBold',
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    ...(Platform.OS === 'android' && {
      android_ripple: { color: '#F0F0F0' },
    }),
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    color: '#83AFA7',
    fontFamily: 'Poppins-Medium',
  },
});

export default PostListingScreen;
