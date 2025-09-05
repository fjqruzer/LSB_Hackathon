// Cloudinary configuration for React Native
const CLOUDINARY_CONFIG = {
  cloud_name: 'dzbhcbsti',
  api_key: '214283944224643',
  upload_preset: 'copit_listings', // This is the upload preset you need to create
  upload_url: 'https://api.cloudinary.com/v1_1/dzbhcbsti/image/upload'
};

// Function to upload image to Cloudinary using fetch
export const uploadImageToCloudinary = async (imageUri) => {
  try {
    console.log('🔄 Uploading image to Cloudinary...');
    
    // Create FormData for multipart upload
    const formData = new FormData();
    
    // Add the image file
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `image_${Date.now()}.jpg`
    });
    
    // Add Cloudinary parameters
    formData.append('upload_preset', CLOUDINARY_CONFIG.upload_preset);
    formData.append('folder', 'copit-listings');
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');

    // Upload to Cloudinary
    const response = await fetch(CLOUDINARY_CONFIG.upload_url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Image uploaded successfully:', result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error('❌ Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Function to upload multiple images
export const uploadMultipleImages = async (imageUris) => {
  try {
    console.log(`🔄 Uploading ${imageUris.length} images to Cloudinary...`);
    
    const uploadPromises = imageUris.map((uri, index) => 
      uploadImageToCloudinary(uri).catch(error => {
        console.error(`❌ Failed to upload image ${index + 1}:`, error);
        return null; // Return null for failed uploads
      })
    );

    const results = await Promise.all(uploadPromises);
    
    // Filter out null values (failed uploads)
    const successfulUploads = results.filter(url => url !== null);
    
    console.log(`✅ Successfully uploaded ${successfulUploads.length}/${imageUris.length} images`);
    return successfulUploads;
  } catch (error) {
    console.error('❌ Error uploading multiple images:', error);
    throw error;
  }
};

export default CLOUDINARY_CONFIG;
