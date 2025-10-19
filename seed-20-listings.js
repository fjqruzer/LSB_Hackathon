const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCOfzExqkWGCaWK0UyL8y7G1h7SfyFm560",
  authDomain: "copit-ce43f.firebaseapp.com",
  projectId: "copit-ce43f",
  storageBucket: "copit-ce43f.firebasestorage.app",
  messagingSenderId: "357039645731",
  appId: "1:357039645731:web:460a02d30811bd83437d96",
  measurementId: "G-MQT39KJPG1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Stock images for different categories
const stockImages = {
  clothing: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=500',
    'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500',
    'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500',
    'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=500'
  ],
  shoes: [
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500'
  ],
  accessories: [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500',
    'https://images.unsplash.com/photo-1506629905607-0b4b0a4b0a4b?w=500',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500',
    'https://images.unsplash.com/photo-1506629905607-0b4b0a4b0a4b?w=500',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500'
  ],
  bags: [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500'
  ],
  electronics: [
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500',
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500',
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500',
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500',
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500'
  ]
};

// Sample listing data
const sampleListings = [
  // 3 Bidding Listings
  {
    title: "Vintage Nike Air Jordan 1 Retro High",
    description: "Classic red and white colorway, perfect condition. Size 9.5. Rare find!",
    type: "bidding",
    category: "shoes",
    brand: "Nike",
    size: "9.5",
    condition: "excellent",
    priceType: "bidding",
    startingPrice: 5000,
    minimumBidIncrement: 200,
    currentBid: 5000,
    dealMethod: "delivery",
    images: stockImages.shoes.slice(0, 3)
  },
  {
    title: "Limited Edition Supreme Box Logo Hoodie",
    description: "Black hoodie with white box logo. Size L. Worn only a few times.",
    type: "bidding",
    category: "clothing",
    brand: "Supreme",
    size: "L",
    condition: "good",
    priceType: "bidding",
    startingPrice: 8000,
    minimumBidIncrement: 500,
    currentBid: 8000,
    dealMethod: "delivery",
    images: stockImages.clothing.slice(0, 3)
  },
  {
    title: "Apple MacBook Pro 13-inch M1",
    description: "2020 model, 8GB RAM, 256GB SSD. Excellent condition, barely used.",
    type: "bidding",
    category: "electronics",
    brand: "Apple",
    size: "13-inch",
    condition: "excellent",
    priceType: "bidding",
    startingPrice: 45000,
    minimumBidIncrement: 1000,
    currentBid: 45000,
    dealMethod: "delivery",
    images: stockImages.electronics.slice(0, 3)
  },
  
  // 17 MSL Listings
  {
    title: "Designer Leather Jacket",
    description: "Genuine leather, perfect fit. Size M. Great for any occasion.",
    type: "msl",
    category: "clothing",
    brand: "Zara",
    size: "M",
    condition: "good",
    priceType: "msl",
    minePrice: 2500,
    stealPrice: 2000,
    lockPrice: 3000,
    dealMethod: "delivery",
    images: stockImages.clothing.slice(0, 3)
  },
  {
    title: "Vintage Denim Jeans",
    description: "Classic blue wash, high waist. Size 28. Perfect vintage fit.",
    type: "msl",
    category: "clothing",
    brand: "Levi's",
    size: "28",
    condition: "good",
    priceType: "msl",
    minePrice: 1200,
    stealPrice: 1000,
    lockPrice: 1500,
    dealMethod: "delivery",
    images: stockImages.clothing.slice(1, 4)
  },
  {
    title: "Casual Sneakers",
    description: "White canvas sneakers, very comfortable. Size 8.5. Clean and fresh.",
    type: "msl",
    category: "shoes",
    brand: "Converse",
    size: "8.5",
    condition: "excellent",
    priceType: "msl",
    minePrice: 1800,
    stealPrice: 1500,
    lockPrice: 2200,
    dealMethod: "delivery",
    images: stockImages.shoes.slice(0, 3)
  },
  {
    title: "Designer Handbag",
    description: "Black leather handbag, perfect for daily use. Great condition.",
    type: "msl",
    category: "bags",
    brand: "Coach",
    size: "One Size",
    condition: "excellent",
    priceType: "msl",
    minePrice: 3500,
    stealPrice: 3000,
    lockPrice: 4000,
    dealMethod: "delivery",
    images: stockImages.bags.slice(0, 3)
  },
  {
    title: "Vintage T-Shirt",
    description: "Band t-shirt from the 90s. Size L. Rare vintage piece.",
    type: "msl",
    category: "clothing",
    brand: "Vintage",
    size: "L",
    condition: "fair",
    priceType: "msl",
    minePrice: 800,
    stealPrice: 600,
    lockPrice: 1000,
    dealMethod: "delivery",
    images: stockImages.clothing.slice(2, 5)
  },
  {
    title: "Running Shoes",
    description: "Nike running shoes, great for workouts. Size 10. Lightly used.",
    type: "msl",
    category: "shoes",
    brand: "Nike",
    size: "10",
    condition: "good",
    priceType: "msl",
    minePrice: 2200,
    stealPrice: 1800,
    lockPrice: 2600,
    dealMethod: "delivery",
    images: stockImages.shoes.slice(1, 4)
  },
  {
    title: "Statement Necklace",
    description: "Gold-plated statement necklace. Perfect for special occasions.",
    type: "msl",
    category: "accessories",
    brand: "H&M",
    size: "One Size",
    condition: "excellent",
    priceType: "msl",
    minePrice: 600,
    stealPrice: 500,
    lockPrice: 750,
    dealMethod: "delivery",
    images: stockImages.accessories.slice(0, 3)
  },
  {
    title: "Vintage Sunglasses",
    description: "Classic aviator style sunglasses. UV protection included.",
    type: "msl",
    category: "accessories",
    brand: "Ray-Ban",
    size: "One Size",
    condition: "good",
    priceType: "msl",
    minePrice: 1500,
    stealPrice: 1200,
    lockPrice: 1800,
    dealMethod: "delivery",
    images: stockImages.accessories.slice(1, 4)
  },
  {
    title: "Designer Blouse",
    description: "Silk blouse, perfect for office or dinner. Size S. Elegant design.",
    type: "msl",
    category: "clothing",
    brand: "Uniqlo",
    size: "S",
    condition: "excellent",
    priceType: "msl",
    minePrice: 1800,
    stealPrice: 1500,
    lockPrice: 2200,
    dealMethod: "delivery",
    images: stockImages.clothing.slice(0, 3)
  },
  {
    title: "Canvas Backpack",
    description: "Durable canvas backpack, perfect for school or travel. Great condition.",
    type: "msl",
    category: "bags",
    brand: "Herschel",
    size: "One Size",
    condition: "good",
    priceType: "msl",
    minePrice: 2000,
    stealPrice: 1600,
    lockPrice: 2400,
    dealMethod: "delivery",
    images: stockImages.bags.slice(0, 3)
  },
  {
    title: "Vintage Watch",
    description: "Classic analog watch, working perfectly. Great vintage piece.",
    type: "msl",
    category: "accessories",
    brand: "Seiko",
    size: "One Size",
    condition: "good",
    priceType: "msl",
    minePrice: 3000,
    stealPrice: 2500,
    lockPrice: 3500,
    dealMethod: "delivery",
    images: stockImages.accessories.slice(2, 5)
  },
  {
    title: "Denim Shorts",
    description: "High-waisted denim shorts, perfect for summer. Size 30.",
    type: "msl",
    category: "clothing",
    brand: "Hollister",
    size: "30",
    condition: "excellent",
    priceType: "msl",
    minePrice: 1000,
    stealPrice: 800,
    lockPrice: 1200,
    dealMethod: "delivery",
    images: stockImages.clothing.slice(1, 4)
  },
  {
    title: "Casual Loafers",
    description: "Brown leather loafers, very comfortable. Size 9. Perfect for office.",
    type: "msl",
    category: "shoes",
    brand: "Clarks",
    size: "9",
    condition: "good",
    priceType: "msl",
    minePrice: 2500,
    stealPrice: 2000,
    lockPrice: 3000,
    dealMethod: "delivery",
    images: stockImages.shoes.slice(0, 3)
  },
  {
    title: "Designer Scarf",
    description: "Silk scarf with beautiful pattern. Perfect accessory for any outfit.",
    type: "msl",
    category: "accessories",
    brand: "Gucci",
    size: "One Size",
    condition: "excellent",
    priceType: "msl",
    minePrice: 4000,
    stealPrice: 3500,
    lockPrice: 4500,
    dealMethod: "delivery",
    images: stockImages.accessories.slice(0, 3)
  },
  {
    title: "Vintage Sweater",
    description: "Cozy knit sweater, perfect for winter. Size M. Great condition.",
    type: "msl",
    category: "clothing",
    brand: "Gap",
    size: "M",
    condition: "good",
    priceType: "msl",
    minePrice: 1200,
    stealPrice: 1000,
    lockPrice: 1500,
    dealMethod: "delivery",
    images: stockImages.clothing.slice(2, 5)
  },
  {
    title: "Leather Wallet",
    description: "Genuine leather wallet, multiple card slots. Great for daily use.",
    type: "msl",
    category: "accessories",
    brand: "Fossil",
    size: "One Size",
    condition: "excellent",
    priceType: "msl",
    minePrice: 800,
    stealPrice: 600,
    lockPrice: 1000,
    dealMethod: "delivery",
    images: stockImages.accessories.slice(1, 4)
  },
  {
    title: "Designer Dress",
    description: "Elegant black dress, perfect for special occasions. Size S.",
    type: "msl",
    category: "clothing",
    brand: "Zara",
    size: "S",
    condition: "excellent",
    priceType: "msl",
    minePrice: 2800,
    stealPrice: 2200,
    lockPrice: 3200,
    dealMethod: "delivery",
    images: stockImages.clothing.slice(0, 3)
  },
  {
    title: "Vintage Boots",
    description: "Classic brown leather boots, perfect for fall. Size 8.5.",
    type: "msl",
    category: "shoes",
    brand: "Dr. Martens",
    size: "8.5",
    condition: "good",
    priceType: "msl",
    minePrice: 3500,
    stealPrice: 3000,
    lockPrice: 4000,
    dealMethod: "delivery",
    images: stockImages.shoes.slice(1, 4)
  }
];

async function findUserByEmail(email) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error(`No user found with email: ${email}`);
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    console.log(`✅ Found user: ${userData.displayName || 'Unknown'} (${userData.email})`);
    console.log(`📋 User UID: ${userDoc.id}`);
    
    return {
      uid: userDoc.id,
      ...userData
    };
  } catch (error) {
    console.error('❌ Error finding user:', error);
    throw error;
  }
}

async function seedListings(user) {
  try {
    console.log(`\n🌱 Starting to seed 20 listings for user: ${user.displayName || user.email}`);
    
    // Set expiration date to October 6, 2025, 8:30 PM
    const expirationDate = new Date('2025-10-06T20:30:00');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < sampleListings.length; i++) {
      const listing = sampleListings[i];
      
      try {
        const listingData = {
          ...listing,
          sellerId: user.uid,
          sellerName: user.displayName || 'Anonymous',
          sellerEmail: user.email,
          status: 'active',
          endDateTime: expirationDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          views: 0,
          likes: 0,
          participants: [],
          bids: listing.type === 'bidding' ? [] : undefined,
          lockedBy: null,
          lockedAt: null,
          winnerId: null,
          winnerName: null,
          winnerEmail: null,
          paymentStatus: 'pending',
          paymentDeadline: null,
          paymentMethod: null,
          paymentProof: null,
          deliveryAddress: null,
          completedAt: null,
          cancelledAt: null,
          cancellationReason: null
        };
        
        // Remove undefined fields
        Object.keys(listingData).forEach(key => {
          if (listingData[key] === undefined) {
            delete listingData[key];
          }
        });
        
        const docRef = await addDoc(collection(db, 'listings'), listingData);
        console.log(`✅ Created listing ${i + 1}/20: ${listing.title} (ID: ${docRef.id})`);
        successCount++;
        
        // Add small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error creating listing ${i + 1}: ${listing.title}`, error);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Seeding Summary:`);
    console.log(`✅ Successfully created: ${successCount} listings`);
    console.log(`❌ Failed to create: ${errorCount} listings`);
    console.log(`📅 All listings expire on: ${expirationDate.toLocaleString()}`);
    
    return { successCount, errorCount };
    
  } catch (error) {
    console.error('❌ Error seeding listings:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting listing seeding process...\n');
    
    // Find user by email
    const user = await findUserByEmail('kcanapati6@gmail.com');
    
    // Seed listings
    const result = await seedListings(user);
    
    if (result.successCount > 0) {
      console.log(`\n🎉 Successfully seeded ${result.successCount} listings!`);
    } else {
      console.log('\n❌ No listings were created successfully.');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();


