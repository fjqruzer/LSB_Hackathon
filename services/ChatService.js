import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';

class ChatService {
  constructor() {
    this.chatListeners = new Map();
    this.creatingChats = new Map(); // Track chats being created to prevent duplicates
  }

  // Get display price based on listing price type
  getDisplayPrice(listing) {
    if (!listing) return '₱0';
    
    if (listing.priceType === 'msl') {
      return `₱${listing.minePrice || 0}`;
    } else if (listing.priceType === 'bidding') {
      return `₱${listing.currentBid || listing.startingPrice || 0}`;
    } else {
      // Check if price already contains peso sign to avoid double formatting
      const price = listing.price || 0;
      if (typeof price === 'string' && price.includes('₱')) {
        return price; // Already formatted
      }
      return `₱${price}`;
    }
  }

  // Create or get existing chat between two users
  async createOrGetChat(user1Id, user2Id, listing = null) {
    try {
      // Create a unique key for this chat pair (order doesn't matter)
      const chatKey = [user1Id, user2Id].sort().join('-');
      
      // Check if we're already creating this chat
      if (this.creatingChats.has(chatKey)) {
        console.log('Chat creation already in progress, waiting...');
        return await this.creatingChats.get(chatKey);
      }

      // Check if chat already exists
      const existingChat = await this.findExistingChat(user1Id, user2Id);
      if (existingChat) {
        console.log('Found existing chat:', existingChat.id);
        return existingChat;
      }

      console.log('Creating new chat for users:', user1Id, user2Id);
      
      // Create a promise for chat creation and store it
      const chatCreationPromise = this.createNewChat(user1Id, user2Id, listing);
      this.creatingChats.set(chatKey, chatCreationPromise);

      try {
        const chat = await chatCreationPromise;
        console.log('Successfully created chat:', chat.id);
        return chat;
      } finally {
        // Remove from creating cache
        this.creatingChats.delete(chatKey);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  // Helper method to create a new chat
  async createNewChat(user1Id, user2Id, listing = null) {
    const chatData = {
      participants: [user1Id, user2Id],
      createdAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
      lastMessage: '',
      lastMessageTime: null,
      unreadCount: {
        [user1Id]: 0,
        [user2Id]: 0,
      },
      listing: listing ? {
        id: listing.id,
        title: listing.title,
        price: this.getDisplayPrice(listing),
        image: listing.images?.[0] || listing.image,
      } : null,
    };

    const chatRef = await addDoc(collection(db, 'chats'), chatData);
    
    return {
      id: chatRef.id,
      ...chatData,
    };
  }

  // Find existing chat between two users
  async findExistingChat(user1Id, user2Id) {
    try {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user1Id)
      );

      const snapshot = await getDocs(chatsQuery);
      
      for (const doc of snapshot.docs) {
        const chatData = doc.data();
        if (chatData.participants.includes(user2Id)) {
          return {
            id: doc.id,
            ...chatData,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding existing chat:', error);
      return null;
    }
  }

  // Send a message
  async sendMessage(chatId, senderId, text, messageType = 'text') {
    try {
      const messageData = {
        senderId,
        text,
        type: messageType,
        timestamp: serverTimestamp(),
        read: false,
      };

      const messageRef = await addDoc(
        collection(db, 'chats', chatId, 'messages'),
        messageData
      );

      // Update chat metadata
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        lastActivity: serverTimestamp(),
      });

      return {
        id: messageRef.id,
        ...messageData,
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Mark messages as read
  async markMessagesAsRead(chatId, userId) {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`unreadCount.${userId}`]: 0,
        lastActivity: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // Get chat messages
  getChatMessages(chatId, callback) {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(messages);
    });

    this.chatListeners.set(chatId, unsubscribe);
    return unsubscribe;
  }

  // Get user's chats
  getUserChats(userId, callback) {
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chats = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const chatData = doc.data();
          const otherUserId = chatData.participants.find(id => id !== userId);
          
          // Get other user's info
          let otherUser = { id: otherUserId, name: 'Unknown User', avatar: null, isOnline: false };
          if (otherUserId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', otherUserId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                otherUser = {
                  id: otherUserId,
                  name: userData.displayName || userData.name || 'Unknown User',
                  avatar: userData.photoURL || userData.avatar,
                  isOnline: userData.isOnline || false,
                  lastSeen: userData.lastSeen,
                };
              }
            } catch (error) {
              console.error('Error fetching user data:', error);
            }
          }

          return {
            id: doc.id,
            ...chatData,
            otherUser,
            unreadCount: chatData.unreadCount?.[userId] || 0,
          };
        })
      );

      // Sort by lastActivity in JavaScript
      const sortedChats = chats.sort((a, b) => {
        const aTime = a.lastActivity?.toDate ? a.lastActivity.toDate() : new Date(a.lastActivity || 0);
        const bTime = b.lastActivity?.toDate ? b.lastActivity.toDate() : new Date(b.lastActivity || 0);
        return bTime - aTime; // Descending order (most recent first)
      });

      callback(sortedChats);
    });

    return unsubscribe;
  }

  // Create chat from listing action
  async createChatFromAction(listingId, actionType, actorId, actorName, listingData) {
    try {
      // Get listing seller
      const sellerId = listingData.sellerId || listingData.userId;
      if (!sellerId || sellerId === actorId) {
        console.log('Cannot create chat: seller and actor are the same');
        return null;
      }

      // Create chat
      const chat = await this.createOrGetChat(actorId, sellerId, listingData);
      
      // Send initial message based on action type
      let initialMessage = '';
      switch (actionType) {
        case 'mine':
          initialMessage = `Hi! I'm interested in "${listingData.title}". Can we discuss the details?`;
          break;
        case 'steal':
          initialMessage = `I'd like to steal this "${listingData.title}"! Let's talk about it.`;
          break;
        case 'lock':
          initialMessage = `I've locked "${listingData.title}"! Ready to proceed with payment.`;
          break;
        case 'bid':
          initialMessage = `I placed a bid on "${listingData.title}". Let's discuss the terms.`;
          break;
        default:
          initialMessage = `Hi! I'm interested in "${listingData.title}". Can we discuss?`;
      }

      // Send initial message
      await this.sendMessage(chat.id, actorId, initialMessage);

      return chat;
    } catch (error) {
      console.error('Error creating chat from action:', error);
      return null;
    }
  }

  // Send system message
  async sendSystemMessage(chatId, message, messageType = 'system') {
    try {
      const messageData = {
        senderId: 'system',
        text: message,
        type: messageType,
        timestamp: serverTimestamp(),
        read: false,
      };

      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

      // Update chat metadata
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: message,
        lastMessageTime: serverTimestamp(),
        lastActivity: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  }

  // Clean up listeners
  cleanup() {
    this.chatListeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.chatListeners.clear();
  }
}

export default new ChatService();
