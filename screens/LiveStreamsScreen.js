import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import StreamingService from '../services/StreamingService';

const { width } = Dimensions.get('window');

const LiveStreamsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme } = useTheme();

  // State management
  const [liveStreams, setLiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  useEffect(() => {
    loadLiveStreams();
  }, []);

  const loadLiveStreams = async () => {
    try {
      setLoading(true);
      const streams = await StreamingService.getAllLiveStreams();
      setLiveStreams(streams);
    } catch (error) {
      console.error('Error loading live streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLiveStreams();
    setRefreshing(false);
  };

  const joinStream = (stream) => {
    navigation.navigate('StreamViewer', { stream });
  };

  const formatDuration = (startTime) => {
    if (!startTime) return '00:00';
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const renderStreamItem = ({ item }) => (
    <TouchableOpacity
      style={styles.streamCard}
      onPress={() => joinStream(item)}
    >
      {/* Stream Thumbnail */}
      <View style={styles.thumbnailContainer}>
        <View style={styles.thumbnailPlaceholder}>
          <Ionicons name="videocam" size={40} color="#fff" />
        </View>
        
        {/* Live Badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        {/* Viewer Count */}
        <View style={styles.viewerBadge}>
          <Ionicons name="eye" size={12} color="#fff" />
          <Text style={styles.viewerText}>{item.viewerCount || 0}</Text>
        </View>

        {/* Duration */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {formatDuration(item.startTime)}
          </Text>
        </View>
      </View>

      {/* Stream Info */}
      <View style={styles.streamInfo}>
        <Text style={styles.streamTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.streamerName}>
          {item.streamerName}
        </Text>
        {item.description ? (
          <Text style={styles.streamDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="videocam-off" size={60} color={theme.colors.textSecondary} />
      <Text style={styles.emptyTitle}>No Live Streams</Text>
      <Text style={styles.emptyDescription}>
        There are no live streams at the moment.{'\n'}
        Check back later or start your own stream!
      </Text>
      <TouchableOpacity
        style={styles.startStreamButton}
        onPress={() => navigation.navigate('PostListing')}
      >
        <Text style={styles.startStreamButtonText}>Start Streaming</Text>
      </TouchableOpacity>
    </View>
  );

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
      fontSize: 20,
      fontFamily: 'Poppins-SemiBold',
      color: theme.colors.text,
    },
    refreshButton: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
    streamsList: {
      padding: 20,
    },
    streamCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      marginBottom: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    thumbnailContainer: {
      width: '100%',
      height: 200,
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    thumbnailPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    liveBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ff4444',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#fff',
      marginRight: 4,
    },
    liveText: {
      color: '#fff',
      fontSize: 12,
      fontFamily: 'Poppins-SemiBold',
    },
    viewerBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    viewerText: {
      color: '#fff',
      fontSize: 12,
      fontFamily: 'Poppins-Medium',
      marginLeft: 4,
    },
    durationBadge: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    durationText: {
      color: '#fff',
      fontSize: 12,
      fontFamily: 'Poppins-Medium',
    },
    streamInfo: {
      padding: 15,
    },
    streamTitle: {
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    streamerName: {
      fontSize: 14,
      fontFamily: 'Poppins-Medium',
      color: theme.colors.primary,
      marginBottom: 8,
    },
    streamDescription: {
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 20,
      fontFamily: 'Poppins-SemiBold',
      color: theme.colors.text,
      marginTop: 20,
      marginBottom: 10,
    },
    emptyDescription: {
      fontSize: 14,
      fontFamily: 'Poppins-Regular',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 30,
    },
    startStreamButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 30,
      paddingVertical: 15,
      borderRadius: 8,
    },
    startStreamButtonText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      fontFamily: 'Poppins-Medium',
      color: theme.colors.text,
      marginTop: 10,
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Streams</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading streams...</Text>
          </View>
        ) : liveStreams.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={liveStreams}
            renderItem={renderStreamItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.streamsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

export default LiveStreamsScreen;
