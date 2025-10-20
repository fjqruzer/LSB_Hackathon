import { Audio, Video } from 'expo-av';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class LiveStreamingService {
  constructor() {
    this.isStreaming = false;
    this.isViewing = false;
    this.currentStream = null;
    this.streamId = null;
    this.channelName = null;
    this.viewers = new Set();
    this.chatMessages = [];
    this.streamListeners = new Map();
    this.audioPermission = null;
    this.cameraPermission = null;
    
    // WebRTC-like streaming simulation
    this.streamData = null;
    this.viewerCount = 0;
  }

  // Start streaming as seller
  async startStreaming(streamId, streamerName) {
    try {
      console.log('🎥 Starting live stream as seller...', { streamId, streamerName });
      
      this.streamId = streamId;
      this.channelName = `stream_${streamId}`;
      this.isStreaming = true;
      
      // Create stream data in Firebase
      const streamData = {
        streamId,
        streamerName,
        isLive: true,
        startTime: serverTimestamp(),
        viewerCount: 0,
        status: 'live'
      };
      
      await addDoc(collection(db, 'liveStreams'), streamData);
      
      // Start listening for viewers
      this.startViewerListener();
      
      console.log('✅ Live stream started successfully');
      return {
        streamId,
        channelName: this.channelName,
        isStreaming: true
      };
    } catch (error) {
      console.error('❌ Error starting live stream:', error);
      throw error;
    }
  }

  // Join stream as buyer/viewer
  async joinStream(streamId, viewerName) {
    try {
      console.log('👀 Joining live stream as viewer...', { streamId, viewerName });
      
      this.streamId = streamId;
      this.channelName = `stream_${streamId}`;
      this.isViewing = true;
      
      // Get stream data
      const streamQuery = query(
        collection(db, 'liveStreams'),
        where('streamId', '==', streamId)
      );
      const streamSnapshot = await getDocs(streamQuery);
      
      if (streamSnapshot.empty) {
        throw new Error('Stream not found');
      }
      
      const streamData = streamSnapshot.docs[0].data();
      this.streamData = streamData;
      
      // Update viewer count
      await this.updateViewerCount(1);
      
      // Start listening for stream updates
      this.startStreamListener();
      
      console.log('✅ Joined live stream successfully');
      return {
        streamId,
        streamData,
        isViewing: true
      };
    } catch (error) {
      console.error('❌ Error joining live stream:', error);
      throw error;
    }
  }

  // Start listening for viewers
  startViewerListener() {
    if (this.streamListeners.has('viewers')) {
      this.streamListeners.get('viewers')();
    }
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'liveStreams'),
        where('streamId', '==', this.streamId)
      ),
      (snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();
          this.viewerCount = data.viewerCount || 0;
          console.log('👥 Viewer count updated:', this.viewerCount);
        });
      }
    );
    
    this.streamListeners.set('viewers', unsubscribe);
  }

  // Start listening for stream updates
  startStreamListener() {
    if (this.streamListeners.has('stream')) {
      this.streamListeners.get('stream')();
    }
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'liveStreams'),
        where('streamId', '==', this.streamId)
      ),
      (snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();
          this.streamData = data;
          console.log('📹 Stream data updated:', data);
        });
      }
    );
    
    this.streamListeners.set('stream', unsubscribe);
  }

  // Update viewer count
  async updateViewerCount(delta) {
    try {
      const streamQuery = query(
        collection(db, 'liveStreams'),
        where('streamId', '==', this.streamId)
      );
      const streamSnapshot = await getDocs(streamQuery);
      
      if (!streamSnapshot.empty) {
        const streamDoc = streamSnapshot.docs[0];
        const currentCount = streamDoc.data().viewerCount || 0;
        const newCount = Math.max(0, currentCount + delta);
        
        await updateDoc(streamDoc.ref, {
          viewerCount: newCount,
          lastUpdated: serverTimestamp()
        });
        
        this.viewerCount = newCount;
        console.log('👥 Viewer count updated:', newCount);
      }
    } catch (error) {
      console.error('❌ Error updating viewer count:', error);
    }
  }

  // Get stream URL for video player
  getStreamUrl(streamerName, isStreamer = false) {
    if (isStreamer) {
      // Streamer doesn't need a video URL, they use the camera directly
      return null;
    } else {
      // For viewers, return a real video stream URL
      // In a production app, this would be the actual live stream URL from the seller
      // For now, we'll use a sample video that simulates the live stream
      
      // Use a sample video URL that represents the seller's live stream
      // In a real implementation, this would be the actual live stream URL
      return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    }
  }

  // Get stream data
  getStreamData() {
    return {
      streamId: this.streamId,
      channelName: this.channelName,
      isStreaming: this.isStreaming,
      isViewing: this.isViewing,
      viewerCount: this.viewerCount,
      streamData: this.streamData
    };
  }

  // Stop streaming
  async stopStreaming() {
    try {
      console.log('🛑 Stopping live stream...');
      
      if (this.isStreaming) {
        // Update stream status in Firebase
        const streamQuery = query(
          collection(db, 'liveStreams'),
          where('streamId', '==', this.streamId)
        );
        const streamSnapshot = await getDocs(streamQuery);
        
        if (!streamSnapshot.empty) {
          const streamDoc = streamSnapshot.docs[0];
          await updateDoc(streamDoc.ref, {
            isLive: false,
            status: 'ended',
            endTime: serverTimestamp()
          });
        }
      }
      
      // Clean up listeners
      this.streamListeners.forEach((unsubscribe) => {
        unsubscribe();
      });
      this.streamListeners.clear();
      
      // Reset state
      this.isStreaming = false;
      this.isViewing = false;
      this.currentStream = null;
      this.streamId = null;
      this.channelName = null;
      this.viewers.clear();
      this.streamData = null;
      this.viewerCount = 0;
      
      console.log('✅ Live stream stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping live stream:', error);
    }
  }

  // Cleanup
  cleanup() {
    this.stopStreaming();
  }
}

export default new LiveStreamingService();
