import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function MainAppScreen({ navigation }) {
  const { user, logout, getUserProfile, testFirestore } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error loading user profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadUserProfile();
  }, [user, getUserProfile]);

  const handleLogout = async () => {
    try {
      await logout();
      navigation.navigate('Onboarding');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={0} ellipsizeMode="tail">
          Welcome to COPit!
        </Text>
        <Text style={styles.subtitle} numberOfLines={0} ellipsizeMode="tail">
          Your competitive thrift shopping app
        </Text>
        
        {user && (
          <View style={styles.userInfo}>
            {loading ? (
              <Text style={styles.userText}>Loading profile...</Text>
            ) : userProfile ? (
              <>
                <Text style={styles.userText}>
                  Welcome, {userProfile.firstName} {userProfile.lastName}!
                </Text>
                <Text style={styles.userDetailText}>
                  Username: {userProfile.username}
                </Text>
                <Text style={styles.userDetailText}>
                  Email: {userProfile.email}
                </Text>
                {userProfile.middleName && (
                  <Text style={styles.userDetailText}>
                    Middle Name: {userProfile.middleName}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.userText}>
                Logged in as: {user.displayName || user.email}
              </Text>
            )}
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.button}
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { marginTop: 15, backgroundColor: '#83AFA7' }]}
          onPress={async () => {
            const result = await testFirestore();
            if (result) {
              alert('Firestore test successful!');
            } else {
              alert('Firestore test failed!');
            }
          }}
        >
          <Text style={styles.buttonText}>Test Firestore</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF4D8',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#83AFA7',
    marginBottom: 10,
    textAlign: 'center',
    flexWrap: 'wrap',
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    flexWrap: 'wrap',
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#F68652',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfo: {
    backgroundColor: '#83AFA7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 30,
  },
  userText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  userDetailText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 5,
  },
});
