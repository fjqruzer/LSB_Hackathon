import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useNotificationListener } from '../contexts/NotificationListenerContext';
import { useTheme } from '../contexts/ThemeContext';

const UpdatesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markAsRead } = useNotificationListener();
  const { isDarkMode, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  // Format time ago
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type, action) => {
    if (action) {
      switch (action) {
        case 'Mined': return 'diamond-outline';
        case 'Stole': return 'flash-outline';
        case 'Locked': return 'lock-closed-outline';
        case 'Bid': return 'card-outline';
        default: return 'notifications-outline';
      }
    }
    
    switch (type) {
      case 'listing_action': return 'notifications-outline';
      case 'new_bid': return 'card-outline';
      case 'payment_required': return 'card-outline';
      case 'payment_reminder': return 'time-outline';
      case 'winner_determined': return 'trophy-outline';
      case 'listing_expired_lost': return 'close-circle-outline';
      case 'no_winner': return 'information-circle-outline';
      case 'payment_timeout_no_buyers': return 'close-circle-outline';
      default: return 'notifications-outline';
    }
  };

  // Get notification color based on action and type
  const getNotificationColor = (action, type) => {
    if (action) {
      switch (action) {
        case 'Mined': return '#4CAF50';
        case 'Stole': return '#FF9800';
        case 'Locked': return '#2196F3';
        case 'Bid': return '#9C27B0';
        default: return '#83AFA7';
      }
    }
    
    switch (type) {
      case 'payment_required': return '#FF5722';
      case 'payment_reminder': return '#FF9800';
      case 'winner_determined': return '#4CAF50';
      case 'listing_expired_lost': return '#9E9E9E';
      case 'no_winner': return '#607D8B';
      case 'payment_timeout_no_buyers': return '#F44336';
      default: return '#83AFA7';
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    // The notifications will automatically refresh via the listener
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Handle notification press
  const handleNotificationPress = (update) => {
    // Mark as read using the original notification ID
    markAsRead(update.notificationId);
    
    // Check if component is still mounted
    if (!isMountedRef.current) {
      return;
    }
    
    // Check if navigation is available
    if (!navigation || !navigation.navigate) {
      console.warn('Navigation not available');
      return;
    }
    
    // Handle different notification types
    try {
      if (update.type === 'payment_required' || update.type === 'payment_reminder') {
        // Debug logging
        console.log('🔍 UpdatesScreen - Navigating to Payment with data:', {
          listingId: update.listingId,
          actionType: update.action,
          amount: update.amount,
          paymentId: update.paymentId
        });
        
        // Navigate to payment screen
        navigation.navigate('Payment', {
          listingId: update.listingId,
          actionType: update.action,
          price: update.amount,
          amount: update.amount,
          paymentId: update.paymentId, // Pass paymentId if available
        });
      } else if (update.type === 'payment_approved' || update.type === 'payment_rejected') {
        // Navigate to MyPayments screen for payment status
        navigation.navigate('MyPayments');
      } else if (update.type === 'payment_submitted') {
        // Navigate to PaymentApproval screen for seller
        navigation.navigate('PaymentApproval');
      } else if (update.listingId) {
        // Navigate to listing details
        navigation.navigate('ListingDetails', {
          listing: { id: update.listingId }
        });
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  // Use real notifications from context
  const updates = notifications.map(notification => ({
    id: notification.id,
    notificationId: notification.id, // Keep reference to original notification ID
    type: notification.data?.type || notification.type || 'general',
    title: notification.title,
    description: notification.body,
    time: formatTimeAgo(notification.createdAt),
    action: notification.data?.action,
    listingId: notification.data?.listingId,
    amount: notification.data?.amount, // Add amount field for price display
    paymentId: notification.data?.paymentId, // Add paymentId for existing payments
    unread: !notification.read,
  }));

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

  const getIconForType = (type) => {
    switch (type) {
      case 'bid': return 'hammer-outline';
      case 'sale': return 'checkmark-circle-outline';
      case 'promotion': return 'pricetag-outline';
      case 'system': return 'information-circle-outline';
      default: return 'notifications-outline';
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'bid': return '#F68652';
      case 'sale': return '#4CAF50';
      case 'promotion': return '#FF9800';
      case 'system': return '#2196F3';
      default: return '#83AFA7';
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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation?.goBack && navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#83AFA7" />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.accent }]}>Updates</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Stay informed about your activity</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="notifications" size={28} color="#83AFA7" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#83AFA7']}
            tintColor="#83AFA7"
          />
        }
      >

        {/* Updates List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Updates</Text>
          {updates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-outline" size={64} color="#83AFA7" />
              <Text style={[
                styles.emptyTitle,
                { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
              ]}>No notifications yet</Text>
              <Text style={[
                styles.emptyDescription,
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
              ]}>You'll see updates about your listings and activity here</Text>
            </View>
          ) : (
            updates.map((update) => (
              <TouchableOpacity 
                key={update.id} 
                style={[styles.updateCard, update.unread && styles.unreadCard]}
                onPress={() => handleNotificationPress(update)}
              >
              <View style={styles.updateIcon}>
                  <View style={[
                    styles.iconContainer, 
                    { backgroundColor: getNotificationColor(update.action, update.type) + '20' }
                  ]}>
                    <Ionicons 
                      name={getNotificationIcon(update.type, update.action)} 
                      size={24} 
                      color={getNotificationColor(update.action, update.type)} 
                    />
                  </View>
              </View>
              <View style={styles.updateContent}>
                <View style={styles.updateHeader}>
                  <Text style={styles.updateTitle}>{update.title}</Text>
                  {update.unread && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.updateDescription}>{update.description}</Text>
                <Text style={styles.updateTime}>{update.time}</Text>
              </View>
            </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerLeft: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#83AFA7',
    marginBottom: 12,
  },
  updateCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#F68652',
  },
  updateIcon: {
    marginRight: 12,
  },
  updateImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateContent: {
    flex: 1,
  },
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  updateTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    flex: 1,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F68652',
  },
  updateDescription: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 3,
  },
  updateTime: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: '#999',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F68652',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins-Bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#83AFA7',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default UpdatesScreen;
