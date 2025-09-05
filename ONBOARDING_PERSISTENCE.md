# Onboarding Persistence Guide

## 🎯 **What This Does**

The app now remembers whether a user has completed onboarding and will:
- **First time users**: Show the onboarding screen
- **Returning users**: Skip onboarding and go directly to the main app

## 🔧 **How It Works**

### **1. App Launch Logic (`App.js`)**
```javascript
// Checks if user has completed onboarding
const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
setIsFirstLaunch(hasCompletedOnboarding === null);

// Sets initial route based on onboarding status
initialRouteName={isFirstLaunch ? "Onboarding" : "MainApp"}
```

### **2. Onboarding Completion (`OnboardingScreen.js`)**
```javascript
// When user taps "Get Started"
const handleGetStarted = async () => {
  await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
  navigation.navigate('Signup');
};
```

### **3. Alternative Path (`LoginScreen.js`)**
```javascript
// When user taps "Sign Up" from login
const handleSignUp = async () => {
  await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
  navigation.navigate('Signup');
};
```

## 📱 **User Experience**

### **First Time Users:**
1. App launches → Shows onboarding screen
2. User swipes through screens
3. User taps "Get Started"
4. Onboarding marked as completed
5. Navigates to Signup screen

### **Returning Users:**
1. App launches → Checks AsyncStorage
2. Finds `hasCompletedOnboarding: 'true'`
3. Skips onboarding screen
4. Goes directly to MainApp

## 🧪 **Testing**

### **Test First Time Experience:**
1. Uninstall and reinstall the app
2. Should see onboarding screen

### **Test Returning User:**
1. Complete onboarding once
2. Close and reopen app
3. Should skip onboarding

### **Reset Onboarding (for testing):**
```javascript
// In OnboardingScreen.js, you can call:
resetOnboarding(); // This will show onboarding on next launch
```

## 🔄 **Reset Onboarding**

If you need to reset onboarding for testing:

### **Method 1: Clear App Data**
- Android: Settings → Apps → COPit → Storage → Clear Data
- iOS: Delete and reinstall app

### **Method 2: Use Developer Tools**
- Add a reset button in development mode
- Call `AsyncStorage.removeItem('hasCompletedOnboarding')`

## 📊 **Storage Key**

The app uses this key in AsyncStorage:
```javascript
'hasCompletedOnboarding' // Value: 'true' or null
```

## ✅ **Benefits**

- **Better UX**: Users don't see onboarding every time
- **Faster Launch**: Direct to main app for returning users
- **Persistent**: Survives app restarts and device reboots
- **Reliable**: Uses AsyncStorage (local device storage)

## 🚀 **Ready to Use**

Your app now has smart onboarding persistence! Users will only see the welcome screens once, making the app feel more professional and user-friendly.
