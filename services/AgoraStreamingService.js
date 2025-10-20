import RtcEngine, { 
  ChannelProfile, 
  ClientRole, 
  RtcEngineContext,
  VideoCanvas,
  IRtcEngineEventHandler
} from 'react-native-agora';

class AgoraStreamingService {
  constructor() {
    this.engine = null;
    this.isStreaming = false;
    this.isViewing = false;
    this.channelName = null;
    this.uid = null;
  }

  // Initialize Agora engine
  async initialize(appId) {
    try {
      console.log('🎥 Initializing Agora engine...');
      
      const context = {
        appId: appId,
        channelProfile: ChannelProfile.Communication,
      };
      
      this.engine = await RtcEngine.createWithContext(context);
      
      // Enable video
      await this.engine.enableVideo();
      
      // Enable audio
      await this.engine.enableAudio();
      
      console.log('✅ Agora engine initialized');
      return true;
    } catch (error) {
      console.error('❌ Error initializing Agora:', error);
      throw error;
    }
  }

  // Start streaming (for broadcaster)
  async startStreaming(channelName, uid) {
    try {
      console.log('🎥 Starting Agora streaming...', { channelName, uid });
      
      if (!this.engine) {
        throw new Error('Agora engine not initialized');
      }

      // Set client role as broadcaster
      await this.engine.setClientRole(ClientRole.Broadcaster);
      
      // Join channel
      await this.engine.joinChannel(null, channelName, uid);
      
      this.channelName = channelName;
      this.uid = uid;
      this.isStreaming = true;
      
      console.log('✅ Agora streaming started');
      return true;
    } catch (error) {
      console.error('❌ Error starting Agora streaming:', error);
      throw error;
    }
  }

  // Start viewing (for audience)
  async startViewing(channelName, uid) {
    try {
      console.log('👀 Starting Agora viewing...', { channelName, uid });
      
      if (!this.engine) {
        throw new Error('Agora engine not initialized');
      }

      // Set client role as audience
      await this.engine.setClientRole(ClientRole.Audience);
      
      // Join channel
      await this.engine.joinChannel(null, channelName, uid);
      
      this.channelName = channelName;
      this.uid = uid;
      this.isViewing = true;
      
      console.log('✅ Agora viewing started');
      return true;
    } catch (error) {
      console.error('❌ Error starting Agora viewing:', error);
      throw error;
    }
  }

  // Stop streaming/viewing
  async stopStreaming() {
    try {
      console.log('🛑 Stopping Agora streaming...');
      
      if (this.engine && this.channelName) {
        await this.engine.leaveChannel();
      }
      
      this.isStreaming = false;
      this.isViewing = false;
      this.channelName = null;
      this.uid = null;
      
      console.log('✅ Agora streaming stopped');
    } catch (error) {
      console.error('❌ Error stopping Agora streaming:', error);
    }
  }

  // Get engine instance
  getEngine() {
    return this.engine;
  }

  // Check if streaming
  getIsStreaming() {
    return this.isStreaming;
  }

  // Check if viewing
  getIsViewing() {
    return this.isViewing;
  }

  // Cleanup
  async cleanup() {
    try {
      if (this.engine) {
        await this.engine.destroy();
        this.engine = null;
      }
      console.log('✅ Agora engine cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up Agora:', error);
    }
  }
}

export default new AgoraStreamingService();

