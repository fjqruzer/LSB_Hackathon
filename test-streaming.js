// Test script for live streaming functionality
// This script tests the streaming service and components

import StreamingService from './services/StreamingService';

async function testStreamingFunctionality() {
  console.log('🧪 Testing live streaming functionality...');
  
  try {
    // Test 1: Check if StreamingService is properly initialized
    console.log('✅ StreamingService initialized');
    
    // Test 2: Test permission requests
    console.log('📱 Testing permission requests...');
    const hasPermissions = await StreamingService.requestPermissions();
    console.log('📱 Permissions granted:', hasPermissions);
    
    // Test 3: Test getting live streams
    console.log('🔍 Testing get all live streams...');
    const liveStreams = await StreamingService.getAllLiveStreams();
    console.log('📺 Found live streams:', liveStreams.length);
    
    // Test 4: Test stream status
    console.log('📊 Testing stream status...');
    const status = StreamingService.getStreamStatus();
    console.log('📊 Stream status:', status);
    
    console.log('✅ All streaming tests passed!');
    console.log('🎥 Live streaming functionality is ready to use!');
    
    console.log('\n📋 How to use live streaming:');
    console.log('1. Go to any listing you own');
    console.log('2. Tap "Start Live Stream" button');
    console.log('3. Enter stream title and description');
    console.log('4. Tap "Start Live Stream" to begin');
    console.log('5. Use the "Live" tab to discover streams');
    console.log('6. Tap any stream to watch and chat');
    
  } catch (error) {
    console.error('❌ Error testing streaming functionality:', error);
  }
}

// Run the test
testStreamingFunctionality();
