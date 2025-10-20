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
import * as Camera from 'expo-camera';
import { Audio } from 'expo-av';

// Camera import check will be done inside the component

const { width, height } = Dimensions.get('window');

const LiveStreamScreen = ({ navigation, route }) => {
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
  const { listing } = route.params || {};

  // State management
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [cameraPermission, setCameraPermission] = useState(null);
  const [audioPermission, setAudioPermission] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [streamStatus, setStreamStatus] = useState('idle'); // idle, starting, live, ending
  const [streamUrl, setStreamUrl] = useState(null);

  // Refs
  const cameraRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Check if Camera is available (moved inside component)
  const isCameraAvailable = React.useMemo(() => {
    try {
      // With namespace import, the Camera component is Camera.CameraView
      const available = Camera && typeof Camera === 'object' && Camera.CameraView;
      console.log('📷 Camera availability check:', { 
        Camera: Camera ? 'Available' : 'Not Available', 
        available, 
        type: typeof Camera,
        isFunction: typeof Camera === 'function',
        isObject: typeof Camera === 'object',
        CameraObject: Camera,
        hasDefault: Camera?.default,
        hasCameraView: Camera?.CameraView,
        CameraKeys: Camera ? Object.keys(Camera) : 'No keys'
      });
      return available;
    } catch (error) {
      console.error('❌ Camera import error:', error);
      return false;
    }
  }, []);

  // Load fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  useEffect(() => {
    requestPermissions();
    return () => {
      StreamingService.cleanup();
      RealTimeStreamingService.stopStreaming();
    };
  }, []);

  const requestPermissions = async () => {
    try {
      // Request camera and audio permissions
      console.log('📷 Camera object:', Camera);
      console.log('📷 Available methods:', Camera ? Object.keys(Camera) : 'No keys');
      
      let cameraPermission;
      if (Camera.requestCameraPermissionsAsync) {
        console.log('📷 Using Camera.requestCameraPermissionsAsync');
        cameraPermission = await Camera.requestCameraPermissionsAsync();
      } else if (Camera.Camera && Camera.Camera.requestCameraPermissionsAsync) {
        console.log('📷 Using Camera.Camera.requestCameraPermissionsAsync');
        cameraPermission = await Camera.Camera.requestCameraPermissionsAsync();
      } else if (Camera.default && Camera.default.requestCameraPermissionsAsync) {
        console.log('📷 Using Camera.default.requestCameraPermissionsAsync');
        cameraPermission = await Camera.default.requestCameraPermissionsAsync();
      } else {
        console.error('❌ No camera permission method found');
        throw new Error('Camera permission method not available');
      }
      
      const audioPermission = await Audio.requestPermissionsAsync();
      
      setCameraPermission(cameraPermission.status);
      setAudioPermission(audioPermission.status);
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const startStream = async () => {
    try {
      if (!streamTitle.trim()) {
        Alert.alert('Error', 'Please enter a stream title');
        return;
      }

      setStreamStatus('starting');
      
      // Request permissions first
      console.log('📷 Requesting permissions before stream start...');
      await requestPermissions();
      
      // Wait a bit for permissions to be set
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('📷 Permission status after request:', { 
        cameraPermission, 
        audioPermission,
        isCameraAvailable 
      });

      if (cameraPermission !== 'granted' || audioPermission !== 'granted') {
        Alert.alert('Permissions Required', 'Camera and microphone permissions are required for streaming');
        setStreamStatus('idle');
        return;
      }
      
      const streamId = await StreamingService.startStream(
        listing?.id,
        user.uid,
        user.displayName || user.email,
        streamTitle,
        streamDescription
      );

      // Start real-time video streaming
      console.log('🎥 Starting real-time video stream...');
      const streamInfo = await RealTimeStreamingService.startStreaming(
        streamId, 
        user.displayName || user.email
      );
      
      // Camera will be used directly for streaming
      setStreamUrl(null);
      console.log('✅ Real-time streaming started with camera');

      setIsStreaming(true);
      setStreamStatus('live');
      
      // Start listening to chat
      const unsubscribe = await StreamingService.getStreamChat(streamId, (messages) => {
        setChatMessages(messages);
        // Auto-scroll to bottom
        setTimeout(() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });

      Alert.alert('Stream Started!', 'Your live stream is now active', [
        { text: 'OK', onPress: () => {
          // Stay in the live stream interface
          console.log('Stream started successfully, staying in live stream');
        }}
      ]);
      
    } catch (error) {
      console.error('Error starting stream:', error);
      Alert.alert('Error', 'Failed to start stream. Please try again.');
      setStreamStatus('idle');
    }
  };

  const stopStream = async () => {
    try {
      Alert.alert(
        'End Stream',
        'Are you sure you want to end the live stream?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Stream',
            style: 'destructive',
            onPress: async () => {
              setStreamStatus('ending');
              const result = await StreamingService.stopStream();
              await RealTimeStreamingService.stopStreaming();
              setIsStreaming(false);
              setStreamStatus('idle');
              setViewerCount(0);
              setChatMessages([]);
              
              if (result.success) {
                Alert.alert('Stream Ended', result.message || 'Your live stream has been ended');
              } else {
                console.warn('Stream stop warning:', result.error);
              Alert.alert('Stream Ended', 'Your live stream has been ended');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error stopping stream:', error);
      Alert.alert('Error', 'Failed to stop stream');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !isStreaming) return;

    try {
      await StreamingService.sendChatMessage(
        StreamingService.streamId,
        user.uid,
        user.displayName || user.email,
        newMessage
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Implement mute/unmute functionality
  };

  const toggleCamera = () => {
    console.log('📹 Toggling camera:', isCameraOn ? 'OFF' : 'ON');
    console.log('📹 Camera availability:', isCameraAvailable);
    console.log('📹 VDO Ninja camera toggled');
    setIsCameraOn(!isCameraOn);
    // VDO Ninja camera on/off functionality
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

  if (!fontsLoaded) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: insets.top + 10,
      paddingBottom: 15,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: 'Poppins-SemiBold',
      color: theme.colors.text,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
    cameraContainer: {
      width: width,
      height: height * 0.4,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cameraPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
    },
    camera: {
      width: '100%',
      height: '100%',
    },
    cameraText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: 'Poppins-Medium',
      textAlign: 'center',
    },
    controlsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: 20,
      backgroundColor: theme.colors.surface,
    },
    controlButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
    },
    muteButton: {
      backgroundColor: isMuted ? '#ff4444' : theme.colors.primary,
    },
    cameraButton: {
      backgroundColor: isCameraOn ? theme.colors.primary : '#ff4444',
    },
    streamInfo: {
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    streamTitle: {
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
      color: theme.colors.text,
      marginBottom: 5,
    },
    streamDescription: {
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      color: theme.colors.textSecondary,
      marginBottom: 10,
    },
    viewerCount: {
      fontSize: 14,
      fontFamily: 'Poppins-Medium',
      color: theme.colors.primary,
    },
    chatContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
    startStreamContainer: {
      padding: 20,
    },
    inputContainer: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontFamily: 'Poppins-Medium',
      color: theme.colors.text,
      marginBottom: 8,
    },
    textInputField: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    startButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: 'center',
    },
    startButtonText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    statusLive: {
      backgroundColor: '#ff4444',
    },
    statusIdle: {
      backgroundColor: '#666',
    },
    statusText: {
      fontSize: 14,
      fontFamily: 'Poppins-Medium',
      color: theme.colors.text,
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isStreaming ? 'Live Stream' : 'Start Stream'}
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            if (isStreaming) {
              Alert.alert(
                'End Stream',
                'Are you sure you want to end the live stream?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'End Stream', 
                    style: 'destructive',
                    onPress: async () => {
                      const result = await stopStream();
                      console.log('Close button stop result:', result);
                      navigation.goBack();
                    }
                  }
                ]
              );
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {!isStreaming ? (
        // Start Stream Form
        <ScrollView style={styles.startStreamContainer}>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, styles[`status${streamStatus.charAt(0).toUpperCase() + streamStatus.slice(1)}`]]} />
            <Text style={styles.statusText}>
              {streamStatus === 'starting' ? 'Starting stream...' : 
               streamStatus === 'ending' ? 'Ending stream...' : 'Ready to stream'}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Stream Title *</Text>
            <TextInput
              style={styles.textInputField}
              value={streamTitle}
              onChangeText={setStreamTitle}
              placeholder="Enter stream title..."
              placeholderTextColor={theme.colors.textSecondary}
              maxLength={100}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInputField, styles.textArea]}
              value={streamDescription}
              onChangeText={setStreamDescription}
              placeholder="Describe what you'll be showing..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={500}
            />
          </View>

          <TouchableOpacity
            style={[styles.startButton, streamStatus !== 'idle' && { opacity: 0.5 }]}
            onPress={startStream}
            disabled={streamStatus !== 'idle'}
          >
            <Text style={styles.startButtonText}>
              {streamStatus === 'starting' ? 'Starting...' : 'Start Live Stream'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        // Live Stream Interface
        <View style={styles.content}>
          {/* Camera View */}
          <View style={styles.cameraContainer}>
            {console.log('📹 Render check:', { 
              isCameraOn, 
              isCameraAvailable, 
              cameraPermission, 
              CameraObject: Camera,
              CameraDefault: Camera?.default,
              CameraKeys: Camera ? Object.keys(Camera) : 'No keys'
            })}
            {isCameraOn && isCameraAvailable && cameraPermission === 'granted' ? (
              <Camera.CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                onCameraReady={() => {
                  console.log('📹 Camera is ready');
                  setCameraReady(true);
                }}
                onMountError={(error) => {
                  console.error('📹 Camera mount error:', error);
                  setCameraReady(false);
                }}
              />
            ) : isCameraOn && cameraPermission !== 'granted' ? (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraText}>
                  📹 Camera Permission Required
                </Text>
                <Text style={[styles.cameraText, { fontSize: 12, marginTop: 10 }]}>
                  Please grant camera permission to see live footage
                </Text>
              </View>
            ) : isCameraOn && !isCameraAvailable ? (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraText}>
                  📹 Camera Loading...
                </Text>
                <Text style={[styles.cameraText, { fontSize: 12, marginTop: 10 }]}>
                  Camera: {typeof Camera}, Available: {isCameraAvailable ? 'Yes' : 'No'}
                </Text>
              </View>
            ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.cameraText}>
                  📹 Camera Off
                </Text>
                <Text style={[styles.cameraText, { fontSize: 12, marginTop: 10 }]}>
                  Tap camera button to start live stream
              </Text>
            </View>
            )}
          </View>

          {/* Stream Info */}
          <View style={styles.streamInfo}>
            <Text style={styles.streamTitle}>{streamTitle}</Text>
            {streamDescription ? (
              <Text style={styles.streamDescription}>{streamDescription}</Text>
            ) : null}
            <Text style={styles.viewerCount}>
              👀 {viewerCount} viewers watching
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, styles.muteButton]}
              onPress={toggleMute}
            >
              <Ionicons 
                name={isMuted ? "mic-off" : "mic"} 
                size={24} 
                color="#fff" 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: '#ff4444' }]}
              onPress={stopStream}
            >
              <Ionicons name="stop" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.cameraButton]}
              onPress={toggleCamera}
            >
              <Ionicons 
                name={isCameraOn ? "videocam" : "videocam-off"} 
                size={24} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>

          {/* Chat */}
          <View style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Live Chat</Text>
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
        </View>
      )}
    </View>
  );
};

export default LiveStreamScreen;
