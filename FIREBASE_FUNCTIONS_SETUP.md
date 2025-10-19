# 🔥 Firebase Functions Setup for COPit OTP Emails

This guide will help you set up and deploy Firebase Functions to send real OTP emails instead of using the mock service.

## 📋 Prerequisites

1. **Firebase Project**: You already have `copit-090603` project
2. **Firebase CLI**: Already installed and configured
3. **Node.js**: Version 18+ (Firebase Functions requirement)
4. **Email Service**: Gmail, SendGrid, or similar email service

## 🚀 Step 1: Configure Email Service

### Option A: Gmail (Recommended for testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Copy the 16-character password

3. **Update `functions/config.js`**:
   ```javascript
   module.exports = {
     email: {
       service: 'gmail',
       auth: {
         user: 'your-email@gmail.com',        // Replace with your Gmail
         pass: 'your-16-char-app-password'   // Replace with app password
       }
     },
     region: 'asia-southeast1'
   };
   ```

### Option B: SendGrid (Recommended for production)

1. **Create SendGrid Account** at [sendgrid.com](https://sendgrid.com)
2. **Generate API Key**:
   - Dashboard → Settings → API Keys
   - Create API Key with "Mail Send" permissions
   - Copy the API key

3. **Update `functions/config.js`**:
   ```javascript
   module.exports = {
     email: {
       service: 'sendgrid',
       auth: {
         user: 'apikey',
         pass: 'your-sendgrid-api-key'
       }
     },
     region: 'asia-southeast1'
   };
   ```

## 🔧 Step 2: Set Environment Variables (Production)

For production deployment, set environment variables in Firebase Console:

1. **Go to Firebase Console** → **Functions** → **Configuration**
2. **Add Environment Variables**:
   - `EMAIL_USER`: Your email address
   - `EMAIL_PASS`: Your email password/API key

## 🚀 Step 3: Deploy Firebase Functions

### Local Testing (Optional)
```bash
cd functions
npm run serve
```

### Deploy to Production
```bash
# Deploy only functions
firebase deploy --only functions

# Or deploy everything
firebase deploy
```

## 📧 Step 4: Test Email Function

### Test via Firebase Console
1. Go to **Functions** → **sendOTPEmail**
2. Click **"Test function"**
3. Use this test data:
   ```json
   {
     "data": {
       "email": "your-test-email@example.com",
       "otp": "123456",
       "type": "registration",
       "firstName": "Test User"
     }
   }
   ```

### Test via Your App
The app will automatically use the deployed functions once deployed.

## 🔍 Step 5: Verify Deployment

After deployment, you should see:
- ✅ Functions deployed successfully
- ✅ Functions visible in Firebase Console
- ✅ No more mock email service errors
- ✅ Real emails being sent

## 🛠️ Troubleshooting

### Common Issues:

1. **"Functions not found" error**:
   - Ensure functions are deployed: `firebase deploy --only functions`
   - Check region matches in both functions and app

2. **"Permission denied" error**:
   - Verify Firebase project ID matches
   - Check authentication in your app

3. **"Email not sent" error**:
   - Verify email credentials in `config.js`
   - Check Firebase Functions logs for errors
   - Ensure email service is properly configured

4. **"Region mismatch" error**:
   - Update region in `functions/config.js` to match your preference
   - Update region in `src/utils/emailService.js` to match

### Check Function Logs:
```bash
firebase functions:log
```

## 📱 App Integration

The app automatically uses Firebase Functions once deployed. No code changes needed in the main app files.

## 🔒 Security Notes

1. **Never commit email credentials** to version control
2. **Use environment variables** for production
3. **Enable Firebase Authentication** for function access control
4. **Monitor function usage** to prevent abuse

## 📊 Monitoring

- **Firebase Console** → **Functions** → **Usage**
- **Function logs** for debugging
- **Email delivery reports** from your email service

## 🎯 Next Steps

After successful deployment:
1. ✅ Test OTP emails work
2. ✅ Remove mock service references
3. ✅ Monitor function performance
4. ✅ Set up email delivery monitoring

---

**Need Help?** Check Firebase Functions documentation or contact support.
