const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Add support for CommonJS modules
defaultConfig.resolver.sourceExts.push('cjs');

// Disable package exports to avoid module resolution issues
defaultConfig.resolver.unstable_enablePackageExports = false;

// Ensure proper module resolution for Expo modules
defaultConfig.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add Firebase-specific resolver configuration
defaultConfig.resolver.alias = {
  ...defaultConfig.resolver.alias,
  '@firebase/app': require.resolve('firebase/app'),
  '@firebase/auth': require.resolve('firebase/auth'),
  '@firebase/firestore': require.resolve('firebase/firestore'),
};

module.exports = defaultConfig;
