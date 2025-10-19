// firebase.config.example.js
// Copy this file to firebase.config.js and fill in your Firebase credentials

export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY_HERE',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Instructions:
// 1. Go to Firebase Console: https://console.firebase.google.com/
// 2. Create a new project or select existing one
// 3. Go to Project Settings (gear icon)
// 4. Scroll down to "Your apps" section
// 5. Click "Add app" and select Web app
// 6. Copy the config values and paste them above
// 7. Enable Authentication (Email/Password) in the Authentication section
// 8. Enable Firestore Database in the Firestore Database section
// 9. Set up Firestore security rules as shown in README.md
