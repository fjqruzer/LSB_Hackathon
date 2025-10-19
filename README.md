# COPit - Thrifting Community App

A React Native mobile application for the thrifting community, built with Expo and Firebase.

## Features

- **User Registration & Authentication**: Multi-step registration process with Firebase Auth
- **Location-based Services**: Philippine regions, provinces, cities, and barangays
- **Form Validation**: Comprehensive client-side validation with error handling
- **Modern UI/UX**: Beautiful, responsive design with step-by-step onboarding

## Prerequisites

- Node.js (v16 or higher)
- Expo CLI
- Firebase project
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd COPit
```

2. Install dependencies:
```bash
npm install
```

3. Install Expo CLI globally (if not already installed):
```bash
npm install -g @expo/cli
```

## Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)

2. Enable the following services:
   - **Authentication** (Email/Password)
   - **Firestore Database**

3. Update the Firebase configuration in `src/utils/firebase.js`:
```javascript
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

4. Set up Firestore security rules (copy from `firestore.rules` file):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /otp_codes/{email} {
      allow read, write: if true; // Allow during development
    }
    
    match /public/{document=**} {
      allow read: if request.auth != null;
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Running the App

### Development
```bash
npm start
```

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

### Web
```bash
npm run web
```

## Project Structure

```
COPit/
├── src/
│   ├── screens/          # App screens
│   │   ├── SignupScreen.js
│   │   ├── LoginScreen.js
│   │   ├── HomePage.js
│   │   └── ...
│   ├── utils/            # Utility functions
│   │   ├── firebase.js   # Firebase configuration
│   │   ├── auth.js       # Authentication functions
│   │   └── validation.js # Form validation
│   └── navigation/       # Navigation configuration
├── android/              # Android-specific files
├── ios/                  # iOS-specific files
└── package.json
```

## Key Components

### SignupScreen
- Multi-step registration process
- Real-time form validation
- Location selection (Philippine regions)
- Firebase integration with OTP verification
- Error handling and user feedback

### Authentication System
- Firebase Auth integration
- OTP verification for registration and login
- User profile storage in Firestore
- Secure password requirements
- Session management

### OTP Verification System
- 6-digit OTP generation and verification
- Email-based OTP delivery
- 10-minute expiration with retry limits
- Secure OTP storage in Firestore
- Support for both registration and login

### Form Validation
- Client-side validation
- Real-time error feedback
- Step-by-step validation
- User-friendly error messages

## Dependencies

- **React Native**: Core framework
- **Expo**: Development platform
- **Firebase**: Backend services
- **React Navigation**: Navigation system
- **React Native Element Dropdown**: Location selection components

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the 0BSD License.

## Support

For support and questions, please open an issue in the repository.
