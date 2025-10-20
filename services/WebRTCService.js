import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isStreaming = false;
    this.isViewing = false;
  }

  // Configuration for WebRTC
  getPeerConnectionConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
  }

  // Start streaming (for streamer)
  async startStreaming() {
    try {
      console.log('🎥 Starting WebRTC streaming...');
      
      // Get user media (camera and microphone)
      this.localStream = await mediaDevices.getUserMedia({
        video: {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { min: 15, ideal: 30, max: 30 },
        },
        audio: true,
      });

      console.log('📹 Local stream obtained:', this.localStream);
      this.isStreaming = true;
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error starting WebRTC stream:', error);
      throw error;
    }
  }

  // Stop streaming
  async stopStreaming() {
    try {
      console.log('🛑 Stopping WebRTC streaming...');
      
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
      
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      this.isStreaming = false;
      console.log('✅ WebRTC streaming stopped');
    } catch (error) {
      console.error('❌ Error stopping WebRTC stream:', error);
    }
  }

  // Start viewing (for viewer)
  async startViewing(streamId) {
    try {
      console.log('👀 Starting WebRTC viewing for stream:', streamId);
      
      // For now, we'll simulate a remote stream
      // In a real implementation, this would connect to the streamer's camera
      console.log('📹 Simulating remote stream for demo purposes');
      
      // Create a mock remote stream for demonstration
      // In production, this would be the actual stream from the streamer
      this.remoteStream = {
        toURL: () => {
          console.log('📹 Mock remote stream URL generated');
          return 'mock-stream-url';
        }
      };

      this.isViewing = true;
      console.log('✅ WebRTC viewing started (mock mode)');
      
      return this.remoteStream;
    } catch (error) {
      console.error('❌ Error starting WebRTC viewing:', error);
      throw error;
    }
  }

  // Stop viewing
  async stopViewing() {
    try {
      console.log('🛑 Stopping WebRTC viewing...');
      
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      this.remoteStream = null;
      this.isViewing = false;
      console.log('✅ WebRTC viewing stopped');
    } catch (error) {
      console.error('❌ Error stopping WebRTC viewing:', error);
    }
  }

  // Get local stream (for streamer)
  getLocalStream() {
    return this.localStream;
  }

  // Get remote stream (for viewer)
  getRemoteStream() {
    return this.remoteStream;
  }

  // Check if streaming
  getIsStreaming() {
    return this.isStreaming;
  }

  // Check if viewing
  getIsViewing() {
    return this.isViewing;
  }
}

export default new WebRTCService();
