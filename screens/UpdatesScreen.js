import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';

const UpdatesScreen = () => {
  const insets = useSafeAreaInsets();
  
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

  const updates = [
    {
      id: 1,
      type: 'bid',
      title: 'New bid on your item',
      description: 'Someone bid PHP 450 on your backpack',
      time: '2 minutes ago',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=60&h=60&fit=crop',
      unread: true,
    },
    {
      id: 2,
      type: 'sale',
      title: 'Item sold successfully',
      description: 'Your vintage jacket sold for PHP 800',
      time: '1 hour ago',
      image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=60&h=60&fit=crop',
      unread: false,
    },
    {
      id: 3,
      type: 'promotion',
      title: 'Flash sale alert',
      description: '50% off on all electronics today only',
      time: '3 hours ago',
      image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=60&h=60&fit=crop',
      unread: true,
    },
    {
      id: 4,
      type: 'system',
      title: 'Welcome to COPit!',
      description: 'Start exploring our marketplace',
      time: '1 day ago',
      image: null,
      unread: false,
    },
  ];

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
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar 
        style="dark" 
        backgroundColor="#FEF4D8"
        translucent={Platform.OS === "android"}
        barStyle="dark-content"
        animated={true}
        hidden={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Updates</Text>
        <Text style={styles.headerSubtitle}>Stay informed about your activity</Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
          {updates.map((update) => (
            <TouchableOpacity key={update.id} style={[styles.updateCard, update.unread && styles.unreadCard]}>
              <View style={styles.updateIcon}>
                {update.image ? (
                  <Image source={{ uri: update.image }} style={styles.updateImage} />
                ) : (
                  <View style={[styles.iconContainer, { backgroundColor: getIconColor(update.type) + '20' }]}>
                    <Ionicons name={getIconForType(update.type)} size={24} color={getIconColor(update.type)} />
                  </View>
                )}
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
          ))}
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>New Bids</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>5</Text>
              <Text style={styles.statLabel}>Items Sold</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>8</Text>
              <Text style={styles.statLabel}>Messages</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Promotions</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF4D8',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FEF4D8',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#83AFA7',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 16,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#333',
    textAlign: 'center',
  },
  updateCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F68652',
  },
  updateIcon: {
    marginRight: 16,
  },
  updateImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateContent: {
    flex: 1,
  },
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  updateTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F68652',
  },
  updateDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 4,
  },
  updateTime: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#999',
  },
  updateAction: {
    padding: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#F68652',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#666',
    textAlign: 'center',
  },
});

export default UpdatesScreen;
