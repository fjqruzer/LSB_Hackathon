import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, Platform, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';

const PeopleScreen = () => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
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

  const featuredUsers = [
    {
      id: 1,
      name: "Sarah Johnson",
      username: "@sarahj",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      followers: "2.3K",
      itemsSold: 45,
      rating: 4.9,
      isVerified: true,
    },
    {
      id: 2,
      name: "Mike Chen",
      username: "@mikechen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      followers: "1.8K",
      itemsSold: 32,
      rating: 4.8,
      isVerified: false,
    },
    {
      id: 3,
      name: "Emma Rodriguez",
      username: "@emmar",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      followers: "3.1K",
      itemsSold: 67,
      rating: 4.9,
      isVerified: true,
    },
  ];

  const topSellers = [
    {
      id: 1,
      name: "Alex Thompson",
      username: "@alexthompson",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      sales: "127 items",
      rating: 4.9,
    },
    {
      id: 2,
      name: "Lisa Park",
      username: "@lisapark",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
      sales: "98 items",
      rating: 4.8,
    },
    {
      id: 3,
      name: "David Kim",
      username: "@davidkim",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
      sales: "89 items",
      rating: 4.7,
    },
  ];

  // Extended user database for search
  const allUsers = [
    ...featuredUsers,
    ...topSellers.map(seller => ({
      ...seller,
      followers: "1.5K",
      itemsSold: parseInt(seller.sales),
      isVerified: false,
    })),
    {
      id: 4,
      name: "Maria Santos",
      username: "@mariasantos",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      followers: "1.2K",
      itemsSold: 28,
      rating: 4.6,
      isVerified: false,
    },
    {
      id: 5,
      name: "John Dela Cruz",
      username: "@johndelacruz",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      followers: "890",
      itemsSold: 15,
      rating: 4.5,
      isVerified: false,
    },
    {
      id: 6,
      name: "Anna Rodriguez",
      username: "@annarodriguez",
      avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=face",
      followers: "2.1K",
      itemsSold: 42,
      rating: 4.8,
      isVerified: true,
    },
    {
      id: 7,
      name: "Carlos Mendoza",
      username: "@carlosmendoza",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
      followers: "1.5K",
      itemsSold: 33,
      rating: 4.7,
      isVerified: false,
    },
    {
      id: 8,
      name: "Sofia Garcia",
      username: "@sofiagarcia",
      avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=100&h=100&fit=crop&crop=face",
      followers: "3.2K",
      itemsSold: 78,
      rating: 4.9,
      isVerified: true,
    },
  ];

  // Search functionality
  const filteredUsers = allUsers.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = (text) => {
    setSearchQuery(text);
    setIsSearching(text.length > 0);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  const topPadding = insets.top || (Platform.OS === "ios" ? 44 : 0);

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
        <Text style={styles.headerTitle}>People</Text>
        <Text style={styles.headerSubtitle}>Connect with sellers and buyers</Text>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#83AFA7" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people or usernames..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      {isSearching ? (
        <View style={styles.content}>
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsTitle}>
              {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.searchResultCard}>
                <View style={styles.searchResultHeader}>
                  <Image source={{ uri: item.avatar }} style={styles.searchResultAvatar} />
                  {item.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark" size={12} color="white" />
                    </View>
                  )}
                </View>
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName}>{item.name}</Text>
                  <Text style={styles.searchResultUsername}>{item.username}</Text>
                  <View style={styles.searchResultStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="people" size={12} color="#83AFA7" />
                      <Text style={styles.statText}>{item.followers || 'N/A'}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="bag" size={12} color="#83AFA7" />
                      <Text style={styles.statText}>{item.itemsSold || item.sales || 'N/A'}</Text>
                    </View>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={12} color="#F68652" />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.followButton}>
                  <Text style={styles.followButtonText}>Follow</Text>
                </TouchableOpacity>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.searchResultsContent}
          />
        </View>
      ) : (
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        {/* Featured Sellers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Sellers</Text>
          <View style={styles.featuredCard}>
            <Image 
              source={{ uri: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=300&h=200&fit=crop" }}
              style={styles.featuredImage}
            />
            <View style={styles.featuredContent}>
              <Text style={styles.featuredTitle}>Top Sellers This Week</Text>
              <Text style={styles.featuredDescription}>Discover the most trusted sellers in your area</Text>
              <TouchableOpacity style={styles.featuredButton}>
                <Text style={styles.featuredButtonText}>View All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Featured Users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Users</Text>
          <View style={styles.usersGrid}>
            {featuredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
                  {user.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark" size={12} color="white" />
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userUsername}>{user.username}</Text>
                  <View style={styles.userStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="people" size={12} color="#83AFA7" />
                      <Text style={styles.statText}>{user.followers}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="bag" size={12} color="#83AFA7" />
                      <Text style={styles.statText}>{user.itemsSold}</Text>
                    </View>
                  </View>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={12} color="#F68652" />
                    <Text style={styles.ratingText}>{user.rating}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.followButton}>
                  <Text style={styles.followButtonText}>Follow</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Top Sellers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Sellers</Text>
          <View style={styles.sellersList}>
            {topSellers.map((seller, index) => (
              <TouchableOpacity key={seller.id} style={styles.sellerCard}>
                <View style={styles.sellerRank}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                </View>
                <Image source={{ uri: seller.avatar }} style={styles.sellerAvatar} />
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerName}>{seller.name}</Text>
                  <Text style={styles.sellerUsername}>{seller.username}</Text>
                  <Text style={styles.sellerSales}>{seller.sales}</Text>
                </View>
                <View style={styles.sellerRating}>
                  <Ionicons name="star" size={14} color="#F68652" />
                  <Text style={styles.sellerRatingText}>{seller.rating}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Community Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community</Text>
          <View style={styles.communityGrid}>
            {[
              { icon: 'chatbubbles-outline', title: 'Discussions', subtitle: 'Join conversations' },
              { icon: 'trophy-outline', title: 'Leaderboard', subtitle: 'Top contributors' },
              { icon: 'calendar-outline', title: 'Events', subtitle: 'Local meetups' },
              { icon: 'help-circle-outline', title: 'Support', subtitle: 'Get help' },
            ].map((feature, index) => (
              <TouchableOpacity key={index} style={styles.communityCard}>
                <View style={styles.communityIcon}>
                  <Ionicons name={feature.icon} size={24} color="#83AFA7" />
                </View>
                <Text style={styles.communityTitle}>{feature.title}</Text>
                <Text style={styles.communitySubtitle}>{feature.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        </ScrollView>
      )}
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
  featuredCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  featuredImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  featuredContent: {
    padding: 20,
  },
  featuredTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  featuredDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 16,
  },
  featuredButton: {
    backgroundColor: '#F68652',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  featuredButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  usersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  userCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userHeader: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    resizeMode: 'cover',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#83AFA7',
    marginBottom: 8,
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginLeft: 4,
  },
  followButton: {
    backgroundColor: '#83AFA7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
  },
  followButtonText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  sellersList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sellerRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F68652',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankNumber: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
    marginRight: 12,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 2,
  },
  sellerUsername: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#83AFA7',
    marginBottom: 2,
  },
  sellerSales: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#666',
  },
  sellerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerRatingText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginLeft: 4,
  },
  communityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  communityCard: {
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
  communityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  communityTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  communitySubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    textAlign: 'center',
  },
  // Search styles
  searchContainer: {
    marginTop: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#333',
  },
  clearButton: {
    marginLeft: 8,
  },
  // Search results styles
  searchResultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FEF4D8',
  },
  searchResultsTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
  },
  searchResultsContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchResultHeader: {
    position: 'relative',
    marginRight: 16,
  },
  searchResultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    resizeMode: 'cover',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 2,
  },
  searchResultUsername: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#83AFA7',
    marginBottom: 8,
  },
  searchResultStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default PeopleScreen;
