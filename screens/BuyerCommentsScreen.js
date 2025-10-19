import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import StandardModal from '../components/StandardModal';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const BuyerCommentsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load Poppins fonts
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  // Fetch buyer comments/ratings
  const fetchComments = async () => {
    if (!user) {
      console.log('❌ BuyerCommentsScreen - No user found');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 BuyerCommentsScreen - Fetching comments for seller:', user.uid);
      
      // Get all ratings/comments for this seller
      const ratingsRef = collection(db, 'ratings');
      const q = query(
        ratingsRef, 
        where('sellerId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      const commentsList = [];
      
      for (const docSnapshot of snapshot.docs) {
        const ratingData = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Get listing details
        try {
          const listingDoc = await getDoc(doc(db, 'listings', ratingData.listingId));
          if (listingDoc.exists()) {
            ratingData.listingData = { id: listingDoc.id, ...listingDoc.data() };
          }
        } catch (error) {
          console.error('Error fetching listing data:', error);
        }
        
        commentsList.push(ratingData);
      }
      
      // Sort comments by creation date (newest first)
      commentsList.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bTime - aTime;
      });
      
      console.log('📊 BuyerCommentsScreen - Total comments found:', commentsList.length);
      setComments(commentsList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching comments:', error);
      showError('Failed to load comments. Please try again.');
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchComments();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchComments();
  }, [user]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStars = (rating) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? "star" : "star-outline"}
            size={14}
            color={star <= rating ? "#FFD700" : "#DDD"}
          />
        ))}
      </View>
    );
  };

  const getRatingText = (rating) => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'No Rating';
    }
  };

  const getAverageRating = () => {
    if (comments.length === 0) return 0;
    const totalRating = comments.reduce((sum, comment) => sum + comment.rating, 0);
    return (totalRating / comments.length).toFixed(1);
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    comments.forEach(comment => {
      distribution[comment.rating]++;
    });
    return distribution;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            Buyer Comments
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
            Loading comments...
          </Text>
        </View>
      </View>
    );
  }

  const averageRating = getAverageRating();
  const ratingDistribution = getRatingDistribution();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined, color: colors.accent }]}>
          Buyer Comments
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Rating Summary */}
        {comments.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.averageRatingContainer}>
                <Text style={[styles.averageRatingNumber, { fontFamily: fontsLoaded ? "Poppins-Bold" : undefined }]}>
                  {averageRating}
                </Text>
                <View style={styles.averageStarsContainer}>
                  {renderStars(Math.round(averageRating))}
                </View>
                <Text style={[styles.totalReviews, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                  {comments.length} review{comments.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Rating Distribution */}
            <View style={styles.distributionContainer}>
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = ratingDistribution[rating];
                const percentage = comments.length > 0 ? (count / comments.length) * 100 : 0;
                
                return (
                  <View key={rating} style={styles.distributionRow}>
                    <Text style={[styles.distributionLabel, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      {rating} star{rating !== 1 ? 's' : ''}
                    </Text>
                    <View style={styles.distributionBarContainer}>
                      <View style={[styles.distributionBar, { width: `${percentage}%` }]} />
                    </View>
                    <Text style={[styles.distributionCount, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Comments List */}
        <View style={styles.commentsSection}>
          <Text style={[styles.sectionTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
            All Comments ({comments.length})
          </Text>
          
          {comments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
              <Text style={[styles.emptyTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                No Comments Yet
              </Text>
              <Text style={[styles.emptySubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                You haven't received any buyer comments yet. Keep selling great items!
              </Text>
            </View>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={[styles.commentIcon, { backgroundColor: '#83AFA720' }]}>
                    <Text style={[styles.commentInitial, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      {comment.buyerName ? comment.buyerName.charAt(0).toUpperCase() : 'B'}
                    </Text>
                  </View>
                  <View style={styles.commentContent}>
                    <Text style={[styles.commentTitle, { fontFamily: fontsLoaded ? "Poppins-SemiBold" : undefined }]}>
                      {comment.buyerName || 'Anonymous Buyer'}
                    </Text>
                    <Text style={[styles.commentSubtitle, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      {formatDate(comment.createdAt)} • {getRatingText(comment.rating)}
                    </Text>
                  </View>
                  <View style={styles.ratingContainer}>
                    {renderStars(comment.rating)}
                  </View>
                </View>

                {comment.listingData && (
                  <View style={styles.listingInfo}>
                    <Text style={[styles.listingLabel, { fontFamily: fontsLoaded ? "Poppins-Medium" : undefined }]}>
                      For: {comment.listingData.title}
                    </Text>
                  </View>
                )}

                {comment.comment && (
                  <View style={styles.commentTextContainer}>
                    <Text style={[styles.commentText, { fontFamily: fontsLoaded ? "Poppins-Regular" : undefined }]}>
                      "{comment.comment}"
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Error Modal */}
      <StandardModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message={errorMessage}
        confirmText="OK"
        onConfirm={() => setShowErrorModal(false)}
        showCancel={false}
        confirmButtonStyle="primary"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DFECE2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  averageRatingContainer: {
    alignItems: 'center',
  },
  averageRatingNumber: {
    fontSize: 36,
    color: '#333',
    marginBottom: 6,
  },
  averageStarsContainer: {
    marginBottom: 6,
  },
  totalReviews: {
    fontSize: 13,
    color: '#666',
  },
  distributionContainer: {
    marginTop: 12,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  distributionLabel: {
    fontSize: 11,
    color: '#666',
    width: 50,
  },
  distributionBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  distributionBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  distributionCount: {
    fontSize: 11,
    color: '#666',
    width: 25,
    textAlign: 'right',
  },
  commentsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#83AFA7',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  commentCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  commentInitial: {
    fontSize: 16,
    color: '#83AFA7',
  },
  commentContent: {
    flex: 1,
  },
  commentTitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 1,
  },
  commentSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  ratingContainer: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
  },
  listingInfo: {
    marginTop: 8,
    paddingLeft: 48,
  },
  listingLabel: {
    fontSize: 12,
    color: '#666',
  },
  commentTextContainer: {
    marginTop: 8,
    paddingLeft: 48,
  },
  commentText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

export default BuyerCommentsScreen;
