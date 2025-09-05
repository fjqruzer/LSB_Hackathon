# Cloudinary Setup Guide

## 🚀 Quick Setup

### 1. Create Cloudinary Account
1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Verify your email

### 2. Get Your Credentials
1. Go to your [Cloudinary Dashboard](https://console.cloudinary.com)
2. Copy these values:
   - **Cloud Name** (e.g., `dxy123abc`)
   - **API Key** (e.g., `123456789012345`)
   - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### 3. Create Upload Preset
1. Go to [Cloudinary Dashboard](https://console.cloudinary.com)
2. Click **"Settings"** (gear icon)
3. Go to **"Upload"** tab
4. Scroll to **"Upload presets"**
5. Click **"Add upload preset"**
6. Set these values:
   - **Preset name:** `copit_listings`
   - **Signing Mode:** `Unsigned`
   - **Folder:** `copit-listings`
   - **Quality:** `Auto`
   - **Format:** `Auto`
7. Click **"Save"**

### 4. Update Configuration
Your configuration is already set up in `config/cloudinary.js`:

```javascript
const CLOUDINARY_CONFIG = {
  cloud_name: 'dzbhcbsti',
  api_key: '214283944224643',
  upload_preset: 'copit_listings', // This matches your upload preset
  upload_url: 'https://api.cloudinary.com/v1_1/dzbhcbsti/image/upload'
};
```

### 5. Test Upload
1. Run your app: `npm start`
2. Try posting a listing with photos
3. Check the console for upload success messages

## 🎯 Benefits of Cloudinary

### ✅ **Reliable Image Hosting**
- 99.9% uptime guarantee
- Global CDN (Content Delivery Network)
- Automatic image optimization

### ✅ **Easy Setup**
- No complex Firebase Storage rules
- Simple API
- Great documentation

### ✅ **Free Tier**
- 25GB storage
- 25GB bandwidth per month
- 25,000 transformations per month

### ✅ **Automatic Features**
- Image compression
- Format conversion (WebP, AVIF)
- Responsive images
- Watermarking (if needed)

## 🔧 Troubleshooting

### Common Issues:

1. **"Invalid cloud name"**
   - Check your cloud name in the dashboard
   - Make sure there are no extra spaces

2. **"Invalid API key"**
   - Verify your API key is correct
   - Check if you copied the full key

3. **"Upload failed"**
   - Check your internet connection
   - Verify image file size (should be under 10MB)
   - Check console for detailed error messages

### Need Help?
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [React Native Integration](https://cloudinary.com/documentation/react_native_integration)
- [Free Support](https://support.cloudinary.com)

## 🎉 You're All Set!

Once configured, your app will:
- Upload images to Cloudinary's secure servers
- Generate public URLs for each image
- Store these URLs in Firestore
- Display images to all users

No more Firebase Storage errors! 🚀
