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

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
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
    
    // Mark field as touched
    setTouchedFields(prev => ({
      ...prev,
      [field]: true
    }));
    
    // Validate field in real-time
    validateField(field, value);
  };

  // Real-time validation function
  const validateField = (field, value) => {
    let error = '';
    
    switch (field) {
      case 'listingTitle':
        if (!value || value.trim().length === 0) {
          error = 'Listing title is required';
        } else if (value.trim().length < 3) {
          error = 'Title must be at least 3 characters';
        }
        break;
        
      case 'minePrice':
        if (priceType === 'msl') {
          if (!value || value.trim().length === 0) {
            error = 'Mine price is required';
          } else if (isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
            error = 'Mine price must be a valid positive number';
          } else {
            // Check MSL price order
            const mine = parseFloat(value);
            const steal = parseFloat(formData.stealPrice);
            const lock = parseFloat(formData.lockPrice);
            
            if (steal && mine >= steal) {
              error = 'Mine must be less than Steal';
            }
            if (lock && mine >= lock) {
              error = 'Mine must be less than Lock';
            }
          }
        }
        break;
        
      case 'stealPrice':
        if (priceType === 'msl') {
          if (!value || value.trim().length === 0) {
            error = 'Steal price is required';
          } else if (isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
            error = 'Steal price must be a valid positive number';
          } else {
            // Check MSL price order
            const mine = parseFloat(formData.minePrice);
            const steal = parseFloat(value);
            const lock = parseFloat(formData.lockPrice);
            
            if (mine && mine >= steal) {
              error = 'Steal must be greater than Mine';
            }
            if (lock && steal >= lock) {
              error = 'Steal must be less than Lock';
            }
          }
        }
        break;
        
      case 'lockPrice':
        if (priceType === 'msl') {
          if (!value || value.trim().length === 0) {
            error = 'Lock price is required';
          } else if (isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
            error = 'Lock price must be a valid positive number';
          } else {
            // Check MSL price order
            const mine = parseFloat(formData.minePrice);
            const steal = parseFloat(formData.stealPrice);
            const lock = parseFloat(value);
            
            if (mine && mine >= lock) {
              error = 'Lock must be greater than Mine';
            }
            if (steal && steal >= lock) {
              error = 'Lock must be greater than Steal';
            }
          }
        }
        break;
        
      case 'startingPrice':
        if (priceType === 'bidding') {
          if (!value || value.trim().length === 0) {
            error = 'Starting price is required';
          } else if (isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
            error = 'Starting price must be a valid positive number';
          }
        }
        break;
        
      case 'minimumBidIncrement':
        if (priceType === 'bidding') {
          if (!value || value.trim().length === 0) {
            error = 'Minimum bid increment is required';
          } else if (isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
            error = 'Minimum bid increment must be a valid positive number';
          }
        }
        break;
        
      case 'brand':
        if (value && value.trim().length > 0 && value.trim().length < 2) {
          error = 'Brand must be at least 2 characters';
        }
        break;
        
      case 'description':
        if (value && value.trim().length > 0 && value.trim().length < 10) {
          error = 'Description must be at least 10 characters';
        }
        break;
        
      case 'photos':
        if (!value || value.length === 0) {
          error = 'At least one photo is required';
        }
        break;
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  // Validate all fields
  const validateAllFields = () => {
    const errors = {};
    
    // Validate listing title
    if (!formData.listingTitle || formData.listingTitle.trim().length === 0) {
      errors.listingTitle = 'Listing title is required';
    } else if (formData.listingTitle.trim().length < 3) {
      errors.listingTitle = 'Title must be at least 3 characters';
    }
    
    // Validate prices based on type
    if (priceType === 'msl') {
      if (!formData.minePrice || formData.minePrice.trim().length === 0) {
        errors.minePrice = 'Mine price is required';
      } else if (isNaN(parseFloat(formData.minePrice)) || parseFloat(formData.minePrice) <= 0) {
        errors.minePrice = 'Mine price must be a valid positive number';
      }
      
      if (!formData.stealPrice || formData.stealPrice.trim().length === 0) {
        errors.stealPrice = 'Steal price is required';
      } else if (isNaN(parseFloat(formData.stealPrice)) || parseFloat(formData.stealPrice) <= 0) {
        errors.stealPrice = 'Steal price must be a valid positive number';
      }
      
      if (!formData.lockPrice || formData.lockPrice.trim().length === 0) {
        errors.lockPrice = 'Lock price is required';
      } else if (isNaN(parseFloat(formData.lockPrice)) || parseFloat(formData.lockPrice) <= 0) {
        errors.lockPrice = 'Lock price must be a valid positive number';
      }
      
      // Check MSL price order
      const mine = parseFloat(formData.minePrice);
      const steal = parseFloat(formData.stealPrice);
      const lock = parseFloat(formData.lockPrice);
      
      if (mine && steal && mine >= steal) {
        errors.stealPrice = 'Steal must be greater than Mine';
      }
      if (steal && lock && steal >= lock) {
        errors.lockPrice = 'Lock must be greater than Steal';
      }
    } else {
      if (!formData.startingPrice || formData.startingPrice.trim().length === 0) {
        errors.startingPrice = 'Starting price is required';
      } else if (isNaN(parseFloat(formData.startingPrice)) || parseFloat(formData.startingPrice) <= 0) {
        errors.startingPrice = 'Starting price must be a valid positive number';
      }
      
      if (!formData.minimumBidIncrement || formData.minimumBidIncrement.trim().length === 0) {
        errors.minimumBidIncrement = 'Minimum bid increment is required';
      } else if (isNaN(parseFloat(formData.minimumBidIncrement)) || parseFloat(formData.minimumBidIncrement) <= 0) {
        errors.minimumBidIncrement = 'Minimum bid increment must be a valid positive number';
      }
    }
    
    // Validate photos
    if (selectedPhotos.length === 0) {
      errors.photos = 'At least one photo is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Helper function to render error message
  const renderErrorMessage = (field) => {
    if (touchedFields[field] && validationErrors[field]) {
      return (
        <Text style={[styles.errorText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
          {validationErrors[field]}
        </Text>
      );
    }
    return null;
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
        
        // Mark photos field as touched and validate
        setTouchedFields(prev => ({ ...prev, photos: true }));
        validateField('photos', newPhotos);
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
          // Mark photos field as touched and validate
          setTouchedFields(prev => ({ ...prev, photos: true }));
          validateField('photos', newPhotos);
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
    setSelectedPhotos(prev => {
      const newPhotos = prev.filter((_, i) => i !== index);
      // Mark photos field as touched and validate
      setTouchedFields(prev => ({ ...prev, photos: true }));
      validateField('photos', newPhotos);
      return newPhotos;
    });
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

  // Form validation (now uses real-time validation)
  const validateForm = () => {
    // Mark all fields as touched to show all errors
    const allFields = ['listingTitle', 'minePrice', 'stealPrice', 'lockPrice', 'startingPrice', 'minimumBidIncrement', 'brand', 'description'];
    const touchedAll = {};
    allFields.forEach(field => {
      touchedAll[field] = true;
    });
    setTouchedFields(touchedAll);
    
    // Validate all fields
    const isValid = validateAllFields();

    // Check if end date/time is in the future
    const endDateTime = new Date(selectedDate);
    endDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    
    if (endDateTime <= new Date()) {
      showPopup('', 'Set an end date and time in the future so buyers have time to bid!', 'warning');
      return false;
    }

    return isValid;
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
            {touchedFields.photos && validationErrors.photos && (
              <Text style={[styles.errorText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                {validationErrors.photos}
              </Text>
            )}
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

          {/* Type and Category */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Type & Category</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Type</Text>
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
              <View style={styles.priceField}>
                <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Category</Text>
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
            </View>
          </View>

          {/* Listing Title */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Listing Title</Text>
            <TextInput
              style={[
                styles.textInput, 
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                touchedFields.listingTitle && validationErrors.listingTitle && styles.errorInput
              ]}
              placeholder="Name your listing"
              placeholderTextColor="#999"
              value={formData.listingTitle}
              onChangeText={(value) => handleInputChange('listingTitle', value)}
            />
            {renderErrorMessage('listingTitle')}
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
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>MSL Prices</Text>
                <View style={styles.priceRow}>
                  <View style={styles.priceField}>
                    <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Mine</Text>
                <TextInput
                      style={[
                        styles.priceTextInput, 
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                        touchedFields.minePrice && validationErrors.minePrice && styles.errorInput
                      ]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.minePrice}
                  onChangeText={(value) => handleInputChange('minePrice', value)}
                />
                    {renderErrorMessage('minePrice')}
              </View>
                  <View style={styles.priceField}>
                    <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Steal</Text>
                <TextInput
                      style={[
                        styles.priceTextInput, 
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                        touchedFields.stealPrice && validationErrors.stealPrice && styles.errorInput
                      ]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.stealPrice}
                  onChangeText={(value) => handleInputChange('stealPrice', value)}
                />
                    {renderErrorMessage('stealPrice')}
              </View>
                  <View style={styles.priceField}>
                    <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Lock</Text>
                <TextInput
                      style={[
                        styles.priceTextInput, 
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                        touchedFields.lockPrice && validationErrors.lockPrice && styles.errorInput
                      ]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.lockPrice}
                  onChangeText={(value) => handleInputChange('lockPrice', value)}
                />
                    {renderErrorMessage('lockPrice')}
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Bidding Prices</Text>
                <View style={styles.priceRow}>
                  <View style={styles.priceField}>
                    <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Starting Price</Text>
                <TextInput
                      style={[
                        styles.priceTextInput, 
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                        touchedFields.startingPrice && validationErrors.startingPrice && styles.errorInput
                      ]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.startingPrice}
                  onChangeText={(value) => handleInputChange('startingPrice', value)}
                />
                    {renderErrorMessage('startingPrice')}
              </View>
                  <View style={styles.priceField}>
                    <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Min. Increment</Text>
                <TextInput
                      style={[
                        styles.priceTextInput, 
                        { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                        touchedFields.minimumBidIncrement && validationErrors.minimumBidIncrement && styles.errorInput
                      ]}
                  placeholder="PHP"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.minimumBidIncrement}
                  onChangeText={(value) => handleInputChange('minimumBidIncrement', value)}
                />
                    {renderErrorMessage('minimumBidIncrement')}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Date and Time Picker - Available for both MSL and Bidding */}
              <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>End Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <Text style={[styles.dateTimeLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Date</Text>
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
              <View style={styles.dateTimeField}>
                <Text style={[styles.dateTimeLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Time</Text>
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
            </View>
              </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              Description (Optional)
            </Text>
            <TextInput
              style={[
                styles.textArea, 
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                touchedFields.description && validationErrors.description && styles.errorInput
              ]}
              placeholder="Describe your item and include details buyers would love, especially any unique story!"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
            />
            {renderErrorMessage('description')}
          </View>
        </View>

        {/* Brand and Size */}
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Brand & Size</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Brand</Text>
            <TextInput
                  style={[
                    styles.textInput, 
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                    touchedFields.brand && validationErrors.brand && styles.errorInput
                  ]}
              placeholder="Enter brand"
              placeholderTextColor="#999"
              value={formData.brand}
              onChangeText={(value) => handleInputChange('brand', value)}
            />
                {renderErrorMessage('brand')}
          </View>
              <View style={styles.priceField}>
                <Text style={[styles.priceLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Size</Text>
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
    paddingVertical: Platform.OS === 'android' ? 12 : 16,
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
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: Platform.OS === 'android' ? 16 : 20,
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
  },
  dropdownInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: Platform.OS === 'android' ? 13 : 14,
    color: '#333',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  selectionButton: {
    flex: 1,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    paddingHorizontal: Platform.OS === 'android' ? 12 : 16,
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
    fontSize: Platform.OS === 'android' ? 12 : 14,
    color: '#666',
  },
  selectedButtonText: {
    color: '#83AFA7',
  },
  photoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.OS === 'android' ? 8 : 12,
  },
  photoSlot: {
    width: Platform.OS === 'android' ? 70 : 80,
    height: Platform.OS === 'android' ? 70 : 80,
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
    width: Platform.OS === 'android' ? 70 : 80,
    height: Platform.OS === 'android' ? 70 : 80,
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
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: {
    fontSize: Platform.OS === 'android' ? 13 : 14,
    color: '#333',
  },
  radioGroup: {
    gap: Platform.OS === 'android' ? 12 : 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: Platform.OS === 'android' ? 18 : 20,
    height: Platform.OS === 'android' ? 18 : 20,
    borderRadius: Platform.OS === 'android' ? 9 : 10,
    borderWidth: 2,
    borderColor: '#83AFA7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Platform.OS === 'android' ? 10 : 12,
  },
  radioSelected: {
    width: Platform.OS === 'android' ? 8 : 10,
    height: Platform.OS === 'android' ? 8 : 10,
    borderRadius: Platform.OS === 'android' ? 4 : 5,
    backgroundColor: '#83AFA7',
  },
  radioText: {
    fontSize: Platform.OS === 'android' ? 13 : 14,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#83AFA7',
    borderRadius: 25,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 20 : 24,
    marginBottom: Platform.OS === 'android' ? 32 : 40,
  },
  submitButtonText: {
    fontSize: Platform.OS === 'android' ? 13 : 14,
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
    paddingVertical: Platform.OS === 'android' ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: Platform.OS === 'android' ? 16 : 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
  },
  modalCancelText: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#83AFA7',
    fontFamily: 'Poppins-Medium',
  },
  modalDoneText: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
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
    paddingVertical: Platform.OS === 'android' ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    ...(Platform.OS === 'android' && {
      android_ripple: { color: '#F0F0F0' },
    }),
  },
  optionText: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#333',
  },
  selectedOptionText: {
    color: '#83AFA7',
    fontFamily: 'Poppins-Medium',
  },
  // Price row styles
  priceRow: {
    flexDirection: 'row',
    gap: Platform.OS === 'android' ? 8 : 12,
  },
  priceField: {
    flex: 1,
    minWidth: 0, // Prevents flex items from growing beyond container
  },
  priceLabel: {
    fontSize: Platform.OS === 'android' ? 11 : 12,
    color: '#666',
    marginBottom: Platform.OS === 'android' ? 4 : 6,
    textAlign: 'center', // Center align labels for consistency
  },
  priceTextInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    fontSize: Platform.OS === 'android' ? 13 : 14,
    color: '#333',
    width: '100%', // Ensure full width
    textAlign: 'center', // Center align text for consistency
  },
  // Date time row styles
  dateTimeRow: {
    flexDirection: 'row',
    gap: Platform.OS === 'android' ? 8 : 12,
  },
  dateTimeField: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: Platform.OS === 'android' ? 11 : 12,
    color: '#666',
    marginBottom: Platform.OS === 'android' ? 4 : 6,
  },
  // Error text style
  errorText: {
    fontSize: Platform.OS === 'android' ? 11 : 12,
    color: '#F44336',
    marginTop: Platform.OS === 'android' ? 2 : 4,
    marginLeft: 4,
  },
  // Error input style
  errorInput: {
    borderColor: '#F44336',
    borderWidth: 1,
  },
});

export default PostListingScreen;
