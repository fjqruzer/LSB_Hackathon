class VideoStreamingService {
  constructor() {
    this.isStreaming = false;
    this.isViewing = false;
    this.streamId = null;
    this.channelName = null;
  }

  // Start streaming (for streamer)
  async startStreaming(streamId, streamerName) {
    try {
      console.log('🎥 Starting video streaming...', { streamId, streamerName });
      
      this.streamId = streamId;
      this.channelName = `stream_${streamId}`;
      this.isStreaming = true;
      
      console.log('✅ Video streaming started');
      return {
        streamId: this.streamId,
        channelName: this.channelName,
        streamerName: streamerName
      };
    } catch (error) {
      console.error('❌ Error starting video streaming:', error);
      throw error;
    }
  }

  // Start viewing (for viewer)
  async startViewing(streamId, streamerName) {
    try {
      console.log('👀 Starting video viewing...', { streamId, streamerName });
      
      this.streamId = streamId;
      this.channelName = `stream_${streamId}`;
      this.isViewing = true;
      
      console.log('✅ Video viewing started');
      return {
        streamId: this.streamId,
        channelName: this.channelName,
        streamerName: streamerName
      };
    } catch (error) {
      console.error('❌ Error starting video viewing:', error);
      throw error;
    }
  }

  // Stop streaming/viewing
  async stopStreaming() {
    try {
      console.log('🛑 Stopping video streaming...');
      
      this.isStreaming = false;
      this.isViewing = false;
      this.streamId = null;
      this.channelName = null;
      
      console.log('✅ Video streaming stopped');
    } catch (error) {
      console.error('❌ Error stopping video streaming:', error);
    }
  }

  // Get streaming info
  getStreamingInfo() {
    return {
      isStreaming: this.isStreaming,
      isViewing: this.isViewing,
      streamId: this.streamId,
      channelName: this.channelName
    };
  }

  // Generate stream URL for Video component
  getStreamUrl(streamerName, isStreamer = false) {
    // For now, use a sample video URL for demonstration
    // In a real implementation, this would be the actual stream URL
    if (isStreamer) {
      // Streamer doesn't need a video URL, they use the camera directly
      return null;
    } else {
      // For viewers, use a sample video stream
      // In production, this would be the actual live stream URL
      return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    }
  }

  // Generate WebView URL for streaming interface
  getWebViewUrl(streamerName, isStreamer = false) {
    // Create HTML content for streaming simulation
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Live Stream</title>
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
              
              .camera-placeholder {
                  width: 100%;
                  height: 100%;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  text-align: center;
              }
              
              .camera-icon {
                  font-size: 48px;
                  margin-bottom: 20px;
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
              
              <div class="camera-placeholder">
                  <div class="camera-icon">📹</div>
                  <div class="stream-title" id="streamTitle">Live Stream</div>
                  <div class="stream-description" id="streamDescription">Real-time video streaming</div>
              </div>
              
              <div class="streamer-info">
                  <div class="streamer-name" id="streamerName">${streamerName || 'Streamer'}</div>
                  <div class="stream-status">📹 Camera feed ${isStreamer ? 'active' : 'from streamer'}</div>
              </div>
          </div>

          <script>
              // Simulate viewer count
              let viewerCount = Math.floor(Math.random() * 50) + 1;
              document.getElementById('viewerCount').textContent = viewerCount;
              
              // Update viewer count periodically
              setInterval(() => {
                  viewerCount += Math.floor(Math.random() * 3) - 1;
                  if (viewerCount < 1) viewerCount = 1;
                  document.getElementById('viewerCount').textContent = viewerCount;
              }, 5000);
              
              // Update content based on role
              if (${isStreamer}) {
                  document.getElementById('streamTitle').textContent = 'Your Live Stream';
                  document.getElementById('streamDescription').textContent = 'Broadcasting to viewers';
              } else {
                  document.getElementById('streamTitle').textContent = 'Live Stream';
                  document.getElementById('streamDescription').textContent = 'Watching ${streamerName || 'Streamer'}\\'s live stream';
              }
          </script>
      </body>
      </html>
    `;
    
    return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
  }
}

export default new VideoStreamingService();
