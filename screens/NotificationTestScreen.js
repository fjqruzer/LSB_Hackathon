import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationTestScreen = ({ navigation }) => {
  const { 
    sendLocalNotification, 
    getExpoPushToken, 
    notifyNewListing, 
    notifyListingSold, 
    notifyNewMessage, 
    notifyPriceDrop 
  } = useNotifications();
  
  const [pushToken, setPushToken] = useState(null);

  const getToken = () => {
    const token = getExpoPushToken();
    setPushToken(token);
  };

  const testLocalNotification = () => {
    sendLocalNotification(
      'Test Notification',
      'This is a test notification from COPit!',
      { screen: 'test', type: 'test' }
    );
  };

  const testNewListingNotification = () => {
    notifyNewListing('Test Item', 'Test Seller');
  };

  const testListingSoldNotification = () => {
    notifyListingSold('Test Item', 'Test Buyer');
  };

  const testNewMessageNotification = () => {
    notifyNewMessage('Test User', 'Hello! How are you?');
  };

  const testPriceDropNotification = () => {
    notifyPriceDrop('Test Item', '1000', '800');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#83AFA7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Test</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Token</Text>
          <TouchableOpacity style={styles.button} onPress={getToken}>
            <Text style={styles.buttonText}>Get Push Token</Text>
          </TouchableOpacity>
          {pushToken && (
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenText}>{pushToken}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Notifications</Text>
          
          <TouchableOpacity style={styles.button} onPress={testLocalNotification}>
            <Text style={styles.buttonText}>Test Local Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testNewListingNotification}>
            <Text style={styles.buttonText}>Test New Listing Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testListingSoldNotification}>
            <Text style={styles.buttonText}>Test Listing Sold Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testNewMessageNotification}>
            <Text style={styles.buttonText}>Test New Message Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testPriceDropNotification}>
            <Text style={styles.buttonText}>Test Price Drop Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.instructionText}>
            1. Tap "Get Push Token" to get your device's push token{'\n'}
            2. Test local notifications (appear in notification bar){'\n'}
            3. Notifications will vibrate and show in notification bar{'\n'}
            4. Real push notifications work in Expo Go!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  headerSpacer: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#83AFA7',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tokenContainer: {
    backgroundColor: '#e9ecef',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  tokenText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  instructionText: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
});

export default NotificationTestScreen;
