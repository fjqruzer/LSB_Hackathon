import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import StreamingService from '../services/StreamingService';
import VideoStreamingService from '../services/VideoStreamingService';
import LiveStreamingService from '../services/LiveStreamingService';
import RealTimeStreamingService from '../services/RealTimeStreamingService';
import { WebView } from 'react-native-webview';
import { Video } from 'expo-av';

const { width, height } = Dimensions.get('window');

const StreamViewerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const themeContext = useTheme();
  const theme = themeContext?.theme || {
    colors: {
      background: '#ffffff',
      surface: '#f5f5f5',
      text: '#000000',
      textSecondary: '#666666',
      primary: '#007AFF',
      border: '#e0e0e0',
    },
    dark: false
  };
  const { stream } = route.params || {};

  // State management
  const [isJoined, setIsJoined] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [streamStatus, setStreamStatus] = useState('loading');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [streamData, setStreamData] = useState(stream);
  const [streamUrl, setStreamUrl] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Load fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  useEffect(() => {
    if (stream?.id) {
      joinStream();
    }
    return () => {
      if (isJoined) {
        leaveStream();
      }
      RealTimeStreamingService.stopStreaming();
    };
  }, [stream?.id]);

  const joinStream = async () => {
    try {
      console.log('👀 Joining stream:', stream.id);
      console.log('🔍 Stream data received:', {
        id: stream.id,
        title: stream.title,
        streamerName: stream.streamerName,
        status: stream.status,
        fullStream: stream
      });
      
      await StreamingService.joinStream(
        stream.id,
        user.uid,
        user.displayName || user.email
      );

      // Start real-time live video viewing
      console.log('🎥 Starting real-time live video viewing...');
      const streamInfo = await RealTimeStreamingService.joinStream(
        stream.id,
        user.displayName || user.email
      );
      
      // Generate real-time stream URL for Video component
      const url = RealTimeStreamingService.getStreamUrl(
        streamData?.streamerName || 'Streamer',
        false // isStreamer
      );
      setStreamUrl(url);
      console.log('✅ Real-time live video viewing started with URL:', url);

      setIsJoined(true);
      setStreamStatus('live');
      console.log('✅ Stream joined successfully, status set to live');

      // Start listening to chat
      const unsubscribe = await StreamingService.getStreamChat(stream.id, (messages) => {
        setChatMessages(messages);
        // Auto-scroll to bottom
        setTimeout(() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });

      // Listen to stream updates
      StreamingService.startListeningToStream(stream.id);

    } catch (error) {
      console.error('Error joining stream:', error);
      Alert.alert('Error', 'Failed to join stream');
      setStreamStatus('error');
      console.log('❌ Stream join failed, status set to error');
    }
  };

  const leaveStream = async () => {
    try {
      if (stream?.id) {
        await StreamingService.leaveStream(stream.id, user.uid);
        StreamingService.stopListeningToStream(stream.id);
      }
      setIsJoined(false);
      setStreamStatus('ended');
    } catch (error) {
      console.error('Error leaving stream:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !isJoined) return;

    try {
      await StreamingService.sendChatMessage(
        stream.id,
        user.uid,
        user.displayName || user.email,
        newMessage
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '00:00';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (startTime) => {
    if (!startTime) return '00:00';
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!fontsLoaded) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    header: {
      position: 'absolute',
      top: insets.top + 10,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      zIndex: 10,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      padding: 8,
      marginRight: 10,
    },
    streamTitle: {
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
      color: '#fff',
      flex: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      padding: 8,
      marginLeft: 5,
    },
    videoContainer: {
      width: width,
      height: isFullscreen ? height : height * 0.4,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: 'Poppins-Medium',
      textAlign: 'center',
      marginBottom: 10,
    },
    statusText: {
      color: '#fff',
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      textAlign: 'center',
    },
    cameraFeedSimulation: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a1a1a',
      borderRadius: 8,
      padding: 20,
    },
    liveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 15,
      backgroundColor: 'rgba(255, 0, 0, 0.8)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fff',
      marginRight: 6,
    },
    liveText: {
      color: '#fff',
      fontSize: 12,
      fontFamily: 'Poppins-Bold',
    },
    streamInfo: {
      position: 'absolute',
      bottom: isFullscreen ? 20 : height * 0.4 - 60,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 15,
      borderRadius: 8,
    },
    streamerName: {
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
      color: '#fff',
      marginBottom: 5,
    },
    streamDescription: {
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      color: '#ccc',
      marginBottom: 10,
    },
    streamStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    viewerCount: {
      fontSize: 14,
      fontFamily: 'Poppins-Medium',
      color: '#fff',
    },
    duration: {
      fontSize: 14,
      fontFamily: 'Poppins-Medium',
      color: '#fff',
    },
    chatContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      display: showChat ? 'flex' : 'none',
    },
    chatHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    chatTitle: {
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
      color: theme.colors.text,
    },
    chatToggle: {
      padding: 8,
    },
    chatMessages: {
      flex: 1,
      paddingHorizontal: 20,
    },
    messageItem: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    messageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    messageUser: {
      fontSize: 14,
      fontFamily: 'Poppins-SemiBold',
      color: theme.colors.primary,
    },
    messageTime: {
      fontSize: 12,
      fontFamily: 'Poppins-Regular',
      color: theme.colors.textSecondary,
    },
    messageText: {
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      color: theme.colors.text,
    },
    messageInput: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    textInput: {
      flex: 1,
      height: 40,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 20,
      paddingHorizontal: 15,
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
    },
    sendButton: {
      marginLeft: 10,
      padding: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
    loadingText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: 'Poppins-Medium',
      marginTop: 20,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
      padding: 20,
    },
    errorText: {
      color: '#ff4444',
      fontSize: 16,
      fontFamily: 'Poppins-Medium',
      textAlign: 'center',
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#fff',
      fontSize: 14,
      fontFamily: 'Poppins-SemiBold',
    },
  });

  if (streamStatus === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  if (streamStatus === 'error') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Failed to load stream. Please try again.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setStreamStatus('loading');
            joinStream();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.streamTitle} numberOfLines={1}>
            {streamData?.title || 'hello Stream'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleFullscreen}
          >
            <Ionicons 
              name={isFullscreen ? "contract" : "expand"} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleChat}
          >
            <Ionicons 
              name={showChat ? "chatbubbles" : "chatbubbles-outline"} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Video Player */}
      <View style={styles.videoContainer}>
        {streamStatus === 'live' && streamUrl ? (
          <Video
            source={{ uri: streamUrl }}
            style={styles.videoPlaceholder}
            shouldPlay={true}
            isLooping={false}
            resizeMode="cover"
            onLoad={() => console.log('📹 Viewer Video loaded')}
            onError={(error) => console.error('📹 Viewer Video error:', error)}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded) {
                console.log('📹 Video status:', status.positionMillis, status.durationMillis);
              }
            }}
          />
        ) : streamStatus === 'live' ? (
          <View style={styles.videoPlaceholder}>
            {/* Fallback when Agora is not available */}
            <View style={styles.cameraFeedSimulation}>
              <Text style={styles.videoText}>📹 LIVE</Text>
              <Text style={styles.statusText}>
                {streamData?.streamerName || 'Streamer'} is live
              </Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={[styles.statusText, { fontSize: 12, marginTop: 20 }]}>
                📹 Camera feed from {streamData?.streamerName || 'Streamer'}
              </Text>
              <Text style={[styles.statusText, { fontSize: 10, marginTop: 10, opacity: 0.7 }]}>
                Real-time video streaming
              </Text>
            </View>
          </View>
        ) : streamStatus === 'error' ? (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoText}>❌ Stream Error</Text>
            <Text style={styles.statusText}>
              Failed to connect to stream
            </Text>
          </View>
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoText}>📹 Connecting...</Text>
            <Text style={styles.statusText}>
              Joining {streamData?.streamerName || 'Streamer'}'s stream
            </Text>
          </View>
        )}
      </View>

      {/* Stream Info Overlay */}
      <View style={styles.streamInfo}>
        <Text style={styles.streamerName}>
          {streamData?.streamerName || 'Streamer'}
        </Text>
        {streamData?.description ? (
          <Text style={styles.streamDescription}>
            {streamData.description}
          </Text>
        ) : null}
        <View style={styles.streamStats}>
          <Text style={styles.viewerCount}>
            👀 {viewerCount} viewers
          </Text>
          <Text style={styles.duration}>
            ⏱️ {formatDuration(streamData?.startTime)}
          </Text>
        </View>
      </View>

      {/* Chat */}
      {showChat && (
        <View style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Live Chat</Text>
            <TouchableOpacity
              style={styles.chatToggle}
              onPress={toggleChat}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={chatScrollRef}
            style={styles.chatMessages}
            showsVerticalScrollIndicator={false}
          >
            {chatMessages.map((message, index) => (
              <View key={index} style={styles.messageItem}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageUser}>{message.userName}</Text>
                  <Text style={styles.messageTime}>
                    {formatTime(message.timestamp)}
                  </Text>
                </View>
                <Text style={styles.messageText}>{message.message}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.messageInput}>
            <TextInput
              style={styles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={200}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={!newMessage.trim()}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={newMessage.trim() ? theme.colors.primary : theme.colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default StreamViewerScreen;
