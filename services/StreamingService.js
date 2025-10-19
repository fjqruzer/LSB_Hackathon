import { Camera } from 'expo-camera';
import { Audio, Video } from 'expo-av';
import { MediaLibrary } from 'expo-media-library';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
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
  }

  // Request permissions for streaming
  async requestPermissions() {
    try {
      console.log('🎥 Requesting streaming permissions...');
      
      // Request camera permission
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      this.cameraPermission = cameraPermission;
      
      // Request audio permission
      const audioPermission = await Audio.requestPermissionsAsync();
      this.audioPermission = audioPermission;
      
      // Request media library permission for saving streams
      const mediaPermission = await MediaLibrary.requestPermissionsAsync();
      
      const allGranted = cameraPermission.status === 'granted' && 
                        audioPermission.status === 'granted' && 
                        mediaPermission.status === 'granted';
      
      if (!allGranted) {
        console.log('❌ Streaming permissions not granted');
        return false;
      }
      
      console.log('✅ All streaming permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Error requesting streaming permissions:', error);
      return false;
    }
  }

  // Start a live stream
  async startStream(listingId, userId, userName, streamTitle, streamDescription) {
    try {
      if (this.isStreaming) {
        throw new Error('Already streaming');
      }

      // Request permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        throw new Error('Streaming permissions not granted');
      }

      console.log('🎥 Starting live stream...');
      
      // Generate unique stream ID
      this.streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create stream document in Firebase
      const streamData = {
        id: this.streamId,
        listingId,
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

      await addDoc(collection(db, 'streams'), streamData);
      
      // Update listing to show it's being streamed
      await updateDoc(doc(db, 'listings', listingId), {
        isLiveStreaming: true,
        streamId: this.streamId,
        streamStartTime: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });

      // Notify followers about the live stream
      await this.notifyFollowersAboutStream(listingId, userId, userName, streamTitle);

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
      if (!this.isStreaming || !this.streamId) {
        throw new Error('No active stream to stop');
      }

      console.log('🛑 Stopping live stream...');
      
      // Update stream status
      const streamRef = doc(db, 'streams', this.streamId);
      await updateDoc(streamRef, {
        status: 'ended',
        endTime: serverTimestamp(),
        finalViewerCount: this.viewers.size,
        lastActivity: serverTimestamp()
      });

      // Update listing
      if (this.currentStream?.listingId) {
        await updateDoc(doc(db, 'listings', this.currentStream.listingId), {
          isLiveStreaming: false,
          streamId: null,
          lastUpdated: serverTimestamp()
        });
      }

      // Clear current stream data
      this.isStreaming = false;
      this.currentStream = null;
      this.streamId = null;
      this.viewers.clear();
      this.chatMessages = [];
      
      console.log('✅ Live stream stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping stream:', error);
      throw error;
    }
  }

  // Join a stream as a viewer
  async joinStream(streamId, userId, userName) {
    try {
      console.log(`👀 User ${userName} joining stream ${streamId}`);
      
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
      const streamsQuery = query(
        collection(db, 'streams'),
        where('listingId', '==', listingId),
        where('status', '==', 'live'),
        orderBy('startTime', 'desc')
      );

      const snapshot = await getDocs(streamsQuery);
      const streams = [];
      
      snapshot.forEach((doc) => {
        streams.push({ id: doc.id, ...doc.data() });
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
      const streamsQuery = query(
        collection(db, 'streams'),
        where('status', '==', 'live'),
        orderBy('startTime', 'desc')
      );

      const snapshot = await getDocs(streamsQuery);
      const streams = [];
      
      snapshot.forEach((doc) => {
        streams.push({ id: doc.id, ...doc.data() });
      });
      
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
      const viewersQuery = query(
        collection(db, 'streamViewers'),
        where('streamId', '==', streamId),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(viewersQuery);
      const viewerCount = snapshot.size;

      await updateDoc(doc(db, 'streams', streamId), {
        viewerCount,
        lastActivity: serverTimestamp()
      });

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
          listingId,
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
      const chatQuery = query(
        collection(db, 'streamChat'),
        where('streamId', '==', streamId),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        callback(messages);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ Error getting stream chat:', error);
      return null;
    }
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
