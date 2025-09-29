import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFonts } from 'expo-font';

const StandardModal = ({
  visible,
  onClose,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  showCancel = false,
  confirmButtonStyle = 'primary', // 'primary', 'danger', 'success'
}) => {
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  const getConfirmButtonStyle = () => {
    switch (confirmButtonStyle) {
      case 'danger':
        return styles.dangerButton;
      case 'success':
        return styles.successButton;
      default:
        return styles.primaryButton;
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            {title}
          </Text>
          <Text style={[styles.modalMessage, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            {message}
          </Text>
          <View style={styles.modalActions}>
            {showCancel && (
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.modalButton, getConfirmButtonStyle()]}
              onPress={handleConfirm}
            >
              <Text style={[styles.modalButtonText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
    maxWidth: '90%',
  },
  modalTitle: {
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  primaryButton: {
    backgroundColor: '#83AFA7',
  },
  dangerButton: {
    backgroundColor: '#FF5252',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    fontSize: 14,
    color: 'white',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6C757D',
  },
});

export default StandardModal;
