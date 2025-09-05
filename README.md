# COPit - Competitive Thrift Shopping App

A React Native/Expo app with Firebase authentication for competitive thrift shopping.

## Features

- **Onboarding Flow**: Multi-step introduction to the app
- **User Authentication**: Signup and login with Firebase
- **Multi-step Signup**: Email, names, and password sections
- **Responsive Design**: Optimized for different screen sizes
- **Modern UI**: Clean, minimalist design with custom fonts

## Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter your project name (e.g., "copit-app")
4. Follow the setup wizard

### 2. Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" authentication
5. Click "Save"

### 3. Get Firebase Config

1. In your Firebase project, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web app icon (</>)
5. Register your app with a nickname
6. Copy the firebaseConfig object

### 4. Update Firebase Config

Replace the placeholder values in `config/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npx expo start
   ```

3. Scan the QR code with Expo Go app on your device

## Project Structure

```
├── App.js                 # Main app component with navigation
├── config/
│   └── firebase.js       # Firebase configuration
├── contexts/
│   └── AuthContext.js    # Authentication context
├── screens/
│   ├── OnboardingScreen.js  # Multi-step onboarding
│   ├── SignupScreen.js      # User registration
│   ├── LoginScreen.js       # User login
│   └── MainAppScreen.js     # Main app after authentication
└── assets/
    ├── fonts/             # Custom Poppins fonts
    └── images/            # App images and logos
```

## Authentication Flow

1. **Onboarding** → User sees app introduction
2. **Signup** → 3-step registration process
   - Email & Username
   - First, Middle (optional), Last Name
   - Password & Confirmation
3. **Login** → Email and password authentication
4. **Main App** → Authenticated user interface

## Styling

- **Colors**: Consistent color palette with teal (#83AFA7), orange (#F68652), and cream (#FEF4D8)
- **Fonts**: Poppins font family (Regular, SemiBold, Bold, BoldItalic)
- **Layout**: Flexbox-based responsive design
- **Components**: Reusable button and input field styles

## Dependencies

- React Native & Expo
- React Navigation (Stack)
- Firebase Authentication
- Expo Fonts
- Custom Poppins fonts

## Notes

- Make sure to replace Firebase config values before testing
- The app includes proper error handling for authentication failures
- All text includes overflow protection for different screen sizes
- Loading states are implemented for better user experience
