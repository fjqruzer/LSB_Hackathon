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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import StandardModal from '../components/StandardModal';

const PaymentMethodsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [deleteIndex, setDeleteIndex] = useState(-1);
  
  // Helper functions for modals
  const showSuccess = (message) => {
    setModalMessage(message);
    setShowSuccessModal(true);
  };

  const showError = (message) => {
    setModalMessage(message);
    setShowErrorModal(true);
  };

  const showDelete = (index) => {
    setDeleteIndex(index);
    setShowDeleteModal(true);
  };
  
  // Form data
  const [bankName, setBankName] = useState('');
  const [customBankName, setCustomBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [showCustomBankInput, setShowCustomBankInput] = useState(false);
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Common bank names in the Philippines
  const bankOptions = [
    'BDO (Banco de Oro)',
    'BPI (Bank of the Philippine Islands)',
    'Metrobank',
    'Security Bank',
    'UnionBank',
    'RCBC (Rizal Commercial Banking Corporation)',
    'Chinabank (China Banking Corporation)',
    'PNB (Philippine National Bank)',
    'Landbank',
    'EastWest Bank',
    'Robinsons Bank',
    'Maybank',
    'CIMB Bank',
    'GCash',
    'PayMaya',
    'Other (Custom)',
  ];

  // Fetch payment methods
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setPaymentMethods(userData.paymentMethods || []);
          }
        } catch (error) {
          console.error('Error fetching payment methods:', error);
        }
      }
      setLoading(false);
    };

    fetchPaymentMethods();
  }, [user]);

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  const resetForm = () => {
    setBankName('');
    setCustomBankName('');
    setAccountNumber('');
    setAccountName('');
    setShowCustomBankInput(false);
    setShowBankDropdown(false);
  };

  const handleAddPaymentMethod = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditPaymentMethod = (index) => {
    const method = paymentMethods[index];
    setBankName(method.bankName);
    setCustomBankName(method.bankName);
    setAccountNumber(method.accountNumber);
    setAccountName(method.accountName);
    setShowCustomBankInput(!bankOptions.includes(method.bankName));
    setEditingIndex(index);
    setShowEditModal(true);
  };

  const handleDeletePaymentMethod = (index) => {
    showDelete(index);
  };

  const confirmDeletePaymentMethod = async () => {
    try {
      const updatedMethods = paymentMethods.filter((_, i) => i !== deleteIndex);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        paymentMethods: updatedMethods,
      });
      setPaymentMethods(updatedMethods);
      setShowDeleteModal(false);
      showSuccess('Payment method deleted successfully');
    } catch (error) {
      console.error('Error deleting payment method:', error);
      setShowDeleteModal(false);
      showError('Failed to delete payment method');
    }
  };

  const handleSavePaymentMethod = async () => {
    // Validation
    if (!bankName && !customBankName) {
      showError('Please select or enter a bank name');
      return;
    }

    if (!accountNumber.trim()) {
      showError('Please enter account number');
      return;
    }

    if (!accountName.trim()) {
      showError('Please enter account name');
      return;
    }

    // Validate account number (should be numeric)
    if (!/^\d+$/.test(accountNumber.trim())) {
      showError('Account number should contain only numbers');
      return;
    }

    try {
      const finalBankName = showCustomBankInput ? customBankName.trim() : bankName;
      const newMethod = {
        bankName: finalBankName,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        id: Date.now().toString(),
      };

      const userRef = doc(db, 'users', user.uid);
      
      if (editingIndex >= 0) {
        // Edit existing method
        const updatedMethods = [...paymentMethods];
        updatedMethods[editingIndex] = newMethod;
        await updateDoc(userRef, {
          paymentMethods: updatedMethods,
        });
        setPaymentMethods(updatedMethods);
        showSuccess('Payment method updated successfully');
        setShowEditModal(false);
      } else {
        // Add new method
        await updateDoc(userRef, {
          paymentMethods: arrayUnion(newMethod),
        });
        setPaymentMethods([...paymentMethods, newMethod]);
        showSuccess('Payment method added successfully');
        setShowAddModal(false);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving payment method:', error);
      showError('Failed to save payment method');
    }
  };

  const handleBankNameChange = (value) => {
    setBankName(value);
    setShowCustomBankInput(value === 'Other (Custom)');
    if (value !== 'Other (Custom)') {
      setCustomBankName('');
    }
  };

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  return (
    <>
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
          Payment Methods
        </Text>
        <TouchableOpacity onPress={handleAddPaymentMethod} style={styles.addButton}>
          <Ionicons name="add" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color="#F68652" />
            <Text style={[styles.infoText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
              You need at least one payment method to post listings. Buyers will use these to pay you.
            </Text>
          </View>
        </View>

        {/* Payment Methods List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Your Payment Methods ({paymentMethods.length})
          </Text>
          
          {paymentMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color="#CCC" />
              <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                No Payment Methods
              </Text>
              <Text style={[styles.emptyDescription, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                Add a payment method to start selling
              </Text>
            </View>
          ) : (
            paymentMethods.map((method, index) => (
              <View key={method.id || index} style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodInfo}>
                  <Text style={[styles.bankName, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                    {method.bankName}
                  </Text>
                  <Text style={[styles.accountNumber, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    ****{method.accountNumber.slice(-4)}
                  </Text>
                  <Text style={[styles.accountName, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                    {method.accountName}
                  </Text>
                </View>
                <View style={styles.paymentMethodActions}>
                  <TouchableOpacity 
                    onPress={() => handleEditPaymentMethod(index)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="create-outline" size={20} color="#83AFA7" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleDeletePaymentMethod(index)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Payment Method Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={[styles.modalCancelText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              Add Payment Method
            </Text>
            <TouchableOpacity onPress={handleSavePaymentMethod}>
              <Text style={[styles.modalSaveText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Bank Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Bank Name *
              </Text>
              <TouchableOpacity 
                style={styles.dropdownInput}
                onPress={() => setShowBankDropdown(!showBankDropdown)}
              >
                <Text style={[styles.dropdownText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                  {bankName || 'Select Bank'}
                </Text>
                <Ionicons name={showBankDropdown ? "chevron-up" : "chevron-down"} size={20} color="#83AFA7" />
              </TouchableOpacity>
              
              {/* Inline Bank Options Dropdown */}
              {showBankDropdown && (
                <View style={styles.bankDropdownContainer}>
                  <ScrollView style={styles.bankDropdownScroll} showsVerticalScrollIndicator={false}>
                    {bankOptions.map((bank, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.bankDropdownOption,
                          bankName === bank && styles.bankDropdownOptionSelected
                        ]}
                        onPress={() => {
                          handleBankNameChange(bank);
                          setShowBankDropdown(false);
                        }}
                      >
                        <Text style={[
                          styles.bankDropdownOptionText, 
                          { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                          bankName === bank && styles.bankDropdownOptionTextSelected
                        ]}>
                          {bank}
                        </Text>
                        {bankName === bank && (
                          <Ionicons name="checkmark" size={16} color="#83AFA7" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Custom Bank Name */}
            {showCustomBankInput && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Enter Bank Name *
                </Text>
                <TextInput
                  style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                  value={customBankName}
                  onChangeText={setCustomBankName}
                  placeholder="Enter bank name"
                  placeholderTextColor="#999"
                />
              </View>
            )}

            {/* Account Number */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Account Number *
              </Text>
              <TextInput
                style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Enter account number"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={20}
              />
            </View>

            {/* Account Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Account Name *
              </Text>
              <TextInput
                style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Enter account holder name"
                placeholderTextColor="#999"
                maxLength={50}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Payment Method Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={[styles.modalCancelText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
              Edit Payment Method
            </Text>
            <TouchableOpacity onPress={handleSavePaymentMethod}>
              <Text style={[styles.modalSaveText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Same form fields as Add Modal */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Bank Name *
              </Text>
              <TouchableOpacity 
                style={styles.dropdownInput}
                onPress={() => setShowBankDropdown(!showBankDropdown)}
              >
                <Text style={[styles.dropdownText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                  {bankName || 'Select Bank'}
                </Text>
                <Ionicons name={showBankDropdown ? "chevron-up" : "chevron-down"} size={20} color="#83AFA7" />
              </TouchableOpacity>
              
              {/* Inline Bank Options Dropdown */}
              {showBankDropdown && (
                <View style={styles.bankDropdownContainer}>
                  <ScrollView style={styles.bankDropdownScroll} showsVerticalScrollIndicator={false}>
                    {bankOptions.map((bank, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.bankDropdownOption,
                          bankName === bank && styles.bankDropdownOptionSelected
                        ]}
                        onPress={() => {
                          handleBankNameChange(bank);
                          setShowBankDropdown(false);
                        }}
                      >
                        <Text style={[
                          styles.bankDropdownOptionText, 
                          { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined },
                          bankName === bank && styles.bankDropdownOptionTextSelected
                        ]}>
                          {bank}
                        </Text>
                        {bankName === bank && (
                          <Ionicons name="checkmark" size={16} color="#83AFA7" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {showCustomBankInput && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  Enter Bank Name *
                </Text>
                <TextInput
                  style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                  value={customBankName}
                  onChangeText={setCustomBankName}
                  placeholder="Enter bank name"
                  placeholderTextColor="#999"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Account Number *
              </Text>
              <TextInput
                style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Enter account number"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={20}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Account Name *
              </Text>
              <TextInput
                style={[styles.textInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Enter account holder name"
                placeholderTextColor="#999"
                maxLength={50}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <StandardModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Payment Method"
        message="Are you sure you want to delete this payment method?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeletePaymentMethod}
        showCancel={true}
        confirmButtonStyle="danger"
      />

      {/* Success Modal */}
      <StandardModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success"
        message={modalMessage}
        confirmText="OK"
        onConfirm={() => setShowSuccessModal(false)}
        showCancel={false}
        confirmButtonStyle="success"
      />

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
    </View>

    </>
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F68652',
  },
  infoText: {
    fontSize: 14,
    color: '#F68652',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  paymentMethodCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  accountNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  accountName: {
    fontSize: 14,
    color: '#999',
  },
  paymentMethodActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#DFECE2',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#DFECE2',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#83AFA7',
  },
  modalTitle: {
    fontSize: 18,
    color: '#83AFA7',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#83AFA7',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
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
  bankDropdownContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bankDropdownScroll: {
    maxHeight: 200,
  },
  bankDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bankDropdownOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  bankDropdownOptionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  bankDropdownOptionTextSelected: {
    color: '#83AFA7',
    fontFamily: 'Poppins-Medium',
  },
});

export default PaymentMethodsScreen;
