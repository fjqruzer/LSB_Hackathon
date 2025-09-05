import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

const { width, height } = Dimensions.get('window');

const CustomPopup = ({ 
  visible, 
  onClose, 
  title, 
  message, 
  type = 'info', // 'success', 'error', 'warning', 'info', 'bid', 'steal', 'lock'
  showCancel = false,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancel'
}) => {
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  const getThriftTheme = () => {
    switch (type) {
      case 'success':
        return { 
          icon: 'trophy', 
          color: '#FFD700', 
          bgColor: '#FFF8DC',
          borderColor: '#FFD700',
          accentColor: '#FFA500',
          title: '🎉 Success!',
          subtext: 'Great deal secured!'
        };
      case 'error':
        return { 
          icon: 'close-circle', 
          color: '#FF6B6B', 
          bgColor: '#FFE8E8',
          borderColor: '#FF6B6B',
          accentColor: '#FF4757',
          title: '❌ Oops!',
          subtext: 'Something went wrong'
        };
      case 'warning':
        return { 
          icon: 'alert-circle', 
          color: '#FFA726', 
          bgColor: '#FFF3E0',
          borderColor: '#FFA726',
          accentColor: '#FF9800',
          title: '⚠️ Hold up!',
          subtext: 'Check this out'
        };
      case 'bid':
        return { 
          icon: 'hammer', 
          color: '#83AFA7', 
          bgColor: '#E8F5F3',
          borderColor: '#83AFA7',
          accentColor: '#5A8B7F',
          title: '🔨 Bid Alert!',
          subtext: 'Auction update'
        };
      case 'steal':
        return { 
          icon: 'flash', 
          color: '#9C27B0', 
          bgColor: '#F3E5F5',
          borderColor: '#9C27B0',
          accentColor: '#7B1FA2',
          title: '⚡ Steal Deal!',
          subtext: 'Amazing price!'
        };
      case 'lock':
        return { 
          icon: 'lock-closed', 
          color: '#607D8B', 
          bgColor: '#ECEFF1',
          borderColor: '#607D8B',
          accentColor: '#455A64',
          title: '🔒 Locked In!',
          subtext: 'Deal secured'
        };
      default:
        return { 
          icon: 'information-circle', 
          color: '#83AFA7', 
          bgColor: '#E8F5F3',
          borderColor: '#83AFA7',
          accentColor: '#5A8B7F',
          title: 'ℹ️ Info',
          subtext: 'Just so you know'
        };
    }
  };

  const theme = getThriftTheme();

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
      <View style={styles.overlay}>
        <View style={[styles.popupContainer, { backgroundColor: theme.bgColor, borderColor: theme.borderColor }]}>
          {/* Decorative Top Border */}
          <View style={[styles.decorativeBorder, { backgroundColor: theme.accentColor }]} />
          
          {/* Header with Icon and Title */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: theme.color + '20', borderColor: theme.color }]}>
              <Ionicons name={theme.icon} size={32} color={theme.color} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { fontFamily: fontsLoaded ? 'Poppins-Bold' : undefined, color: theme.accentColor }]}>
                {theme.title}
              </Text>
              <Text style={[styles.subtitle, { fontFamily: fontsLoaded ? 'Poppins-Medium' : undefined, color: theme.color }]}>
                {theme.subtext}
              </Text>
            </View>
          </View>

          {/* Main Message */}
          <View style={styles.messageContainer}>
            <Text style={[styles.message, { fontFamily: fontsLoaded ? 'Poppins-Regular' : undefined }]}>
              {message}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {showCancel && (
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { fontFamily: fontsLoaded ? 'Poppins-Medium' : undefined }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.button, styles.confirmButton, { backgroundColor: theme.accentColor }]}
              onPress={handleConfirm}
            >
              <Text style={[styles.confirmButtonText, { fontFamily: fontsLoaded ? 'Poppins-SemiBold' : undefined }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Decorative Element */}
          <View style={styles.bottomDecoration}>
            <View style={[styles.decorativeDot, { backgroundColor: theme.color }]} />
            <View style={[styles.decorativeDot, { backgroundColor: theme.accentColor }]} />
            <View style={[styles.decorativeDot, { backgroundColor: theme.color }]} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  popupContainer: {
    borderRadius: 24,
    padding: 0,
    maxWidth: width * 0.9,
    width: '100%',
    borderWidth: 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  decorativeBorder: {
    height: 4,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    textAlign: 'left',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'left',
    opacity: 0.8,
  },
  messageContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  message: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
  },
  confirmButton: {
    // backgroundColor is set dynamically
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6C757D',
    fontWeight: '600',
  },
  confirmButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '700',
  },
  bottomDecoration: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
    gap: 8,
  },
  decorativeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
});

export default CustomPopup;
