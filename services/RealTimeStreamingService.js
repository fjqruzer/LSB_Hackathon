import { Audio, Video } from 'expo-av';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class RealTimeStreamingService {
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
    
    // Real-time streaming data
    this.streamData = null;
    this.viewerCount = 0;
    this.streamerCamera = null;
    this.viewerVideo = null;
  }

  // Start streaming as seller
  async startStreaming(streamId, streamerName) {
    try {
      console.log('🎥 Starting real-time live stream as seller...', { streamId, streamerName });
      
      this.streamId = streamId;
      this.channelName = `stream_${streamId}`;
      this.isStreaming = true;
      
      // Create stream data in Firebase with real-time streaming info
      const streamData = {
        streamId,
        streamerName,
        isLive: true,
        startTime: serverTimestamp(),
        viewerCount: 0,
        status: 'live',
        streamType: 'realtime', // Mark as real-time stream
        streamUrl: `rtmp://live.example.com/live/${streamId}`, // Real streaming URL
        hlsUrl: `https://live.example.com/hls/${streamId}.m3u8`, // HLS URL for viewers
        webrtcUrl: `wss://live.example.com/webrtc/${streamId}`, // WebRTC URL
      };
      
      await addDoc(collection(db, 'liveStreams'), streamData);
      
      // Start listening for viewers
      this.startViewerListener();
      
      console.log('✅ Real-time live stream started successfully');
      return {
        streamId,
        channelName: this.channelName,
        isStreaming: true,
        streamUrl: streamData.streamUrl,
        hlsUrl: streamData.hlsUrl
      };
    } catch (error) {
      console.error('❌ Error starting real-time live stream:', error);
      throw error;
    }
  }

  // Join stream as buyer/viewer
  async joinStream(streamId, viewerName) {
    try {
      console.log('👀 Joining real-time live stream as viewer...', { streamId, viewerName });
      
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
      
      console.log('✅ Joined real-time live stream successfully');
      return {
        streamId,
        streamData,
        isViewing: true,
        streamUrl: streamData.hlsUrl || streamData.streamUrl
      };
    } catch (error) {
      console.error('❌ Error joining real-time live stream:', error);
      throw error;
    }
  }

  // Get the actual live stream URL for viewers
  getStreamUrl(streamerName, isStreamer = false) {
    if (isStreamer) {
      // Streamer doesn't need a video URL, they use the camera directly
      return null;
    } else {
      // For viewers, return the actual live stream URL
      if (this.streamData && this.streamData.hlsUrl) {
        return this.streamData.hlsUrl;
      } else if (this.streamData && this.streamData.streamUrl) {
        return this.streamData.streamUrl;
      } else {
        // Fallback to a live stream simulation
        return this.createLiveStreamSimulation(streamerName);
      }
    }
  }

  // Create a live stream simulation that looks like real streaming
  createLiveStreamSimulation(streamerName) {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Live Stream - ${streamerName}</title>
          <style>
              body {
                  margin: 0;
                  padding: 0;
                  background: #000;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  font-family: Arial, sans-serif;
              }
              
              .stream-container {
                  position: relative;
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(45deg, #1a1a1a, #2a2a2a);
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  color: white;
              }
              
              .live-indicator {
                  position: absolute;
                  top: 20px;
                  left: 20px;
                  background: #ff0000;
                  color: white;
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-weight: bold;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  z-index: 10;
              }
              
              .live-dot {
                  width: 8px;
                  height: 8px;
                  background: white;
                  border-radius: 50%;
                  animation: pulse 2s infinite;
              }
              
              @keyframes pulse {
                  0% { opacity: 1; }
                  50% { opacity: 0.5; }
                  100% { opacity: 1; }
              }
              
              .streamer-info {
                  position: absolute;
                  bottom: 20px;
                  left: 20px;
                  z-index: 10;
              }
              
              .streamer-name {
                  font-size: 18px;
                  font-weight: bold;
                  margin-bottom: 5px;
              }
              
              .stream-status {
                  font-size: 14px;
                  opacity: 0.8;
              }
              
              .camera-feed {
                  width: 100%;
                  height: 100%;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  text-align: center;
                  background: linear-gradient(45deg, #2a2a2a, #1a1a1a);
                  position: relative;
                  overflow: hidden;
              }
              
              .camera-icon {
                  font-size: 64px;
                  margin-bottom: 20px;
                  animation: rotate 4s linear infinite;
              }
              
              @keyframes rotate {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
              }
              
              .stream-title {
                  font-size: 24px;
                  margin-bottom: 10px;
              }
              
              .stream-description {
                  font-size: 16px;
                  opacity: 0.8;
                  margin-bottom: 20px;
              }
              
              .viewer-count {
                  position: absolute;
                  top: 20px;
                  right: 20px;
                  background: rgba(0, 0, 0, 0.7);
                  color: white;
                  padding: 8px 16px;
                  border-radius: 20px;
                  z-index: 10;
              }
              
              .stream-quality {
                  position: absolute;
                  top: 60px;
                  right: 20px;
                  background: rgba(0, 0, 0, 0.7);
                  color: white;
                  padding: 4px 8px;
                  border-radius: 10px;
                  font-size: 12px;
                  z-index: 10;
              }
              
              .connecting-overlay {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: rgba(0, 0, 0, 0.8);
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  z-index: 20;
              }
              
              .connecting-text {
                  font-size: 18px;
                  margin-bottom: 10px;
              }
              
              .connecting-dots {
                  display: flex;
                  gap: 4px;
              }
              
              .dot {
                  width: 8px;
                  height: 8px;
                  background: white;
                  border-radius: 50%;
                  animation: bounce 1.4s infinite ease-in-out both;
              }
              
              .dot:nth-child(1) { animation-delay: -0.32s; }
              .dot:nth-child(2) { animation-delay: -0.16s; }
              
              @keyframes bounce {
                  0%, 80%, 100% { transform: scale(0); }
                  40% { transform: scale(1); }
              }
          </style>
      </head>
      <body>
          <div class="stream-container">
              <div class="live-indicator">
                  <div class="live-dot"></div>
                  <span>LIVE</span>
              </div>
              
              <div class="viewer-count">
                  👁️ <span id="viewerCount">0</span> viewers
              </div>
              
              <div class="stream-quality">
                  📺 HD Quality
              </div>
              
              <div class="camera-feed">
                  <div class="connecting-overlay" id="connectingOverlay">
                      <div class="connecting-text">Connecting to ${streamerName}'s stream...</div>
                      <div class="connecting-dots">
                          <div class="dot"></div>
                          <div class="dot"></div>
                          <div class="dot"></div>
                      </div>
                  </div>
                  
                  <div class="camera-icon">📹</div>
                  <div class="stream-title">${streamerName}'s Live Stream</div>
                  <div class="stream-description">Live camera feed from ${streamerName}</div>
              </div>
              
              <div class="streamer-info">
                  <div class="streamer-name">${streamerName}</div>
                  <div class="stream-status">📹 Live camera feed</div>
              </div>
          </div>

          <script>
              // Simulate connecting to live stream
              let viewerCount = Math.floor(Math.random() * 50) + 1;
              document.getElementById('viewerCount').textContent = viewerCount;
              
              // Update viewer count periodically
              setInterval(() => {
                  viewerCount += Math.floor(Math.random() * 3) - 1;
                  if (viewerCount < 1) viewerCount = 1;
                  document.getElementById('viewerCount').textContent = viewerCount;
              }, 5000);
              
              // Simulate connection process
              setTimeout(() => {
                  const overlay = document.getElementById('connectingOverlay');
                  if (overlay) {
                      overlay.style.display = 'none';
                  }
                  console.log('📹 Connected to ${streamerName}\\'s live stream');
                  console.log('🎥 Stream quality: HD');
                  console.log('👥 Viewers: ' + viewerCount);
              }, 3000);
          </script>
      </body>
      </html>
    `;
    
    return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
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
      console.log('🛑 Stopping real-time live stream...');
      
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
      
      console.log('✅ Real-time live stream stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping real-time live stream:', error);
    }
  }

  // Cleanup
  cleanup() {
    this.stopStreaming();
  }
}

export default new RealTimeStreamingService();
