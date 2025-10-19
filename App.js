import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/utils/AuthContext';
import NavigationApp from './src/navigation/NavigationApp';
import ErrorBoundary from './src/components/ErrorBoundary';


export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NavigationContainer>
          <NavigationApp />
        </NavigationContainer>
      </AuthProvider>
    </ErrorBoundary>
  );
}
