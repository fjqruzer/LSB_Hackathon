import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { doc, getDoc, updateDoc, addDoc, collection, deleteDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
const PSGCService = require('../services/PSGCService');
import AddressDropdown from '../components/AddressDropdown';

const MyAddressScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  
  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);
  
  // State
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    region: '',
    barangay: '',
    postalCode: '',
    isDefault: false,
  });

  // PSGC API states
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Load addresses
  useEffect(() => {
    if (!user) return;

    const addressesRef = collection(db, 'addresses');
    const userAddressesQuery = query(
      addressesRef,
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(userAddressesQuery, (snapshot) => {
      const addressesList = [];
      snapshot.forEach((doc) => {
        addressesList.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort by createdAt in JavaScript instead of Firestore
      addressesList.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bTime - aTime;
      });
      
      setAddresses(addressesList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Load regions on component mount
  useEffect(() => {
    loadRegions();
  }, []);

  // Load regions from PSGC API
  const loadRegions = async () => {
    try {
      setLoadingRegions(true);
      const regionsData = await PSGCService.getRegions();
      console.log('🌍 Loaded regions:', regionsData);
      setRegions(regionsData);
    } catch (error) {
      console.error('❌ Error loading regions:', error);
      Alert.alert('Error', 'Failed to load regions. Please try again.');
    } finally {
      setLoadingRegions(false);
    }
  };

  // Load provinces when region is selected
  const loadProvinces = async (regionCode) => {
    try {
      console.log('🏛️ Loading provinces for region code:', regionCode);
      setLoadingProvinces(true);
      setProvinces([]);
      setCities([]);
      setBarangays([]);
      setFormData(prev => ({ ...prev, province: '', city: '', barangay: '' }));
      
      const provincesData = await PSGCService.getProvinces(regionCode);
      console.log('🏛️ Received provinces data:', provincesData);
      setProvinces(provincesData);
    } catch (error) {
      console.error('❌ Error loading provinces:', error);
      Alert.alert('Error', 'Failed to load provinces. Please try again.');
    } finally {
      setLoadingProvinces(false);
    }
  };

  // Load cities when province is selected
  const loadCities = async (provinceCode) => {
    try {
      setLoadingCities(true);
      setCities([]);
      setBarangays([]);
      setFormData(prev => ({ ...prev, city: '', barangay: '' }));
      
      const citiesData = await PSGCService.getCities(provinceCode);
      setCities(citiesData);
    } catch (error) {
      console.error('Error loading cities:', error);
      Alert.alert('Error', 'Failed to load cities. Please try again.');
    } finally {
      setLoadingCities(false);
    }
  };

  // Load barangays when city is selected
  const loadBarangays = async (cityCode) => {
    try {
      setLoadingBarangays(true);
      setBarangays([]);
      setFormData(prev => ({ ...prev, barangay: '' }));
      
      const barangaysData = await PSGCService.getBarangays(cityCode);
      setBarangays(barangaysData);
    } catch (error) {
      console.error('Error loading barangays:', error);
      Alert.alert('Error', 'Failed to load barangays. Please try again.');
    } finally {
      setLoadingBarangays(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    console.log(`🔄 handleInputChange: field=${field}, value=${value}`);
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      console.log(`🔄 New formData after ${field} change:`, newData);
      return newData;
    });

    // Handle PSGC cascading selections
    if (field === 'region' && value) {
      console.log(`🔄 Loading provinces for region: ${value}`);
      loadProvinces(value);
    } else if (field === 'province' && value) {
      // Check if this is NCR with direct cities (skip city step)
      if ((value === 'NCR' || value === '130000000' || value === 'National Capital Region') && provinces.length > 0 && provinces[0].type === 'City') {
        // For NCR with direct cities, load barangays directly
        console.log(`🔄 Loading barangays directly for NCR: ${value}`);
        loadBarangays(value);
      } else {
        // Normal flow: load cities
        console.log(`🔄 Loading cities for province: ${value}`);
        loadCities(value);
      }
    } else if (field === 'city' && value) {
      console.log(`🔄 Loading barangays for city: ${value}`);
      loadBarangays(value);
    }
  };

  // Handle PSGC dropdown selections
  const handleRegionSelect = (region) => {
    console.log('🌍 Region selected:', region);
    console.log('🌍 Region code being set:', region.code);
    console.log('🌍 Current formData.region before change:', formData.region);
    handleInputChange('region', region.code);
  };

  const handleProvinceSelect = (province) => {
    console.log('🏛️ Province selected:', province);
    console.log('🏛️ Province code being set:', province.code);
    console.log('🏛️ Province name:', province.name);
    handleInputChange('province', province.code);
  };

  const handleCitySelect = (city) => {
    console.log('🏙️ City selected:', city);
    console.log('🏙️ City code being set:', city.code);
    console.log('🏙️ City name:', city.name);
    handleInputChange('city', city.code);
  };

  const handleBarangaySelect = (barangay) => {
    console.log('🏘️ Barangay selected:', barangay);
    console.log('🏘️ Barangay code being set:', barangay.code);
    console.log('🏘️ Barangay name:', barangay.name);
    handleInputChange('barangay', barangay.code);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      city: '',
      province: '',
      region: '',
      barangay: '',
      postalCode: '',
      isDefault: false,
    });
    setEditingAddress(null);
    // Reset PSGC dropdowns
    setProvinces([]);
    setCities([]);
    setBarangays([]);
  };

  // Handle add/edit address
  const handleSaveAddress = async () => {
    // Check if it's NCR with direct cities (skip city validation)
    const isNCRWithDirectCities = (formData.region === 'NCR' || formData.region === '130000000') && 
                                 provinces.length > 0 && provinces[0].type === 'City';
    
    if (!formData.name.trim() || !formData.phone.trim() || !formData.address.trim() || 
        !formData.region || !formData.province || 
        (!isNCRWithDirectCities && !formData.city) || !formData.barangay || !formData.postalCode.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      // Get display names for the selected codes
      const regionName = regions.find(r => r.code === formData.region)?.name || formData.region;
      const provinceName = provinces.find(p => p.code === formData.province)?.name || formData.province;
      const cityName = cities.find(c => c.code === formData.city)?.name || formData.city;
      const barangayName = barangays.find(b => b.code === formData.barangay)?.name || formData.barangay;

      const addressData = {
        ...formData,
        // Store both codes and names for display
        regionName,
        provinceName,
        cityName,
        barangayName,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // If setting as default, first remove default from all other addresses
      if (formData.isDefault) {
        console.log('🔄 Setting address as default, removing default from others');
        const updatePromises = addresses.map(async (addr) => {
          if (editingAddress && addr.id === editingAddress.id) {
            // Skip the address being edited
            return Promise.resolve();
          }
          console.log('🔄 Removing default from address:', addr.id);
          return updateDoc(doc(db, 'addresses', addr.id), { isDefault: false });
        });
        
        await Promise.all(updatePromises);
        console.log('✅ Removed default from all other addresses');
      }

      if (editingAddress) {
        // Update existing address
        await updateDoc(doc(db, 'addresses', editingAddress.id), {
          ...addressData,
          updatedAt: new Date(),
        });
        Alert.alert('Success', 'Address updated successfully');
      } else {
        // Add new address
        await addDoc(collection(db, 'addresses'), addressData);
        Alert.alert('Success', 'Address added successfully');
      }

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address. Please try again.');
    }
  };

  // Handle edit address
  const handleEditAddress = (address) => {
    setFormData({
      name: address.name || '',
      phone: address.phone || '',
      address: address.address || '',
      region: address.region || '',
      province: address.province || '',
      city: address.city || '',
      barangay: address.barangay || '',
      postalCode: address.postalCode || '',
      isDefault: address.isDefault || false,
    });
    setEditingAddress(address);
    setShowAddModal(true);
  };

  // Handle delete address
  const handleDeleteAddress = async () => {
    if (!addressToDelete) return;

    try {
      await deleteDoc(doc(db, 'addresses', addressToDelete.id));
      Alert.alert('Success', 'Address deleted successfully');
      setShowDeleteModal(false);
      setAddressToDelete(null);
    } catch (error) {
      console.error('Error deleting address:', error);
      Alert.alert('Error', 'Failed to delete address. Please try again.');
    }
  };

  // Handle set as default
  const handleSetDefault = async (addressId) => {
    try {
      console.log('🔄 Setting default address:', addressId);
      
      // First, remove default from all addresses
      const updatePromises = addresses.map(async (addr) => {
        if (addr.id !== addressId) {
          console.log('🔄 Removing default from address:', addr.id);
          return updateDoc(doc(db, 'addresses', addr.id), { isDefault: false });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
      console.log('✅ Removed default from all other addresses');

      // Then set the selected address as default
      console.log('🔄 Setting new default address:', addressId);
      await updateDoc(doc(db, 'addresses', addressId), { isDefault: true });
      console.log('✅ Set new default address');
      
      Alert.alert('Success', 'Default address updated');
    } catch (error) {
      console.error('❌ Error setting default address:', error);
      Alert.alert('Error', 'Failed to update default address');
    }
  };

  // Get display name for PSGC code
  const getDisplayName = (code, list) => {
    const item = list.find(item => item.code === code);
    return item ? item.name : code;
  };

  // Format address for display
  const formatAddress = (address) => {
    const parts = [address.address];
    
    // Use stored names if available, otherwise fallback to codes
    if (address.barangayName || address.barangay) {
      parts.push(address.barangayName || address.barangay);
    }
    if (address.cityName || address.city) {
      parts.push(address.cityName || address.city);
    }
    if (address.provinceName || address.province) {
      parts.push(address.provinceName || address.province);
    }
    if (address.postalCode) {
      parts.push(address.postalCode);
    }
    
    return parts.join(', ');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            My Address
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading addresses...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: colors.primary }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
          My Address
        </Text>
        <TouchableOpacity 
          onPress={() => {
            resetForm();
            setShowAddModal(true);
          }}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color="#83AFA7" />
            <Text style={[styles.emptyText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
              No addresses yet
            </Text>
            <Text style={[styles.emptySubtext, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              Add your first address to get started
            </Text>
          </View>
        ) : (
          <View style={styles.addressesList}>
            {addresses.map((address, index) => (
              <View key={address.id} style={styles.addressCard}>
                <View style={styles.addressHeader}>
                  <View style={styles.addressLeft}>
                    <View style={styles.addressIcon}>
                      <Ionicons name="location-outline" size={20} color="#83AFA7" />
                    </View>
                    <View style={styles.addressInfo}>
                      <View style={styles.addressTitleRow}>
                        <Text style={[styles.addressName, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                          {address.name}
                        </Text>
                        {address.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={[styles.defaultText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                              Default
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.addressSubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {address.phone}
                      </Text>
                      <Text style={[styles.addressSubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {formatAddress(address)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.addressActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleEditAddress(address)}
                  >
                    <Ionicons name="create-outline" size={20} color="#83AFA7" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => {
                      setAddressToDelete(address);
                      setShowDeleteModal(true);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>

                {!address.isDefault && (
                  <TouchableOpacity 
                    style={styles.setDefaultButton}
                    onPress={() => handleSetDefault(address.id)}
                  >
                    <Text style={[styles.setDefaultText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      Set as Default
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Address Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModal}>
            <View style={[styles.modalHeader, { borderBottomColor: '#E0E0E0' }]}>
              <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowAddModal(false)}
              >
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Full Name *
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(value) => handleInputChange('name', value)}
                  placeholder="Enter full name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Phone Number *
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(value) => handleInputChange('phone', value)}
                  placeholder="Enter phone number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Street Address *
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.address}
                  onChangeText={(value) => handleInputChange('address', value)}
                  placeholder="Enter street address, building, house number"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Region Dropdown */}
              <AddressDropdown
                label="Region"
                placeholder="Select Region"
                value={formData.region}
                options={regions}
                onSelect={handleRegionSelect}
                loading={loadingRegions}
                required={true}
              />

              {/* Province/District/City Dropdown */}
              <AddressDropdown
                label={
                  formData.region === 'NCR' || formData.region === '130000000' 
                    ? (provinces.length > 0 && provinces[0].type === 'City' ? "City" : "District")
                    : "Province"
                }
                placeholder={
                  formData.region === 'NCR' || formData.region === '130000000' 
                    ? (provinces.length > 0 && provinces[0].type === 'City' ? "Select City" : "Select District")
                    : "Select Province"
                }
                value={formData.province}
                options={provinces}
                onSelect={handleProvinceSelect}
                loading={loadingProvinces}
                disabled={!formData.region}
                required={true}
              />

              {/* City/Municipality Dropdown - Only show if not NCR with direct cities */}
              {!(formData.region === 'NCR' || formData.region === '130000000') || 
               (provinces.length > 0 && provinces[0].type !== 'City') ? (
                <AddressDropdown
                  label="City/Municipality"
                  placeholder="Select City/Municipality"
                  value={formData.city}
                  options={cities}
                  onSelect={handleCitySelect}
                  loading={loadingCities}
                  disabled={!formData.province}
                  required={true}
                />
              ) : null}

              {/* Barangay Dropdown */}
              <AddressDropdown
                label="Barangay"
                placeholder="Select Barangay"
                value={formData.barangay}
                options={barangays}
                onSelect={handleBarangaySelect}
                loading={loadingBarangays}
                disabled={!formData.city}
                required={true}
              />

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Postal Code *
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.postalCode}
                  onChangeText={(value) => handleInputChange('postalCode', value)}
                  placeholder="Enter postal code"
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity 
                style={styles.checkboxContainer}
                onPress={() => handleInputChange('isDefault', !formData.isDefault)}
              >
                <View style={[styles.checkbox, { backgroundColor: formData.isDefault ? '#83AFA7' : 'transparent', borderColor: '#83AFA7' }]}>
                  {formData.isDefault && <Ionicons name="checkmark" size={16} color="white" />}
                </View>
                <Text style={[styles.checkboxLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                  Set as default address
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={[styles.modalActions, { borderTopColor: '#E0E0E0' }]}>
              <TouchableOpacity 
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.modalActionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionButton, styles.saveButton]}
                onPress={handleSaveAddress}
              >
                <Text style={[styles.modalActionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  {editingAddress ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModal}>
            <View style={[styles.modalHeader, { borderBottomColor: '#E0E0E0' }]}>
              <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Delete Address
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={[styles.confirmMessage, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Are you sure you want to delete this address? This action cannot be undone.
              </Text>
            </View>
            
            <View style={[styles.modalActions, { borderTopColor: '#E0E0E0' }]}>
              <TouchableOpacity 
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.modalActionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionButton, styles.deleteButton]}
                onPress={handleDeleteAddress}
              >
                <Text style={[styles.modalActionText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addButton: {
    padding: 4,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#83AFA7',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#83AFA7',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  addressesList: {
    paddingVertical: 16,
  },
  addressCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F0F8F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addressInfo: {
    flex: 1,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  addressName: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 2,
    marginRight: 8,
  },
  addressSubtitle: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 1,
  },
  defaultBadge: {
    backgroundColor: '#83AFA7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  addressActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  addressDetails: {
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  setDefaultButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F0F8F6',
    marginTop: 8,
  },
  setDefaultText: {
    color: '#83AFA7',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  detailsModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 500,
  },
  inputGroup: {
    marginBottom: Platform.OS === 'android' ? 12 : 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  confirmMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  saveButton: {
    backgroundColor: '#83AFA7',
  },
  deleteButton: {
    backgroundColor: '#FF4444',
  },
});

export default MyAddressScreen;
