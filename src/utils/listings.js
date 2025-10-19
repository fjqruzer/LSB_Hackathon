import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';

// Create a new listing
export const createListing = async (listingData) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to create a listing');
    }

    // Prepare the listing data with user information
    const listing = {
      ...listingData,
      userId: user.uid,
      userEmail: user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: listingData.status || 'draft',
      views: 0,
      likes: 0,
      isActive: listingData.status === 'active'
    };

    // Add to listings collection
    const docRef = await addDoc(collection(db, 'listings'), listing);
    
    console.log('✅ Listing created successfully with ID:', docRef.id);
    
    return {
      success: true,
      listingId: docRef.id,
      message: 'Listing created successfully!'
    };
  } catch (error) {
    console.error('❌ Error creating listing:', error);
    throw new Error(`Failed to create listing: ${error.message}`);
  }
};

// Update an existing listing
export const updateListing = async (listingId, updates) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to update a listing');
    }

    const listingRef = doc(db, 'listings', listingId);
    const listingDoc = await getDoc(listingRef);
    
    if (!listingDoc.exists()) {
      throw new Error('Listing not found');
    }
    
    const listingData = listingDoc.data();
    if (listingData.userId !== user.uid) {
      throw new Error('You can only update your own listings');
    }

    // Update the listing
    await updateDoc(listingRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Listing updated successfully');
    
    return {
      success: true,
      message: 'Listing updated successfully!'
    };
  } catch (error) {
    console.error('❌ Error updating listing:', error);
    throw new Error(`Failed to update listing: ${error.message}`);
  }
};

// Delete a listing
export const deleteListing = async (listingId) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to delete a listing');
    }

    const listingRef = doc(db, 'listings', listingId);
    const listingDoc = await getDoc(listingRef);
    
    if (!listingDoc.exists()) {
      throw new Error('Listing not found');
    }
    
    const listingData = listingDoc.data();
    if (listingData.userId !== user.uid) {
      throw new Error('You can only delete your own listings');
    }

    await deleteDoc(listingRef);
    
    console.log('✅ Listing deleted successfully');
    
    return {
      success: true,
      message: 'Listing deleted successfully!'
    };
  } catch (error) {
    console.error('❌ Error deleting listing:', error);
    throw new Error(`Failed to delete listing: ${error.message}`);
  }
};

// Get a single listing by ID
export const getListing = async (listingId) => {
  try {
    const listingRef = doc(db, 'listings', listingId);
    const listingDoc = await getDoc(listingRef);
    
    if (!listingDoc.exists()) {
      return null;
    }
    
    return {
      id: listingDoc.id,
      ...listingDoc.data()
    };
  } catch (error) {
    console.error('❌ Error fetching listing:', error);
    throw new Error(`Failed to fetch listing: ${error.message}`);
  }
};

// Get user's listings (active, drafts, etc.)
export const getUserListings = async (status = null) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to fetch listings');
    }

    let listingsQuery = query(
      collection(db, 'listings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    if (status) {
      listingsQuery = query(listingsQuery, where('status', '==', status));
    }

    const querySnapshot = await getDocs(listingsQuery);
    const listings = [];
    
    querySnapshot.forEach((doc) => {
      listings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return listings;
  } catch (error) {
    console.error('❌ Error fetching user listings:', error);
    throw new Error(`Failed to fetch user listings: ${error.message}`);
  }
};

// Get all active listings (for browsing)
export const getActiveListings = async (limitCount = 20) => {
  try {
    const listingsQuery = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(listingsQuery);
    const listings = [];
    
    querySnapshot.forEach((doc) => {
      listings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return listings;
  } catch (error) {
    console.error('❌ Error fetching active listings:', error);
    throw new Error(`Failed to fetch active listings: ${error.message}`);
  }
};

// Search listings by category, type, or other criteria
export const searchListings = async (searchCriteria) => {
  try {
    const { category, type, priceRange, location } = searchCriteria;
    
    let listingsQuery = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      where('isActive', '==', true)
    );

    if (category) {
      listingsQuery = query(listingsQuery, where('category', '==', category));
    }

    if (type) {
      listingsQuery = query(listingsQuery, where('type', '==', type));
    }

    // Add more search criteria as needed
    listingsQuery = query(listingsQuery, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(listingsQuery);
    const listings = [];
    
    querySnapshot.forEach((doc) => {
      listings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return listings;
  } catch (error) {
    console.error('❌ Error searching listings:', error);
    throw new Error(`Failed to search listings: ${error.message}`);
  }
};

// Update listing status (draft to active, etc.)
export const updateListingStatus = async (listingId, newStatus) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to update listing status');
    }

    const listingRef = doc(db, 'listings', listingId);
    const listingDoc = await getDoc(listingRef);
    
    if (!listingDoc.exists()) {
      throw new Error('Listing not found');
    }
    
    const listingData = listingDoc.data();
    if (listingData.userId !== user.uid) {
      throw new Error('You can only update your own listings');
    }

    const updates = {
      status: newStatus,
      isActive: newStatus === 'active',
      updatedAt: serverTimestamp()
    };

    // If activating a listing, set the deadline
    if (newStatus === 'active' && listingData.deadline) {
      updates.deadline = listingData.deadline;
    }

    await updateDoc(listingRef, updates);

    console.log('✅ Listing status updated successfully');
    
    return {
      success: true,
      message: 'Listing status updated successfully!'
    };
  } catch (error) {
    console.error('❌ Error updating listing status:', error);
    throw new Error(`Failed to update listing status: ${error.message}`);
  }
};
