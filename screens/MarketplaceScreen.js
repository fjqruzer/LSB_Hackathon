import React, { useState, useEffect } from 'react'
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Image,
    TouchableOpacity,
    StatusBar,
    Platform,
    ActivityIndicator,
    RefreshControl,
  } from "react-native"
  import { Ionicons } from "@expo/vector-icons"
  import Constants from "expo-constants"
  import { useSafeAreaInsets } from "react-native-safe-area-context"
  import { useFonts } from 'expo-font'
  import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
  import { db } from '../config/firebase'
  
  const Marketplace = () => {
    const insets = useSafeAreaInsets()
    
    // Load Poppins fonts
    const [fontsLoaded] = useFonts({
      'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
      'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
      'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
      'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    })
    
    // State management
    const [listings, setListings] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [activeTab, setActiveTab] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    
    // Use safe area insets for proper padding on all devices, with fallbacks
    const topPadding = insets.top || (Platform.OS === "ios" ? Constants.statusBarHeight : 0)

    // Fetch listings from Firestore
    useEffect(() => {
      const fetchListings = () => {
        try {
          // Simple query without composite index - just get all listings
          const q = query(collection(db, 'listings'))
          
          const unsubscribe = onSnapshot(q, (snapshot) => {
            const listingsData = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              .filter(listing => listing.status === 'active') // Filter in JavaScript instead
              .sort((a, b) => {
                // Sort by createdAt in JavaScript instead
                const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt)
                const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt)
                return bTime - aTime // Descending order (newest first)
              })
            
            setListings(listingsData)
            setLoading(false)
            setRefreshing(false)
          }, (error) => {
            console.error('Error fetching listings:', error)
            setLoading(false)
            setRefreshing(false)
          })
          
          return unsubscribe
        } catch (error) {
          console.error('Error setting up listings listener:', error)
          setLoading(false)
          setRefreshing(false)
        }
      }
      
      const unsubscribe = fetchListings()
      return () => {
        if (unsubscribe) {
          unsubscribe()
        }
      }
    }, [])

    // Filter listings based on active tab and search
    const filteredListings = listings.filter(listing => {
      let matchesTab = false
      
      switch (activeTab) {
        case 'all':
          matchesTab = true
          break
        case 'msl':
          matchesTab = listing.priceType === 'msl'
          break
        case 'bidding':
          matchesTab = listing.priceType === 'bidding'
          break
        case 'following':
          // For now, show all listings. In the future, this would filter by followed users
          matchesTab = true
          break
        case 'locale':
          // For now, show all listings. In the future, this would filter by location
          matchesTab = true
          break
        default:
          matchesTab = true
      }
      
      const matchesSearch = !searchQuery || 
                           listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           listing.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           listing.brand.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesTab && matchesSearch
    })

    // Helper functions
    const formatTimeLeft = (endDateTime) => {
      const now = new Date()
      const end = endDateTime.toDate()
      const diff = end - now
      
      if (diff <= 0) {
        return 'Ended'
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      
      if (days > 0) {
        return `${days}d left`
      } else if (hours > 0) {
        return `${hours}h left`
      } else if (minutes > 0) {
        return `${minutes}m left`
      } else {
        return 'Ending soon'
      }
    }

    const getDisplayPrice = (listing) => {
      if (listing.priceType === 'msl') {
        return `PHP ${listing.minePrice}`
      } else {
        return `PHP ${listing.currentBid || listing.startingPrice}`
      }
    }

    const getStatusText = (listing) => {
      return listing.priceType === 'msl' ? 'M-S-L' : 'Bidding'
    }

    const onRefresh = () => {
      setRefreshing(true)
      // The useEffect will handle the refresh
    }

    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <StatusBar 
          style="dark" 
          backgroundColor="#DFECE2"
          translucent={Platform.OS === "android"}
          barStyle="dark-content"
          animated={true}
          hidden={false}
        />

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={{
              uri: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-uzcx2rUT6ee8nzIBhYHxhd0BdCkXUF.png",
            }}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#83AFA7" style={styles.searchIcon} />
            <TextInput 
              style={[styles.searchInput, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]} 
              placeholder="Search Item" 
              placeholderTextColor="#83AFA7"
              multiline={false}
              textAlign="left"
              textAlignVertical="center"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="heart-outline" size={24} color="#83AFA7" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="chatbubble-outline" size={24} color="#83AFA7" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Navigation Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabScrollContainer}
          contentContainerStyle={styles.tabContainer}
        >
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>Top picks</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'bidding' && styles.activeTab]}
            onPress={() => setActiveTab('bidding')}
          >
            <Text style={[styles.tabText, activeTab === 'bidding' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Bidding</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'msl' && styles.activeTab]}
            onPress={() => setActiveTab('msl')}
          >
            <Text style={[styles.tabText, activeTab === 'msl' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>MSL</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'following' && styles.activeTab]}
            onPress={() => setActiveTab('following')}
          >
            <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'locale' && styles.activeTab]}
            onPress={() => setActiveTab('locale')}
          >
            <Text style={[styles.tabText, activeTab === 'locale' && styles.activeTabText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>Locale</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Product Grid */}
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
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#83AFA7" />
              <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                Loading listings...
              </Text>
            </View>
          ) : filteredListings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={64} color="#83AFA7" />
              <Text style={[styles.emptyText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                {searchQuery ? 'No listings found for your search' : 'No listings available'}
              </Text>
              <Text style={[styles.emptySubtext, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                {searchQuery ? 'Try adjusting your search terms' : 'Be the first to post a listing!'}
              </Text>
            </View>
          ) : (
          <View style={styles.productGrid}>
              {filteredListings.map((listing) => (
                <View key={listing.id} style={styles.productCard}>
                <View style={styles.productImageContainer}>
                    <Image 
                      source={{ uri: listing.images && listing.images[0] ? listing.images[0] : 'https://via.placeholder.com/200x200?text=No+Image' }} 
                      style={styles.productImage} 
                    />
                  <TouchableOpacity style={styles.favoriteButton}>
                    <Ionicons name="heart-outline" size={20} color="#83AFA7" />
                  </TouchableOpacity>
                  <View style={styles.timeLeftBadge}>
                      <Text style={[styles.timeLeftText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                        {formatTimeLeft(listing.endDateTime)}
                      </Text>
                  </View>
                </View>

                <View style={styles.productInfo}>
                    <Text style={[styles.productTitle, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      {listing.title}
                    </Text>
                  <View style={styles.priceRow}>
                      <Text style={[styles.price, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                        {getDisplayPrice(listing)}
                      </Text>
                      <Text style={[styles.status, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        • {getStatusText(listing)}
                      </Text>
                  </View>

                  <View style={styles.userRow}>
                      <View style={styles.userAvatarPlaceholder}>
                        <Text style={[styles.userAvatarText, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                          {listing.sellerName ? listing.sellerName.charAt(0).toUpperCase() : 'A'}
                        </Text>
                      </View>
                      <Text style={[styles.userName, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                        {listing.sellerName || 'Anonymous'}
                      </Text>
                    <TouchableOpacity style={styles.moreButton}>
                      <Ionicons name="ellipsis-vertical" size={16} color="#83AFA7" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
          )}
        </ScrollView>
      </View>
    )
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#DFECE2",
      ...(Platform.OS === "android" && {
        // Ensure proper handling on Android when app goes to background and returns
        elevation: 0,
      }),
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: "#DFECE2",
      ...(Platform.OS === "android" && {
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      }),
    },
    logo: {
      width: 40,
      height: 30,
      marginRight: 12,
    },
    searchContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "white",
      borderRadius: 20,
      paddingHorizontal: 12,
      marginRight: 12,
      height: 40,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      height: 40,
      fontSize: 14,
      color: "#333",
      fontFamily: "Poppins-Regular",
      paddingHorizontal: 0,
      paddingVertical: 0,
      margin: 0,
      textAlignVertical: "center",
      ...(Platform.OS === 'ios' && {
        height: 36,
        paddingTop: 2,
        paddingBottom: 2,
      }),
    },
    headerIcons: {
      flexDirection: "row",
    },
    iconButton: {
      marginLeft: 8,
    },
    tabScrollContainer: {
      backgroundColor: "#DFECE2",
      maxHeight: 50,
    },
    tabContainer: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 8,
      alignItems: "center",
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 16,
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: "#F68652",
    },
    tabText: {
      fontSize: 14,
      color: "#83AFA7",
      fontFamily: "Poppins-Medium",
    },
    activeTabText: {
      color: "#F68652",
      fontFamily: "Poppins-SemiBold",
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    productGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    productCard: {
      width: "48%",
      backgroundColor: "white",
      borderRadius: 12,
      marginBottom: 16,
      overflow: "hidden",
    },
    productImageContainer: {
      position: "relative",
    },
    productImage: {
      width: "100%",
      height: 120,
      resizeMode: "cover",
    },
    favoriteButton: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      borderRadius: 20,
      padding: 6,
    },
    timeLeftBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: "#F68652",
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    timeLeftText: {
      color: "white",
      fontSize: 10,
      fontFamily: "Poppins-SemiBold",
    },
    productInfo: {
      padding: 12,
    },
    productTitle: {
      fontSize: 12,
      color: "#333",
      marginBottom: 6,
      lineHeight: 16,
      fontFamily: "Poppins-Medium",
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    price: {
      fontSize: 14,
      fontFamily: "Poppins-SemiBold",
      color: "#F68652",
    },
    status: {
      fontSize: 12,
      color: "#83AFA7",
      marginLeft: 4,
      fontFamily: "Poppins-Regular",
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    userAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 6,
    },
    userName: {
      flex: 1,
      fontSize: 12,
      color: "#666",
      fontFamily: "Poppins-Regular",
    },
    moreButton: {
      padding: 4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: '#83AFA7',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 18,
      color: '#83AFA7',
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: '#666',
      textAlign: 'center',
    },
    userAvatarPlaceholder: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#83AFA7',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    userAvatarText: {
      fontSize: 10,
      color: 'white',
    },
  })
  
  export default Marketplace
  