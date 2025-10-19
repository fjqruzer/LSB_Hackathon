import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ChatService from '../services/ChatService';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const ChatScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDarkMode, colors } = useTheme();
  const { chatId, otherUser, listing } = route.params;
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  // Map and location state
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [selectedPin, setSelectedPin] = useState(null); // { latitude, longitude }
  const [gettingLocation, setGettingLocation] = useState(false);
  const [liveSharing, setLiveSharing] = useState(false);
  const liveWatcherRef = useRef(null);
  const [liveLocations, setLiveLocations] = useState({}); // userId -> { latitude, longitude, updatedAt }

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

  // Load messages
  useEffect(() => {
    if (!chatId) {
      // No chatId means this is a new chat - set loading to false
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(messagesData);
      setLoading(false);
      
      // Auto-scroll to bottom when new messages arrive
      setTimeout(() => {
        if (flatListRef.current && messagesData.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Subscribe to live locations in this chat
  useEffect(() => {
    if (!chatId) return;
    const locRef = collection(db, 'chats', chatId, 'liveLocations');
    const unsub = onSnapshot(locRef, (snapshot) => {
      const map = {};
      snapshot.forEach((docSnap) => {
        map[docSnap.id] = docSnap.data();
      });
      setLiveLocations(map);
    });
    return () => unsub();
  }, [chatId]);

  // Mark messages as read
  useEffect(() => {
    if (messages.length > 0 && user) {
      markMessagesAsRead();
    }
  }, [messages, user]);

  const markMessagesAsRead = async () => {
    try {
      const unreadMessages = messages.filter(
        msg => msg.senderId !== user.uid && !msg.read
      );
      
      if (unreadMessages.length > 0) {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          [`unreadCount.${user.uid}`]: 0,
          lastActivity: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      
      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || user.email,
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        read: false,
        type: 'text',
      };

      let currentChatId = chatId;

      // If no chatId, create a new chat first
      if (!currentChatId) {
        console.log('🔄 Creating new chat for first message');
        const chat = await ChatService.createOrGetChat(user.uid, otherUser.id, listing);
        if (!chat) {
          throw new Error('Failed to create chat');
        }
        currentChatId = chat.id;
        console.log('✅ Chat created:', currentChatId);
      }

      // First, check if chat document exists
      const chatRef = doc(db, 'chats', currentChatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        // If chat doesn't exist, create it first
        await setDoc(chatRef, {
          participants: [user.uid, otherUser.id],
          createdAt: serverTimestamp(),
          lastActivity: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: null,
          unreadCount: {
            [user.uid]: 0,
            [otherUser.id]: 0,
          },
          listing: listing ? {
            id: listing.id,
            title: listing.title,
            price: ChatService.getDisplayPrice(listing),
            image: listing.image,
          } : null,
        });
      }

      // Add message to subcollection
      await addDoc(collection(db, 'chats', currentChatId, 'messages'), messageData);

      // Update chat metadata
      await updateDoc(chatRef, {
        lastMessage: newMessage.trim(),
        lastMessageTime: serverTimestamp(),
        [`unreadCount.${otherUser.id}`]: (otherUser.unreadCount || 0) + 1,
        lastActivity: serverTimestamp(),
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const sendLocationMessage = async (coordinate) => {
    if (!coordinate || sending) return;
    try {
      setSending(true);
      let currentChatId = chatId;
      if (!currentChatId) {
        const chat = await ChatService.createOrGetChat(user.uid, otherUser.id, listing);
        if (!chat) throw new Error('Failed to create chat');
        currentChatId = chat.id;
      }
      const chatRef = doc(db, 'chats', currentChatId);
      const chatDoc = await getDoc(chatRef);
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [user.uid, otherUser.id],
          createdAt: serverTimestamp(),
          lastActivity: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: null,
          unreadCount: {
            [user.uid]: 0,
            [otherUser.id]: 0,
          },
          listing: listing ? {
            id: listing.id,
            title: listing.title,
            price: ChatService.getDisplayPrice(listing),
            image: listing.image,
          } : null,
        });
      }
      await addDoc(collection(db, 'chats', currentChatId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || user.email,
        type: 'location',
        coordinate,
        timestamp: serverTimestamp(),
        read: false,
      });
      await updateDoc(chatRef, {
        lastMessage: '[Location]',
        lastMessageTime: serverTimestamp(),
        [`unreadCount.${otherUser.id}`]: (otherUser.unreadCount || 0) + 1,
        lastActivity: serverTimestamp(),
      });
      setShowMapModal(false);
      setSelectedPin(null);
    } catch (e) {
      console.error('Error sending location:', e);
      Alert.alert('Error', 'Failed to send location. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const ensureLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Location permission is required.');
      return false;
    }
    return true;
  };

  const openMapModal = async () => {
    const ok = await ensureLocationPermission();
    if (!ok) return;
    try {
      setGettingLocation(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMapRegion((prev) => ({
        ...prev,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }));
    } catch (e) {
      // keep default
    } finally {
      setGettingLocation(false);
      setShowMapModal(true);
    }
  };

  const toggleLiveLocation = async () => {
    if (!liveSharing) {
      const ok = await ensureLocationPermission();
      if (!ok) return;
      try {
        const watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
          async (pos) => {
            try {
              if (!chatId) return; // require existing chat
              await setDoc(doc(db, 'chats', chatId, 'liveLocations', user.uid), {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                updatedAt: Date.now(),
              });
            } catch (err) {
              // ignore transient
            }
          }
        );
        liveWatcherRef.current = watcher;
        setLiveSharing(true);
      } catch (e) {
        Alert.alert('Error', 'Unable to start live location.');
      }
    } else {
      try {
        if (liveWatcherRef.current) {
          liveWatcherRef.current.remove();
          liveWatcherRef.current = null;
        }
        if (chatId) {
          await updateDoc(doc(db, 'chats', chatId, 'liveLocations', user.uid), { stoppedAt: Date.now() }).catch(() => {});
        }
      } finally {
        setLiveSharing(false);
      }
    }
  };

  const sendQuickMessage = async (message) => {
    setNewMessage(message);
    await sendMessage();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === user.uid;
    if (item.type === 'listing' && item.listing) {
      return (
        <View style={[
          styles.messageContainer,
          isMe ? styles.myMessage : styles.otherMessage
        ]}>
          <View style={[
            styles.listingBubble,
            isMe ? styles.myBubble : styles.otherBubble,
          ]}>
            <View style={styles.listingCardMsg}>
              {item.listing.image ? (
                <Image source={{ uri: item.listing.image }} style={styles.listingMsgImage} />
              ) : (
                <View style={[styles.listingMsgImage, { backgroundColor: '#EEE' }]} />
              )}
              <View style={styles.listingMsgInfo}>
                <Text style={[styles.listingMsgTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.listing.title}
                </Text>
                {item.listing.price ? (
                  <Text style={[styles.listingMsgPrice, { color: colors.accent }]}>
                    {item.listing.price}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      );
    }
    if (item.type === 'location' && item.coordinate) {
      return (
        <View style={[
          styles.messageContainer,
          isMe ? styles.myMessage : styles.otherMessage
        ]}>
          <View style={[
            styles.locationBubble,
            isMe ? styles.myBubble : styles.otherBubble,
          ]}>
            <View style={styles.locationPreview}>
              <MapView
                style={styles.locationMap}
                initialRegion={{
                  latitude: item.coordinate.latitude,
                  longitude: item.coordinate.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                pointerEvents="none"
              >
                <Marker coordinate={item.coordinate} />
              </MapView>
            </View>
            <TouchableOpacity
              style={[styles.openMapButton, { backgroundColor: colors.accent }]}
              onPress={() => {
                setMapRegion({
                  latitude: item.coordinate.latitude,
                  longitude: item.coordinate.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
                setSelectedPin(item.coordinate);
                setShowMapModal(true);
              }}
            >
              <Ionicons name="map" size={14} color="white" />
              <Text style={styles.openMapText}>Open Map</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    return (
      <View style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isMe ? styles.myBubble : styles.otherBubble,
          { backgroundColor: isMe ? colors.accent : '#F5F5F5' }
        ]}>
          <Text style={[
            styles.messageText,
            { color: isMe ? 'white' : '#333' },
            { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            { color: isMe ? 'rgba(255,255,255,0.7)' : '#666' },
            { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderQuickActions = () => {
    const quickMessages = [
      "Hi! I'm interested in this item",
      "Is this still available?",
      "Can we discuss the price?",
      "When can I pick this up?",
      "Payment sent, please confirm",
    ];

    return (
      <View style={styles.quickActionsContainer}>
        <Text style={[
          styles.quickActionsTitle,
          { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
        ]}>
          Quick Messages
        </Text>
        <View style={styles.quickActionsGrid}>
          {quickMessages.map((message, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.quickActionButton, { backgroundColor: colors.accent }]}
              onPress={() => sendQuickMessage(message)}
            >
              <Text style={[
                styles.quickActionText,
                { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
              ]}>
                {message}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
          Loading messages...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Image 
            source={{ uri: otherUser.avatar || 'https://via.placeholder.com/50' }} 
            style={styles.avatar}
          />
          <View style={styles.headerText}>
            <Text style={[
              styles.headerName,
              { color: colors.text },
              { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
            ]}>
              {otherUser.name}
            </Text>
            <Text style={[
              styles.headerStatus,
              { color: colors.textSecondary },
              { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
            ]}>
              {otherUser.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreButton} onPress={openMapModal}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Listing Context */}
      {listing && (
        <View style={[styles.listingContext, { backgroundColor: colors.secondary }]}>
          <Image source={{ uri: listing.image }} style={styles.listingImage} />
          <View style={styles.listingInfo}>
            <Text style={[
              styles.listingTitle,
              { color: colors.text },
              { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }
            ]}>
              {listing.title}
            </Text>
            <Text style={[
              styles.listingPrice,
              { color: colors.accent },
              { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }
            ]}>
              {ChatService.getDisplayPrice(listing)}
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Quick Actions */}
      {messages.length === 0 && renderQuickActions()}

      {/* Message Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.secondary, paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={[
            styles.textInput,
            { 
              backgroundColor: colors.inputBackground,
              color: colors.text,
              borderColor: colors.border
            },
            { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }
          ]}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: colors.accent },
            (!newMessage.trim() || sending) && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={20} color="white" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.accent }]}
          onPress={openMapModal}
        >
          <Ionicons name="pin" size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* Map Modal for pinning and viewing */}
      <Modal
        visible={showMapModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowMapModal(false);
          setSelectedPin(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mapModal}>
            <View style={[styles.modalHeader, { borderBottomColor: '#E0E0E0' }]}>
              <Text style={[styles.modalTitle, { fontFamily: fontsLoaded ? 'Poppins-SemiBold' : undefined }]}>Meetup Location</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => { setShowMapModal(false); setSelectedPin(null); }}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={mapRegion}
                region={mapRegion}
                onRegionChangeComplete={setMapRegion}
                onPress={(e) => setSelectedPin(e.nativeEvent.coordinate)}
              >
                {selectedPin && (<Marker coordinate={selectedPin} />)}
                {Object.entries(liveLocations).map(([uid, loc]) => (
                  <Marker
                    key={uid}
                    coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                    pinColor={uid === user.uid ? 'green' : 'red'}
                    title={uid === user.uid ? 'You' : otherUser.name || 'Participant'}
                  />
                ))}
              </MapView>
              {gettingLocation && (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator size="large" color="#83AFA7" />
                  <Text style={styles.mapLoadingText}>Fetching your location…</Text>
                </View>
              )}
            </View>
            <View style={[styles.modalActions, { borderTopColor: '#E0E0E0' }]}> 
              <TouchableOpacity
                style={[styles.modalActionButton, styles.rejectButton]}
                onPress={async () => {
                  const ok = await ensureLocationPermission();
                  if (!ok) return;
                  try {
                    setGettingLocation(true);
                    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    setMapRegion((prev) => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                  } finally {
                    setGettingLocation(false);
                  }
                }}
              >
                <Ionicons name="locate" size={16} color="white" />
                <Text style={styles.modalActionText}>My Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!selectedPin}
                style={[styles.modalActionButton, styles.approveButton, { opacity: selectedPin ? 1 : 0.5 }]}
                onPress={() => selectedPin && sendLocationMessage(selectedPin)}
              >
                <Ionicons name="checkmark" size={16} color="white" />
                <Text style={styles.modalActionText}>Send Pin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#83AFA7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#DFECE2',
    ...(Platform.OS === 'android' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 11,
    marginTop: 1,
  },
  moreButton: {
    padding: 4,
  },
  listingContext: {
    flexDirection: 'row',
    padding: 8,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F0F8F5',
    borderLeftWidth: 2,
    borderLeftColor: '#83AFA7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  listingImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },
  listingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  listingTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
  },
  messageContainer: {
    marginBottom: 8,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 3,
    textAlign: 'right',
  },
  quickActionsContainer: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
  },
  quickActionsTitle: {
    fontSize: 12,
    color: '#83AFA7',
    marginBottom: 8,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 6,
    backgroundColor: '#83AFA7',
  },
  quickActionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    ...(Platform.OS === 'android' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 80,
    fontSize: 14,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  // Map modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  mapModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  mapContainer: {
    height: 350,
    width: '100%',
    backgroundColor: '#EEE',
  },
  map: {
    flex: 1,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)'
  },
  mapLoadingText: {
    marginTop: 8,
    color: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: 'white',
    gap: 10,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  approveButton: {
    backgroundColor: '#83AFA7',
  },
  rejectButton: {
    backgroundColor: '#F68652',
  },
  modalActionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Location message preview
  locationBubble: {
    maxWidth: '80%',
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
  },
  locationPreview: {
    width: 220,
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
  },
  locationMap: {
    flex: 1,
  },
  openMapButton: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
  },
  openMapText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Listing message styles
  listingBubble: {
    maxWidth: '80%',
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
  },
  listingCardMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 260,
  },
  listingMsgImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 10,
  },
  listingMsgInfo: {
    flex: 1,
  },
  listingMsgTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  listingMsgPrice: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default ChatScreen;
