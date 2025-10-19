import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView, Platform, Alert, Modal, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../utils/AuthContext';
import { createListing } from '../utils/listings';
import { pickImages, takePhoto } from '../utils/imageService';

SplashScreen.preventAutoHideAsync();

const COLORS = {
  background: '#E3EFE9',
  teal: '#50A8A8',
  orange: '#F28C4A',
  muted: '#8FA5A1',
  white: '#FFFFFF',
  error: '#FF6B6B',
};

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);



export default function NewListingScreen({ navigation }) {
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
  });
  
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  
  const [images, setImages] = useState([]);
  const [type, setType] = useState('Bottoms');
  const [category, setCategory] = useState("Men's Fashion");
  const [title, setTitle] = useState('');
  const [priceMode, setPriceMode] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [dealMethod, setDealMethod] = useState('');
  
  // Modal states for dropdowns
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);
  
  // Dropdown options
  const typeOptions = [
    'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags', 'Jewelry'
  ];
  
  const categoryOptions = [
    "Men's Fashion", "Women's Fashion", "Unisex", "Kids' Fashion", "Vintage", "Streetwear", "Formal", "Casual"
  ];
  
  const sizeOptions = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size', 'Custom'
  ];
  
  // MSL pricing state
  const [minePrice, setMinePrice] = useState('');
  const [stealPrice, setStealPrice] = useState('');
  const [lockPrice, setLockPrice] = useState('');
  
  // Bidding pricing state
  const [startingPrice, setStartingPrice] = useState('');
  const [minBidIncrement, setMinBidIncrement] = useState('');
  
  // Deadline state
  const [deadline, setDeadline] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Default: 24 hours from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);


  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  const getTimeRemaining = () => {
    const now = new Date();
    const timeDiff = deadline.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      return 'Expired';
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (images.length === 0) {
      errors.images = 'Please add at least one photo to your listing';
    }
    
    if (!title.trim()) {
      errors.title = 'Please enter a listing title';
    }
    
    if (!priceMode) {
      errors.priceMode = 'Please select a pricing mode (M-S-L or Bidding)';
    }
    
    if (!dealMethod) {
      errors.dealMethod = 'Please select a deal method';
    }
    
    // Validate pricing based on mode
    if (priceMode === 'MSL') {
      if (!minePrice || !stealPrice || !lockPrice) {
        errors.pricing = 'Please enter all three prices (Mine, Steal, Lock)';
      }
    } else if (priceMode === 'BID') {
      if (!startingPrice || !minBidIncrement) {
        errors.pricing = 'Please enter starting price and minimum bid increment';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearFormErrors = () => {
    setFormErrors({});
  };

  const handlePostListing = async () => {
    clearFormErrors();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Prepare listing data
      const listingData = {
        title: title.trim(),
        type,
        category,
        priceMode,
        description: description.trim(),
        brand: brand.trim(),
        size,
        dealMethod,
        deadline: deadline.toISOString(),
        images,
        status: 'active',
        // Add pricing data based on mode
        ...(priceMode === 'MSL' && {
          minePrice: parseFloat(minePrice),
          stealPrice: parseFloat(stealPrice),
          lockPrice: parseFloat(lockPrice)
        }),
        ...(priceMode === 'BID' && {
          startingPrice: parseFloat(startingPrice),
          minBidIncrement: parseFloat(minBidIncrement)
        })
      };
      
      console.log('📝 Creating listing with data:', listingData);
      
      // Save to Firestore
      const result = await createListing(listingData);
      
      if (result.success) {
        Alert.alert(
          'Listing Posted Successfully! 🎉',
          `Your listing "${title.trim()}" is now live and will be available until ${deadline.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true 
          })}`,
          [
            {
              text: 'View My Listings',
              onPress: () => {
                // TODO: Navigate to user's listings page
                navigation.goBack();
              }
            },
            {
              text: 'Create Another',
              onPress: () => {
                // Reset form for another listing
                resetForm();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error posting listing:', error);
      Alert.alert(
        'Error',
        `Failed to post listing: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    
    try {
      // Prepare draft data (no validation required)
      const draftData = {
        title: title.trim() || 'Untitled Draft',
        type,
        category,
        priceMode,
        description: description.trim(),
        brand: brand.trim(),
        size,
        dealMethod,
        deadline: deadline.toISOString(),
        images,
        status: 'draft',
        // Add pricing data based on mode (if available)
        ...(priceMode === 'MSL' && {
          minePrice: minePrice ? parseFloat(minePrice) : null,
          stealPrice: stealPrice ? parseFloat(stealPrice) : null,
          lockPrice: lockPrice ? parseFloat(lockPrice) : null
        }),
        ...(priceMode === 'BID' && {
          startingPrice: startingPrice ? parseFloat(startingPrice) : null,
          minBidIncrement: minBidIncrement ? parseFloat(minBidIncrement) : null
        })
      };
      
      console.log('📝 Saving draft with data:', draftData);
      
      // Save draft to Firestore
      const result = await createListing(draftData);
      
      if (result.success) {
        Alert.alert(
          'Draft Saved Successfully! 💾',
          'Your listing has been saved as a draft. You can continue editing it later.',
          [
            {
              text: 'Continue Editing',
              style: 'cancel'
            },
            {
              text: 'Go Back',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error saving draft:', error);
      Alert.alert(
        'Error',
        `Failed to save draft: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSavingDraft(false);
    }
  };

  const resetForm = () => {
    setImages([]);
    setType('Bottoms');
    setCategory("Men's Fashion");
    setTitle('');
    setPriceMode('');
    setDescription('');
    setBrand('');
    setSize('');
    setDealMethod('');
    setMinePrice('');
    setStealPrice('');
    setLockPrice('');
    setStartingPrice('');
    setMinBidIncrement('');
    setDeadline(new Date(Date.now() + 24 * 60 * 60 * 1000));
  };

  if (!fontsLoaded) return null;

  const pickImages = async () => {
    try {
      const selectedImages = await pickImages(4 - images.length);
      if (selectedImages.length > 0) {
        const newImageUris = selectedImages.map(img => img.uri);
        setImages((prev) => [...prev, ...newImageUris]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const photo = await takePhoto();
      if (photo && images.length < 4) {
        setImages((prev) => [...prev, photo.uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const showImageOptions = () => {
    if (images.length >= 4) {
      Alert.alert('Maximum Photos Reached', 'You can only add up to 4 photos per listing.');
      return;
    }

    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        {
          text: 'Camera',
          onPress: takePhotoWithCamera
        },
        {
          text: 'Photo Library',
          onPress: pickImages
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const removePhoto = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const getFormCompletionPercentage = () => {
    const requiredFields = [
      images.length > 0,
      title.trim(),
      priceMode,
      dealMethod,
      priceMode === 'MSL' ? (minePrice && stealPrice && lockPrice) : true,
      priceMode === 'BID' ? (startingPrice && minBidIncrement) : true
    ];
    
    const completedFields = requiredFields.filter(Boolean).length;
    return Math.round((completedFields / requiredFields.length) * 100);
  };

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="close" size={26} color={COLORS.teal} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Listing Details</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Listing Details</Text>
        
        {/* Form Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${getFormCompletionPercentage()}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {getFormCompletionPercentage()}% Complete
          </Text>
        </View>

        <Text style={styles.label}>Photo</Text>
        {formErrors.images && <Text style={styles.errorText}>{formErrors.images}</Text>}
        <View style={styles.photoRow}>
          {/* Show existing photos */}
          {images.map((imageUri, index) => (
            <View key={`photo-${index}`} style={styles.photoBoxContainer}>
              <Image source={{ uri: imageUri }} style={styles.photo} />
              <TouchableOpacity 
                style={styles.removePhotoButton}
                onPress={() => removePhoto(index)}
              >
                <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}
          
          {/* Show add photo button if under limit */}
          {images.length < 4 && (
            <TouchableOpacity style={styles.photoBox} onPress={showImageOptions}>
              <MaterialCommunityIcons name="plus" size={22} color={COLORS.muted} />
            </TouchableOpacity>
          )}
        </View>
        
        {images.length === 0 && (
          <Text style={styles.photoHint}>
            📸 Add at least one photo to make your listing more attractive
          </Text>
        )}

        <Text style={styles.label}>Type</Text>
        {Platform.OS === 'android' ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={type}
              onValueChange={(itemValue) => setType(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="Tops" value="Tops" />
              <Picker.Item label="Bottoms" value="Bottoms" />
              <Picker.Item label="Dresses" value="Dresses" />
              <Picker.Item label="Outerwear" value="Outerwear" />
              <Picker.Item label="Shoes" value="Shoes" />
              <Picker.Item label="Accessories" value="Accessories" />
              <Picker.Item label="Bags" value="Bags" />
              <Picker.Item label="Jewelry" value="Jewelry" />
            </Picker>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.selectBox} 
            onPress={() => setShowTypeModal(true)}
          >
            <Text style={styles.selectText}>{type}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Category</Text>
        {Platform.OS === 'android' ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={category}
              onValueChange={(itemValue) => setCategory(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="Men's Fashion" value="Men's Fashion" />
              <Picker.Item label="Women's Fashion" value="Women's Fashion" />
              <Picker.Item label="Unisex" value="Unisex" />
              <Picker.Item label="Kids' Fashion" value="Kids' Fashion" />
              <Picker.Item label="Vintage" value="Vintage" />
              <Picker.Item label="Streetwear" value="Streetwear" />
              <Picker.Item label="Formal" value="Formal" />
              <Picker.Item label="Casual" value="Casual" />
            </Picker>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.selectBox} 
            onPress={() => setShowCategoryModal(true)}
          >
            <Text style={styles.selectText}>{category}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Listing Title</Text>
        {formErrors.title && <Text style={styles.errorText}>{formErrors.title}</Text>}
        <TextInput 
          style={[styles.input, formErrors.title && styles.inputError]} 
          placeholder="Name your listing" 
          placeholderTextColor={COLORS.muted} 
          value={title} 
          onChangeText={(text) => {
            setTitle(text);
            if (formErrors.title) clearFormErrors();
          }}
        />

        <Text style={styles.sectionTitle}>About the item</Text>

        <Text style={styles.label}>Price</Text>
        {formErrors.priceMode && <Text style={styles.errorText}>{formErrors.priceMode}</Text>}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <Chip label="M-S-L" active={priceMode === 'MSL'} onPress={() => {
            setPriceMode('MSL');
            if (formErrors.priceMode) clearFormErrors();
          }} />
          <Chip label="Bidding" active={priceMode === 'BID'} onPress={() => {
            setPriceMode('BID');
            if (formErrors.priceMode) clearFormErrors();
          }} />
        </View>

        {/* Only show pricing inputs and timer when a price mode is selected */}
        {priceMode && (
          <>
            {/* MSL Pricing Inputs */}
            {priceMode === 'MSL' && (
              <>
                <Text style={styles.label}>Mine</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="PHP" 
                  placeholderTextColor={COLORS.muted} 
                  value={minePrice} 
                  onChangeText={setMinePrice}
                  keyboardType="numeric"
                />
                <Text style={styles.label}>Steal</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="PHP" 
                  placeholderTextColor={COLORS.muted} 
                  value={stealPrice} 
                  onChangeText={setStealPrice}
                  keyboardType="numeric"
                />
                <Text style={styles.label}>Lock</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="PHP" 
                  placeholderTextColor={COLORS.muted} 
                  value={lockPrice} 
                  onChangeText={setLockPrice}
                  keyboardType="numeric"
                />
              </>
            )}

            {/* Bidding Pricing Inputs */}
            {priceMode === 'BID' && (
              <>
                <Text style={styles.label}>Starting Price</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="PHP" 
                  placeholderTextColor={COLORS.muted} 
                  value={startingPrice} 
                  onChangeText={setStartingPrice}
                  keyboardType="numeric"
                />
                <Text style={styles.label}>Minimum Bid Increment</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="PHP" 
                  placeholderTextColor={COLORS.muted} 
                  value={minBidIncrement} 
                  onChangeText={setMinBidIncrement}
                  keyboardType="numeric"
                />
              </>
            )}


          </>
        )}

        {formErrors.pricing && <Text style={styles.errorText}>{formErrors.pricing}</Text>}

        <Text style={styles.label}>Deadline</Text>
        <Text style={styles.deadlineCountdown}>
          ⏰ Available for: {getTimeRemaining()}
        </Text>
        <View style={styles.deadlineContainer}>
          <TouchableOpacity 
            style={styles.deadlineButton} 
            onPress={() => setShowDatePicker(true)}
          >
            <MaterialCommunityIcons name="calendar" size={20} color={COLORS.teal} />
            <Text style={styles.deadlineText}>
              {deadline.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deadlineButton} 
            onPress={() => setShowTimePicker(true)}
          >
            <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.teal} />
            <Text style={styles.deadlineText}>
              {deadline.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={deadline}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                // Preserve the time when changing date
                const newDeadline = new Date(selectedDate);
                newDeadline.setHours(deadline.getHours());
                newDeadline.setMinutes(deadline.getMinutes());
                setDeadline(newDeadline);
              }
            }}
            minimumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={deadline}
            mode="time"
            display="default"
            onChange={(event, selectedDate) => {
              setShowTimePicker(false);
              if (selectedDate) {
                // Preserve the date when changing time
                const newDeadline = new Date(deadline);
                newDeadline.setHours(selectedDate.getHours());
                newDeadline.setMinutes(selectedDate.getMinutes());
                setDeadline(newDeadline);
              }
            }}
          />
        )}

        <Text style={styles.deadlineNote}>
          ⏰ This item will become unavailable after the deadline
        </Text>

        <Text style={styles.label}>Description (Optional)</Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
          placeholder="Describe your item..."
          placeholderTextColor={COLORS.muted}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Brand</Text>
        <TextInput style={styles.input} placeholder="Enter brand" placeholderTextColor={COLORS.muted} value={brand} onChangeText={setBrand} />

        <Text style={styles.label}>Size</Text>
        {Platform.OS === 'android' ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={size}
              onValueChange={(itemValue) => setSize(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="Choose Size" value="" />
              <Picker.Item label="XS" value="XS" />
              <Picker.Item label="S" value="S" />
              <Picker.Item label="M" value="M" />
              <Picker.Item label="L" value="L" />
              <Picker.Item label="XL" value="XL" />
              <Picker.Item label="XXL" value="XXL" />
              <Picker.Item label="XXXL" value="XXXL" />
              <Picker.Item label="One Size" value="One Size" />
              <Picker.Item label="Custom" value="Custom" />
            </Picker>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.selectBox} 
            onPress={() => setShowSizeModal(true)}
          >
            <Text style={styles.selectText}>{size || 'Choose'}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Deal Method</Text>
        {formErrors.dealMethod && <Text style={styles.errorText}>{formErrors.dealMethod}</Text>}
        <View style={styles.dealRow}>
          <TouchableOpacity 
            style={[styles.radio, dealMethod === 'Meet-Up' && styles.radioActive]} 
            onPress={() => {
              setDealMethod('Meet-Up');
              if (formErrors.dealMethod) clearFormErrors();
            }}
          >
            <View style={[styles.radioDot, dealMethod === 'Meet-Up' && styles.radioDotActive]} />
            <Text style={styles.radioLabel}>Meet-Up</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.radio, dealMethod === 'Delivery' && styles.radioActive]} 
            onPress={() => {
              setDealMethod('Delivery');
              if (formErrors.dealMethod) clearFormErrors();
            }}
          >
            <View style={[styles.radioDot, dealMethod === 'Delivery' && styles.radioDotActive]} />
            <Text style={styles.radioLabel}>Delivery</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.draftBtn, isSavingDraft && styles.buttonDisabled]} 
            onPress={handleSaveDraft}
            disabled={isSavingDraft}
          >
            {isSavingDraft ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.draftBtnText}>Save as Draft</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.saveBtn, isLoading && styles.buttonDisabled]} 
            onPress={handlePostListing}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveBtnText}>Post Listing</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Type Selection Modal */}
      <Modal
        visible={showTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Type</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.teal} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalOptions}>
              {typeOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.modalOption,
                    type === option && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setType(option);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    type === option && styles.modalOptionTextSelected
                  ]}>
                    {option}
                  </Text>
                  {type === option && (
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.orange} />
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
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.teal} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalOptions}>
              {categoryOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.modalOption,
                    category === option && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setCategory(option);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    category === option && styles.modalOptionTextSelected
                  ]}>
                    {option}
                  </Text>
                  {category === option && (
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.orange} />
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
        animationType="slide"
        onRequestClose={() => setShowSizeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Size</Text>
              <TouchableOpacity onPress={() => setShowSizeModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.teal} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalOptions}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  !size && styles.modalOptionSelected
                ]}
                onPress={() => {
                  setSize('');
                  setShowSizeModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  !size && styles.modalOptionTextSelected
                ]}>
                  Choose Size
                </Text>
                {!size && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.orange} />
                )}
              </TouchableOpacity>
              {sizeOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.modalOption,
                    size === option && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setSize(option);
                    setShowSizeModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    size === option && styles.modalOptionTextSelected
                  ]}>
                    {option}
                  </Text>
                  {size === option && (
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.orange} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { paddingTop: Platform.OS === 'ios' ? 48 : 24, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarTitle: { fontFamily: 'Poppins-Bold', color: COLORS.teal, fontSize: 16 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },

  sectionTitle: { fontFamily: 'Poppins-Bold', color: COLORS.teal, fontSize: 16, marginTop: 8, marginBottom: 8 },
  label: { fontFamily: 'Poppins-Regular', color: COLORS.teal, opacity: 0.8, marginBottom: 6 },

  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  photoBox: { width: 86, height: 86, backgroundColor: COLORS.white, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoBoxContainer: { width: 86, height: 86, position: 'relative' },
  photo: { width: '100%', height: '100%', borderRadius: 12 },
  removePhotoButton: { 
    position: 'absolute', 
    top: -8, 
    right: -8, 
    backgroundColor: COLORS.white, 
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  photoHint: {
    fontFamily: 'Poppins-Regular',
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    fontStyle: 'italic',
  },

  selectBox: { height: 44, backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  selectText: { fontFamily: 'Poppins-Regular', color: COLORS.teal },

  input: { height: 48, backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, fontFamily: 'Poppins-Regular', color: COLORS.teal },
  inputError: { borderColor: COLORS.error, borderWidth: 1 },

  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.orange + '33' },
  chipText: { fontFamily: 'Poppins-Regular', color: COLORS.teal },
  chipTextActive: { fontFamily: 'Poppins-Bold', color: COLORS.orange },

  dealRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioActive: {},
  radioDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.teal, alignItems: 'center', justifyContent: 'center' },
  radioDotActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  radioLabel: { fontFamily: 'Poppins-Regular', color: COLORS.teal },

  saveBtn: { height: 50, borderRadius: 25, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6, marginTop: 8, marginBottom: 32 },
  saveBtnText: { color: COLORS.white, fontFamily: 'Poppins-Bold', fontSize: 16 },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 32,
    gap: 12,
  },
  draftBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  draftBtnText: {
    color: COLORS.white,
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },

  // Picker styles (for Android)
  pickerContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.muted,
  },
  picker: {
    height: 48,
    color: COLORS.teal,
  },
  pickerItem: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
  },
  
  // Modal styles (for iOS)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  modalTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: COLORS.teal,
  },
  modalOptions: {
    paddingHorizontal: 20,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  modalOptionSelected: {
    backgroundColor: COLORS.orange + '15',
  },
  modalOptionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.teal,
  },
  modalOptionTextSelected: {
    fontFamily: 'Poppins-Bold',
    color: COLORS.orange,
  },

  deadlineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  deadlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.muted,
  },
  deadlineText: {
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    fontSize: 14,
  },
  deadlineCountdown: {
    fontFamily: 'Poppins-Regular',
    color: COLORS.orange,
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  deadlineNote: {
    fontFamily: 'Poppins-Regular',
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
    textAlign: 'center',
  },

  progressContainer: {
    marginBottom: 16,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.muted,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.orange,
    borderRadius: 4,
  },
  progressText: {
    fontFamily: 'Poppins-Regular',
    color: COLORS.teal,
    fontSize: 12,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },

});