import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

const AddressDropdown = ({
  label,
  placeholder,
  value,
  options = [],
  onSelect,
  loading = false,
  disabled = false,
  error = false,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
  });

  const handleSelect = (option) => {
    onSelect(option);
    setIsOpen(false);
  };

  const selectedOption = options.find(option => option.code === value);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      
      <TouchableOpacity
        style={[
          styles.dropdown,
          error && styles.dropdownError,
          disabled && styles.dropdownDisabled,
        ]}
        onPress={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <Text style={[
          styles.dropdownText,
          !selectedOption && styles.placeholderText,
          { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
        ]}>
          {selectedOption ? selectedOption.name : placeholder}
        </Text>
        
        <View style={styles.dropdownRight}>
          {loading ? (
            <ActivityIndicator size="small" color="#83AFA7" />
          ) : (
            <Ionicons 
              name={isOpen ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
          )}
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdownList}>
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {options.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                  {loading ? 'Loading...' : 'No options available'}
                </Text>
              </View>
            ) : (
              options.map((option, index) => (
                <TouchableOpacity
                  key={option.code || index}
                  style={[
                    styles.option,
                    selectedOption?.code === option.code && styles.selectedOption,
                  ]}
                  onPress={() => handleSelect(option)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedOption?.code === option.code && styles.selectedOptionText,
                    { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
                  ]}>
                    {option.name}
                  </Text>
                  {selectedOption?.code === option.code && (
                    <Ionicons name="checkmark" size={16} color="#83AFA7" />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#FF4444',
  },
  dropdown: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  dropdownError: {
    borderColor: '#FF4444',
  },
  dropdownDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  dropdownRight: {
    marginLeft: 8,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    maxHeight: 200,
    marginTop: 4,
  },
  scrollView: {
    maxHeight: 200,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedOption: {
    backgroundColor: '#F8F9FA',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  selectedOptionText: {
    color: '#83AFA7',
    fontWeight: '500',
  },
});

export default AddressDropdown;
