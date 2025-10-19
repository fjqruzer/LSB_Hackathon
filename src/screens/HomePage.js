import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  useWindowDimensions,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../utils/AuthContext';
import { logoutUser, getUserProfile, createUserProfile } from '../utils/auth';
import { getActiveListings, getUserListings } from '../utils/listings';

SplashScreen.preventAutoHideAsync();

const COLORS = {
  background: '#F8F5ED',
  teal: '#50A8A8',
  orange: '#F28C4A',
  gray: '#B8C0C2',
  dark: '#3C3C3C',
  white: '#FFFFFF',
  error: '#FF6B6B',
};

const TABS = [
  { key: 'explore', label: 'Explore', icon: 'compass-outline' },
  { key: 'foryou', label: 'For You', icon: 'account-heart-outline' },
  { key: 'updates', label: 'Updates', icon: 'bell-outline' },
  { key: 'me', label: 'Me', icon: 'account-circle-outline' },
];

const CATEGORY_TABS = [
  { key: 'all', label: 'Top picks' },
  { key: 'bidding', label: 'Bidding' },
  { key: 'msl', label: 'MSL' },
  { key: 'following', label: 'Following' },
  { key: 'locale', label: 'Locale' },
];

export default function HomePage({ navigation }) {
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
  });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { userProfile: authUserProfile, currentUser } = useAuth();
  
  // Local profile state for this component
  const [userProfile, setUserProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Listings state
  const [listings, setListings] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Fetch user profile when component mounts or user changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!currentUser) return;
      
      setIsLoadingProfile(true);
      try {
        console.log('🔍 Fetching user profile for homepage...');
        const profile = await getUserProfile(currentUser.uid);
        
        if (profile) {
          console.log('✅ User profile loaded for homepage:', profile.firstName);
          setUserProfile(profile);
        } else {
          console.log('ℹ️ No profile found, user can create one later');
          setUserProfile(null);
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch profile for homepage:', error.message);
        setUserProfile(null);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [currentUser]);

  // Fetch listings when component mounts or category changes
  useEffect(() => {
    fetchListings();
  }, [selectedCategory]);

  const fetchListings = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setIsLoadingListings(true);
    }

    try {
      console.log('🔍 Fetching listings for category:', selectedCategory);
      let fetchedListings = [];

      switch (selectedCategory) {
        case 'bidding':
          fetchedListings = await getActiveListings(50);
          fetchedListings = fetchedListings.filter(listing => listing.priceMode === 'BID');
          break;
        case 'msl':
          fetchedListings = await getActiveListings(50);
          fetchedListings = fetchedListings.filter(listing => listing.priceMode === 'MSL');
          break;
        case 'following':
          // TODO: Implement following logic
          fetchedListings = [];
          break;
        case 'locale':
          // TODO: Implement location-based filtering
          fetchedListings = await getActiveListings(50);
          break;
        default: // 'all' or 'top picks'
          fetchedListings = await getActiveListings(50);
          break;
      }

      // Filter by search query if provided
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        fetchedListings = fetchedListings.filter(listing => 
          listing.title?.toLowerCase().includes(query) ||
          listing.description?.toLowerCase().includes(query) ||
          listing.brand?.toLowerCase().includes(query) ||
          listing.category?.toLowerCase().includes(query) ||
          listing.type?.toLowerCase().includes(query)
        );
      }

      console.log(`✅ Fetched ${fetchedListings.length} listings for ${selectedCategory}`);
      setListings(fetchedListings);
    } catch (error) {
      console.error('❌ Error fetching listings:', error);
      Alert.alert('Error', 'Failed to load listings. Please try again.');
    } finally {
      setIsLoadingListings(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchListings(true);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    // Debounce search - fetch listings after user stops typing
    setTimeout(() => {
      fetchListings();
    }, 500);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  const getTimeRemaining = (deadline) => {
    if (!deadline) return 'No deadline';
    
    const now = new Date();
    const deadlineDate = deadline.toDate ? deadline.toDate() : new Date(deadline);
    const timeDiff = deadlineDate.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      return 'Expired';
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getPriceDisplay = (listing) => {
    if (listing.priceMode === 'MSL') {
      return `M: ${listing.minePrice || 0} | S: ${listing.stealPrice || 0} | L: ${listing.lockPrice || 0}`;
    } else if (listing.priceMode === 'BID') {
      return `Starting: ${listing.startingPrice || 0}`;
    }
    return 'Price not set';
  };

  const getPriceTag = (listing) => {
    if (listing.priceMode === 'MSL') {
      return 'M-S-L';
    } else if (listing.priceMode === 'BID') {
      return 'Bidding';
    }
    return 'Price not set';
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
              // Navigation will be handled automatically by AuthContext
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!fontsLoaded) return null;

  const horizontalPadding = 16;
  const gap = 12;
  const columns = width >= 700 ? 3 : 2;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columns - 1)) / columns;

  const isSmall = width < 360;
  const barHeight = isSmall ? 60 : 72; // compact bar height
  const iconSize = isSmall ? 20 : 22;
  const labelSize = isSmall ? 9 : 10;
  const fabSize = isSmall ? 52 : 56;
  const fabRadius = fabSize / 2;
  const centerSpacerWidth = fabSize + 32; // leave room for FAB overlay

  const listBottomPad = barHeight + Math.max(insets.bottom, 12) + 24;

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.card, { width: cardWidth }]} 
      onPress={() => {
        // TODO: Navigate to listing detail screen
        console.log('Navigate to listing:', item.id);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.imageWrapper}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.image} />
        ) : (
          <View style={styles.noImagePlaceholder}>
            <MaterialCommunityIcons name="image-off" size={32} color={COLORS.gray} />
            <Text style={styles.noImageText}>No Image</Text>
          </View>
        )}
        <View style={styles.badgeTime}>
          <Text style={styles.badgeTimeTop}>{getTimeRemaining(item.deadline)}</Text>
          <Text style={styles.badgeTimeBottom}>Left</Text>
        </View>
        <TouchableOpacity style={styles.likeBtn}>
          <MaterialCommunityIcons name="heart-outline" size={18} color={COLORS.teal} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>{item.title || 'Untitled Listing'}</Text>
        <Text style={styles.priceRow}>
          <Text style={styles.price}>{getPriceDisplay(item)}</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.tag}>{getPriceTag(item)}</Text>
        </Text>
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.userEmail ? item.userEmail[0].toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.seller} numberOfLines={1}>
          @{item.userEmail ? item.userEmail.split('@')[0] : 'user'}
        </Text>
        <MaterialCommunityIcons name="dots-vertical" size={18} color={COLORS.gray} />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="package-variant" size={64} color={COLORS.gray} />
      <Text style={styles.emptyStateTitle}>No Listings Found</Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchQuery ? `No results for "${searchQuery}"` : `No ${selectedCategory === 'all' ? '' : selectedCategory} listings available`}
      </Text>
      {searchQuery && (
        <TouchableOpacity 
          style={styles.clearSearchBtn}
          onPress={() => {
            setSearchQuery('');
            fetchListings();
          }}
        >
          <Text style={styles.clearSearchText}>Clear Search</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]} onLayout={onLayoutRootView}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={require('./assets/logo.png')} style={styles.logo} />
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color={COLORS.gray} />
          <TextInput 
            placeholder="Search Item" 
            placeholderTextColor={COLORS.gray} 
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              fetchListings();
            }}>
              <MaterialCommunityIcons name="close" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          ) : (
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.gray} />
          )}
        </View>
        <View style={styles.userSection}>
          {isLoadingProfile ? (
            <View style={styles.loadingProfileSection}>
              <Text style={styles.welcomeText}>Loading...</Text>
            </View>
          ) : userProfile ? (
            <Text style={styles.welcomeText}>
              Hi, {userProfile.firstName}!
            </Text>
          ) : (
            <View style={styles.noProfileSection}>
              <Text style={styles.welcomeText}>
                Hi, User!
              </Text>
              <TouchableOpacity 
                style={styles.createProfileBtn}
                onPress={() => navigation.navigate('Signup')}
              >
                <Text style={styles.createProfileText}>Complete Profile</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.teal} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsRow}>
        {CATEGORY_TABS.map((tab) => (
          <TouchableOpacity 
            key={tab.key} 
            style={[
              styles.tabBtn, 
              selectedCategory === tab.key && styles.tabBtnActive
            ]}
            onPress={() => handleCategoryChange(tab.key)}
          >
            <Text style={[
              styles.tabText, 
              selectedCategory === tab.key && styles.tabTextActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Listings Grid */}
      {isLoadingListings ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.loadingText}>Loading listings...</Text>
        </View>
      ) : (
        <FlatList
          key={`grid-${columns}-${selectedCategory}`}
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={columns}
          contentContainerStyle={[
            styles.listContent, 
            { 
              paddingHorizontal: horizontalPadding, 
              gap, 
              paddingBottom: listBottomPad,
              flexGrow: 1
            }
          ]}
          columnWrapperStyle={{ gap }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.teal]}
              tintColor={COLORS.teal}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Bottom bar */}
      <View style={[styles.tabbar, { height: barHeight, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8 }]}>
        {/* Left side */}
        <View style={styles.tabGroup}>
          {TABS.slice(0,2).map((t) => (
            <View key={t.key} style={styles.tabItem}>
              <MaterialCommunityIcons name={t.icon} size={iconSize} color={t.key === 'explore' ? COLORS.teal : COLORS.gray} />
              <Text style={[styles.tabItemText, { fontSize: labelSize, color: t.key === 'explore' ? COLORS.teal : COLORS.gray }]}>{t.label}</Text>
            </View>
          ))}
        </View>
        {/* Spacer for FAB */}
        <View style={{ width: centerSpacerWidth }} />
        {/* Right side */}
        <View style={styles.tabGroup}>
          {TABS.slice(2).map((t) => (
            <View key={t.key} style={styles.tabItem}>
              <MaterialCommunityIcons name={t.icon} size={iconSize} color={COLORS.gray} />
              <Text style={[styles.tabItemText, { fontSize: labelSize, color: COLORS.gray }]}>{t.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.fab,
          {
            width: fabSize,
            height: fabSize,
            borderRadius: fabRadius,
            left: width / 2 - fabRadius,
            bottom: Math.max(insets.bottom, 10) + 16,
            zIndex: 20,
          },
        ]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('NewListing')}
      >
        <MaterialCommunityIcons name="plus" size={isSmall ? 26 : 28} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: Platform.OS === 'ios' ? 48 : 24, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 36, height: 36, resizeMode: 'contain' },
  searchBox: { flex: 1, height: 36, marginHorizontal: 12, backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2 },
  searchInput: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: COLORS.dark },
  userSection: { alignItems: 'flex-end' },
  welcomeText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: COLORS.teal, marginBottom: 4 },
  logoutBtn: { padding: 4 },
  noProfileSection: { alignItems: 'flex-end' },
  createProfileBtn: { 
    backgroundColor: COLORS.orange, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12, 
    marginTop: 4 
  },
  createProfileText: { 
    color: COLORS.white, 
    fontSize: 10, 
    fontFamily: 'Poppins-Bold' 
  },
  loadingProfileSection: { alignItems: 'flex-end' },
  // testPermissionsBtn: { 
  //   backgroundColor: COLORS.teal, 
  //   paddingHorizontal: 8, 
  //   paddingVertical: 4, 
  //   borderRadius: 12, 
  //   marginTop: 8 
  // },
  // testPermissionsText: { 
  //   color: COLORS.white, 
  //   fontSize: 10, 
  //   fontFamily: 'Poppins-Bold' 
  // },
  // testRulesBtn: { 
  //   backgroundColor: COLORS.orange, 
  //   paddingHorizontal: 8, 
  //   paddingVertical: 4, 
  //   borderRadius: 12, 
  //   marginTop: 8 
  // },
  // testRulesText: { 
  //   color: COLORS.white, 
  //   fontSize: 10, 
  //   fontFamily: 'Poppins-Bold' 
  // },
  // testWritePermissionsBtn: { 
  //   backgroundColor: COLORS.teal, 
  //   paddingHorizontal: 8, 
  //   paddingVertical: 4, 
  //   borderRadius: 12, 
  //   marginTop: 8 
  // },
  // testWritePermissionsText: { 
  //   color: COLORS.white, 
  //   fontSize: 10, 
  //   fontFamily: 'Poppins-Bold' 
  // },


  tabsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 },
  tabBtnActive: { backgroundColor: COLORS.white },
  tabText: { fontFamily: 'Poppins-Regular', color: COLORS.teal, fontSize: 12, opacity: 0.8 },
  tabTextActive: { fontFamily: 'Poppins-Bold', opacity: 1 },

  listContent: {},

  card: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3 },
  imageWrapper: { width: '100%', aspectRatio: 1, backgroundColor: '#EEE' },
  image: { width: '100%', height: '100%' },
  badgeTime: { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.white, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  badgeTimeTop: { fontFamily: 'Poppins-Bold', color: COLORS.orange, fontSize: 10, lineHeight: 12 },
  badgeTimeBottom: { fontFamily: 'Poppins-Bold', color: COLORS.orange, fontSize: 10, lineHeight: 12 },
  likeBtn: { position: 'absolute', right: 8, top: 8, backgroundColor: COLORS.white, borderRadius: 12, padding: 4 },

  cardBody: { paddingHorizontal: 10, paddingVertical: 8 },
  title: { fontFamily: 'Poppins-Regular', fontSize: 12, color: COLORS.dark },
  priceRow: { marginTop: 6 },
  price: { fontFamily: 'Poppins-Bold', color: COLORS.orange, fontSize: 12 },
  dot: { color: COLORS.gray },
  tag: { fontFamily: 'Poppins-Regular', color: COLORS.teal, fontSize: 12 },
  description: { fontFamily: 'Poppins-Regular', fontSize: 10, color: COLORS.dark, opacity: 0.7, marginTop: 4 },

  cardFooter: { paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontFamily: 'Poppins-Bold', fontSize: 10 },
  seller: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 11, color: COLORS.dark, opacity: 0.8 },

  tabbar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: -2 }, shadowRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  tabGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabItemText: { fontFamily: 'Poppins-Regular', color: COLORS.teal, opacity: 0.9 },

  fab: { position: 'absolute', backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 20 
  },
  loadingText: { 
    marginTop: 10, 
    fontFamily: 'Poppins-Regular', 
    fontSize: 14, 
    color: COLORS.gray 
  },
  emptyState: { 
    alignItems: 'center', 
    paddingVertical: 40, 
    paddingHorizontal: 20 
  },
  emptyStateTitle: { 
    fontFamily: 'Poppins-Bold', 
    fontSize: 18, 
    color: COLORS.dark, 
    marginTop: 10 
  },
  emptyStateSubtitle: { 
    fontFamily: 'Poppins-Regular', 
    fontSize: 12, 
    color: COLORS.gray, 
    marginTop: 5, 
    textAlign: 'center' 
  },
  clearSearchBtn: { 
    backgroundColor: COLORS.teal, 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 12, 
    marginTop: 15 
  },
  clearSearchText: { 
    color: COLORS.white, 
    fontFamily: 'Poppins-Bold', 
    fontSize: 12 
  },
  noImagePlaceholder: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#F0F0F0' 
  },
  noImageText: { 
    fontFamily: 'Poppins-Regular', 
    fontSize: 12, 
    color: COLORS.gray, 
    marginTop: 5 
  },
});
