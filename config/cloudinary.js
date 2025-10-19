// Cloudinary configuration for React Native
const CLOUDINARY_CONFIG = {
  cloud_name: 'dgwmpacf8',
  api_key: '418685751885389',
  upload_preset: 'copit_listings', // This is the upload preset you need to create
  upload_url: 'https://api.cloudinary.com/v1_1/dgwmpacf8/image/upload'
};

// Test function to verify Cloudinary configuration
export const testCloudinaryConnection = async () => {
  try {
    console.log('🧪 Testing Cloudinary connection...');
    
    // Create a simple test payload
    const formData = new FormData();
    formData.append('upload_preset', CLOUDINARY_CONFIG.upload_preset);
    formData.append('folder', 'copit-test');
    
    const response = await fetch(CLOUDINARY_CONFIG.upload_url, {
      method: 'POST',
      body: formData,
    });
    
    console.log('🧪 Cloudinary test response:', response.status);
    return response.ok;
  } catch (error) {
    console.error('🧪 Cloudinary test failed:', error);
    return false;
  }
};

// Function to upload image to Cloudinary using fetch
export const uploadImageToCloudinary = async (imageUri) => {
  try {
    console.log('📤 Starting Cloudinary upload for:', imageUri);
    
    // Create FormData for multipart upload
    const formData = new FormData();
    
    // Add the image file with proper format for Android compatibility
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `payment_proof_${Date.now()}.jpg`
    });
    
    // Add Cloudinary parameters
    formData.append('upload_preset', CLOUDINARY_CONFIG.upload_preset);
    formData.append('folder', 'copit-payments');
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');

    console.log('📤 Uploading to Cloudinary with preset:', CLOUDINARY_CONFIG.upload_preset);

    // Upload to Cloudinary
    const response = await fetch(CLOUDINARY_CONFIG.upload_url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('📤 Cloudinary response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Upload failed:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Cloudinary upload successful:', result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error('❌ Error uploading to Cloudinary:', error);
    
    // If Cloudinary fails, we can either:
    // 1. Return the local URI as fallback
    // 2. Show an error and ask user to try again
    // 3. Use a different upload method
    
    // For now, let's throw the error but with more context
    throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
  }
};

// Function to upload multiple images
export const uploadMultipleImages = async (imageUris) => {
  try {
    const uploadPromises = imageUris.map((uri, index) => 
      uploadImageToCloudinary(uri).catch(error => {
        console.error(`Failed to upload image ${index + 1}:`, error);
        return null; // Return null for failed uploads
      })
    );

    const results = await Promise.all(uploadPromises);
    
    // Filter out null values (failed uploads)
    const successfulUploads = results.filter(url => url !== null);
    
    return successfulUploads;
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw error;
  }
};

export default CLOUDINARY_CONFIG;
