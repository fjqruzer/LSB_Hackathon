import * as ImagePicker from 'expo-image-picker';
import { Platform, Image, Alert } from 'react-native';

// Request camera and photo library permissions
export const requestImagePermissions = async () => {
  try {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera and photo library permissions are required to add photos to your listing.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error requesting image permissions:', error);
    return false;
  }
};

// Pick images from photo library
export const pickImages = async (maxImages = 4) => {
  try {
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) return [];

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxImages,
      quality: 0.8,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets) {
      return result.assets.map(asset => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: 'image/jpeg',
        name: `image_${Date.now()}.jpg`
      }));
    }

    return [];
  } catch (error) {
    console.error('Error picking images:', error);
    return [];
  }
};

// Take a photo with camera
export const takePhoto = async () => {
  try {
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) return null;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`
      };
    }

    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
};

// Validate image file
export const validateImage = (imageUri) => {
  if (!imageUri) return false;
  
  // Basic validation - check if URI exists and is accessible
  // In a real app, you'd also check file size, dimensions, etc.
  return true;
};

// Get image dimensions (useful for validation)
export const getImageDimensions = (uri) => {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
};

// Compress image if needed (placeholder for future implementation)
export const compressImage = async (imageUri, quality = 0.8) => {
  // For now, return the original URI
  // In a real app, you'd use a library like react-native-image-compressor
  return imageUri;
};

// Generate thumbnail (placeholder for future implementation)
export const generateThumbnail = async (imageUri, size = 150) => {
  // For now, return the original URI
  // In a real app, you'd generate a smaller thumbnail
  return imageUri;
};
