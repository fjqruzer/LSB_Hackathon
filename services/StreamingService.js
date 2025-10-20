import { Audio, Video } from 'expo-av';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import NotificationManager from './NotificationManager';

class StreamingService {
  constructor() {
    this.isStreaming = false;
    this.currentStream = null;
    this.streamId = null;
    this.viewers = new Set();
    this.chatMessages = [];
    this.streamListeners = new Map();
    this.audioPermission = null;
    this.cameraPermission = null;
    
    // Initialize streaming state on app start
    this.initializeStreamingState();
  }

  // Initialize streaming state (reset any stale state)
  async initializeStreamingState() {
    try {
      console.log('🔄 Initializing streaming state...');
      // Reset state to ensure clean start
      this.isStreaming = false;
      this.currentStream = null;
      this.streamId = null;
      this.viewers.clear();
      console.log('✅ Streaming state initialized');
    } catch (error) {
      console.error('❌ Error initializing streaming state:', error);
    }
  }

  // Request permissions for streaming (VDO Ninja approach)
  async requestPermissions() {
    try {
      console.log('🎥 Requesting streaming permissions...');
      console.log('📦 Audio module:', typeof Audio);
      
      // Check if Audio module is available
      if (!Audio) {
        console.error('❌ Audio module not available');
        throw new Error('Audio module not properly imported');
      }
      
      // Request audio permission only (VDO Ninja handles camera via web)
      let audioPermission;
      try {
        audioPermission = await Audio.requestPermissionsAsync();
      this.audioPermission = audioPermission;
        console.log('🎤 Audio permission status:', audioPermission.status);
      } catch (audioError) {
        console.error('❌ Error requesting audio permission:', audioError);
        throw new Error('Failed to request audio permission');
      }
      
      // For VDO Ninja, we only need audio permission
      const allGranted = audioPermission.status === 'granted';
      
      if (!allGranted) {
        console.log('❌ Streaming permissions not granted');
        console.log('🎤 Audio:', audioPermission.status);
        return false;
      }
      
      console.log('✅ All streaming permissions granted (VDO Ninja mode)');
      return true;
    } catch (error) {
      console.error('❌ Error requesting streaming permissions:', error);
      return false;
    }
  }

  // Start a live stream
  async startStream(listingId, userId, userName, streamTitle, streamDescription) {
    try {
      // Check if we're actually streaming by verifying the stream exists in Firebase
      if (this.isStreaming) {
        console.log('⚠️ isStreaming flag is true, checking if stream actually exists...');
        const streamExists = await this.checkStreamExists(this.streamId);
        if (!streamExists) {
          console.log('🔄 Stream does not exist, resetting streaming state');
          this.isStreaming = false;
          this.currentStream = null;
          this.streamId = null;
        } else {
        throw new Error('Already streaming');
        }
      }

      // Request permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        throw new Error('Streaming permissions not granted');
      }

      console.log('🎥 Starting live stream...');
      
      // Generate unique stream ID
      this.streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('🆔 Generated stream ID:', this.streamId);
      
      // Create stream document in Firebase
      const streamData = {
        id: this.streamId,
        listingId: listingId || null, // Handle undefined listingId
        streamerId: userId,
        streamerName: userName,
        title: streamTitle,
        description: streamDescription,
        status: 'live',
        startTime: serverTimestamp(),
        viewerCount: 0,
        chatEnabled: true,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp()
      };

      console.log('📝 Creating stream document with data:', streamData);
      const streamDocRef = await addDoc(collection(db, 'streams'), streamData);
      console.log('✅ Stream document created with ID:', streamDocRef.id);
      
      // Update listing to show it's being streamed (only if listingId exists)
      if (listingId) {
      await updateDoc(doc(db, 'listings', listingId), {
        isLiveStreaming: true,
        streamId: this.streamId,
        streamStartTime: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
      }

      // Notify followers about the live stream
      await this.notifyFollowersAboutStream(listingId || null, userId, userName, streamTitle);

      this.isStreaming = true;
      this.currentStream = streamData;
      
      console.log('✅ Live stream started successfully:', this.streamId);
      return this.streamId;
      
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      throw error;
    }
  }

  // Stop the current stream
  async stopStream() {
    try {
      if (!this.isStreaming && !this.streamId) {
        console.log('⚠️ No active stream to stop - already stopped or never started');
        return { success: true, message: 'No active stream to stop' };
      }

      console.log('🛑 Stopping live stream...', { isStreaming: this.isStreaming, streamId: this.streamId });
      
      // Check if stream document exists before updating
      const streamRef = doc(db, 'streams', this.streamId);
      const streamDoc = await getDoc(streamRef);
      
      if (streamDoc.exists()) {
      // Update stream status
      await updateDoc(streamRef, {
        status: 'ended',
        endTime: serverTimestamp(),
        finalViewerCount: this.viewers.size,
        lastActivity: serverTimestamp()
      });
        console.log('✅ Stream status updated to ended');
      } else {
        console.log('⚠️ Stream document does not exist, skipping update');
      }

      // Update listing
      if (this.currentStream?.listingId) {
        try {
          const listingRef = doc(db, 'listings', this.currentStream.listingId);
          const listingDoc = await getDoc(listingRef);
          
          if (listingDoc.exists()) {
            await updateDoc(listingRef, {
          isLiveStreaming: false,
          streamId: null,
          lastUpdated: serverTimestamp()
        });
            console.log('✅ Listing updated to not streaming');
          } else {
            console.log('⚠️ Listing document does not exist, skipping update');
          }
        } catch (listingError) {
          console.error('❌ Error updating listing:', listingError);
        }
      }

      // Clear current stream data
      this.isStreaming = false;
      this.currentStream = null;
      this.streamId = null;
      this.viewers.clear();
      this.chatMessages = [];
      
      console.log('✅ Live stream stopped successfully');
      return { success: true, message: 'Stream stopped successfully' };
      
    } catch (error) {
      console.error('❌ Error stopping stream:', error);
      // Don't throw error, just log it and reset state
      this.isStreaming = false;
      this.currentStream = null;
      this.streamId = null;
      this.viewers.clear();
      this.chatMessages = [];
      return { success: false, error: error.message };
    }
  }

  // Join a stream as a viewer
  async joinStream(streamId, userId, userName) {
    try {
      console.log(`👀 User ${userName} joining stream ${streamId}`);
      console.log('🔍 Stream ID details:', {
        streamId,
        type: typeof streamId,
        length: streamId?.length,
        isString: typeof streamId === 'string'
      });
      
      // First check if the stream exists
      const streamExists = await this.checkStreamExists(streamId);
      if (!streamExists) {
        console.log('⚠️ Stream does not exist, cannot join');
        console.log('🔍 Available streams check - let me search for any streams...');
        
        // Let's try to find any streams that might exist
        try {
          const streamsQuery = query(
            collection(db, 'streams'),
            where('status', '==', 'live')
          );
          const streamsSnapshot = await getDocs(streamsQuery);
          console.log('🔍 Found streams:', streamsSnapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
          })));
        } catch (searchError) {
          console.error('❌ Error searching for streams:', searchError);
        }
        
        throw new Error('Stream does not exist');
      }
      
      // Add viewer to the stream
      this.viewers.add(userId);
      
      // Create viewer record
      await addDoc(collection(db, 'streamViewers'), {
        streamId,
        userId,
        userName,
        joinedAt: serverTimestamp(),
        isActive: true
      });

      // Update viewer count
      await this.updateViewerCount(streamId);
      
      // Start listening to stream updates
      this.startListeningToStream(streamId);
      
      console.log('✅ Successfully joined stream');
      
    } catch (error) {
      console.error('❌ Error joining stream:', error);
      throw error;
    }
  }

  // Leave a stream
  async leaveStream(streamId, userId) {
    try {
      console.log(`👋 User ${userId} leaving stream ${streamId}`);
      
      // Remove viewer
      this.viewers.delete(userId);
      
      // Update viewer record
      const viewersQuery = query(
        collection(db, 'streamViewers'),
        where('streamId', '==', streamId),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      // Note: In a real implementation, you'd update the viewer record
      // For now, we'll just update the count
      await this.updateViewerCount(streamId);
      
      // Stop listening to stream if no more viewers
      if (this.viewers.size === 0) {
        this.stopListeningToStream(streamId);
      }
      
      console.log('✅ Successfully left stream');
      
    } catch (error) {
      console.error('❌ Error leaving stream:', error);
      throw error;
    }
  }

  // Send a chat message
  async sendChatMessage(streamId, userId, userName, message) {
    try {
      const messageData = {
        streamId,
        userId,
        userName,
        message: message.trim(),
        timestamp: serverTimestamp(),
        type: 'chat'
      };

      await addDoc(collection(db, 'streamChat'), messageData);
      
      console.log(`💬 Chat message sent by ${userName}: ${message}`);
      
    } catch (error) {
      console.error('❌ Error sending chat message:', error);
      throw error;
    }
  }

  // Get active streams for a listing
  async getActiveStreams(listingId) {
    try {
      // Simple query without orderBy to avoid index requirement
      const streamsQuery = query(
        collection(db, 'streams'),
        where('listingId', '==', listingId),
        where('status', '==', 'live')
      );

      const snapshot = await getDocs(streamsQuery);
      const streams = [];
      
      snapshot.forEach((doc) => {
        streams.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort by startTime on client side
      streams.sort((a, b) => {
        const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
        const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
        return bTime - aTime; // Most recent first
      });
      
      return streams;
    } catch (error) {
      console.error('❌ Error getting active streams:', error);
      return [];
    }
  }

  // Get all live streams
  async getAllLiveStreams() {
    try {
      // Simple query without orderBy to avoid index requirement
      const streamsQuery = query(
        collection(db, 'streams'),
        where('status', '==', 'live')
      );

      const snapshot = await getDocs(streamsQuery);
      const streams = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('🔍 Stream document:', {
          docId: doc.id,
          customId: data.id,
          status: data.status,
          title: data.title
        });
        // Use the custom id field from the document data, not the Firebase doc.id
        streams.push({ 
          id: data.id || doc.id, // Use custom id if available, fallback to doc.id
          ...data 
        });
      });
      
      // Sort by startTime on client side
      streams.sort((a, b) => {
        const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
        const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
        return bTime - aTime; // Most recent first
      });
      
      console.log('📺 All live streams found:', streams.map(s => ({
        id: s.id,
        title: s.title,
        streamerName: s.streamerName,
        status: s.status
      })));
      
      return streams;
    } catch (error) {
      console.error('❌ Error getting live streams:', error);
      return [];
    }
  }

  // Start listening to stream updates
  startListeningToStream(streamId) {
    if (this.streamListeners.has(streamId)) {
      return; // Already listening
    }

    console.log(`🎧 Starting to listen to stream ${streamId}`);
    
    // Listen to stream updates
    const streamRef = doc(db, 'streams', streamId);
    const unsubscribe = onSnapshot(streamRef, (doc) => {
      if (doc.exists()) {
        const streamData = doc.data();
        this.handleStreamUpdate(streamData);
      }
    });

    this.streamListeners.set(streamId, unsubscribe);
  }

  // Stop listening to stream updates
  stopListeningToStream(streamId) {
    const unsubscribe = this.streamListeners.get(streamId);
    if (unsubscribe) {
      unsubscribe();
      this.streamListeners.delete(streamId);
      console.log(`🔇 Stopped listening to stream ${streamId}`);
    }
  }

  // Handle stream updates
  handleStreamUpdate(streamData) {
    console.log('📡 Stream update received:', streamData);
    // Handle stream updates (viewer count, status changes, etc.)
  }

  // Update viewer count
  async updateViewerCount(streamId) {
    try {
      // First find the stream document by custom id field
      const streamsQuery = query(
        collection(db, 'streams'),
        where('id', '==', streamId),
        where('status', '==', 'live')
      );
      
      const streamsSnapshot = await getDocs(streamsQuery);
      if (streamsSnapshot.empty) {
        console.log('⚠️ Stream document does not exist, skipping viewer count update');
        return;
      }
      
      const streamDoc = streamsSnapshot.docs[0];
      console.log('🔍 Found stream document for viewer count update:', streamDoc.id);

      const viewersQuery = query(
        collection(db, 'streamViewers'),
        where('streamId', '==', streamId),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(viewersQuery);
      const viewerCount = snapshot.size;

      await updateDoc(doc(db, 'streams', streamDoc.id), {
        viewerCount,
        lastActivity: serverTimestamp()
      });

      console.log('✅ Viewer count updated:', viewerCount);

    } catch (error) {
      console.error('❌ Error updating viewer count:', error);
    }
  }

  // Notify followers about live stream
  async notifyFollowersAboutStream(listingId, streamerId, streamerName, streamTitle) {
    try {
      // Get listing followers (this would need to be implemented)
      // For now, we'll notify all users about the live stream
      
      const title = `🔴 Live Stream Started!`;
      const body = `${streamerName} is now live streaming "${streamTitle}"!`;
      
      // This would typically get followers from a followers collection
      // For now, we'll create a general notification
      await NotificationManager.createNotification(
        'all_users', // This would be replaced with actual follower IDs
        title,
        body,
        {
          type: 'live_stream_started',
          listingId: listingId || null,
          streamId: this.streamId,
          streamerId,
          streamerName
        }
      );
      
    } catch (error) {
      console.error('❌ Error notifying followers:', error);
    }
  }

  // Get stream chat messages
  async getStreamChat(streamId, callback) {
    try {
      console.log('💬 Getting stream chat for streamId:', streamId);
      
      // Use simple query without orderBy to avoid composite index requirement
      const chatQuery = query(
        collection(db, 'streamChat'),
        where('streamId', '==', streamId)
      );

      const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort messages by timestamp in JavaScript (client-side sorting)
        messages.sort((a, b) => {
          const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
          const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
          return aTime - bTime;
        });
        
        console.log('💬 Retrieved', messages.length, 'chat messages');
        callback(messages);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ Error getting stream chat:', error);
      return null;
    }
  }

  // Check if a stream actually exists in Firebase
  async checkStreamExists(streamId) {
    try {
      if (!streamId) {
        console.log('⚠️ No streamId provided to checkStreamExists');
        return false;
      }
      
      console.log('🔍 Checking if stream exists:', streamId);
      
      // Search by custom id field instead of document ID
      const streamsQuery = query(
        collection(db, 'streams'),
        where('id', '==', streamId),
        where('status', '==', 'live')
      );
      
      const snapshot = await getDocs(streamsQuery);
      const exists = !snapshot.empty;
      
      console.log('🔍 Stream check result:', {
        streamId,
        exists,
        foundDocs: snapshot.docs.length,
        docIds: snapshot.docs.map(doc => doc.id)
      });
      
      return exists;
    } catch (error) {
      console.error('❌ Error checking stream existence:', error);
      return false;
    }
  }

  // Reset streaming state (useful for cleanup)
  resetStreamingState() {
    console.log('🔄 Resetting streaming state');
    this.isStreaming = false;
    this.currentStream = null;
    this.streamId = null;
    this.viewers.clear();
  }

  // Get current stream status
  getStreamStatus() {
    return {
      isStreaming: this.isStreaming,
      streamId: this.streamId,
      currentStream: this.currentStream,
      viewerCount: this.viewers.size
    };
  }

  // Clean up resources
  cleanup() {
    this.stopStream();
    this.streamListeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.streamListeners.clear();
    this.viewers.clear();
    this.chatMessages = [];
  }
}

export default new StreamingService();
