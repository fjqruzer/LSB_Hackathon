import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useNavigation } from '@react-navigation/native';
import { useNotificationListener } from '../contexts/NotificationListenerContext';
import { useTheme } from '../contexts/ThemeContext';

const UpdatesScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markAsRead, clearAllNotifications } = useNotificationListener();
  const { isDarkMode, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  
  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

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
  const handleNotificationPress = (notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    
    // Handle different notification types
    if (notification.data?.type === 'payment_required' || notification.data?.type === 'payment_reminder') {
      
      // Navigate to payment screen
      navigation.navigate('Payment', {
        listingId: notification.data.listingId,
        actionType: notification.data.actionType,
        price: notification.data.amount,
      });
    } else if (notification.data?.listingId) {
      // Navigate to listing details
      }
  };

  // Use real notifications from context
  const updates = notifications.map(notification => ({
    id: notification.id,
    type: notification.data?.type || notification.type || 'general',
    title: notification.title,
    description: notification.body,
    time: formatTimeAgo(notification.createdAt),
    action: notification.data?.action,
    listingId: notification.data?.listingId,
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
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.accent }]}>Updates</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Stay informed about your activity</Text>
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearAllNotifications}
            >
              <Ionicons name="trash-outline" size={20} color={colors.accent} />
            </TouchableOpacity>
          )}
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
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionIcon}>
                <Ionicons name="notifications-off-outline" size={24} color="#83AFA7" />
              </View>
              <Text style={styles.actionText}>Mute All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionIcon}>
                <Ionicons name="checkmark-done-outline" size={24} color="#83AFA7" />
              </View>
              <Text style={styles.actionText}>Mark Read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionIcon}>
                <Ionicons name="settings-outline" size={24} color="#83AFA7" />
              </View>
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Updates List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Updates</Text>
          {updates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-outline" size={48} color="#CCC" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyDescription}>You'll see updates about your listings and activity here</Text>
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
              <TouchableOpacity style={styles.updateAction}>
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              </TouchableOpacity>
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
    color: '#333',
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  actionText: {
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
    color: '#333',
    textAlign: 'center',
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
  updateAction: {
    padding: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#F68652',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins-Bold',
  },
  clearButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default UpdatesScreen;
