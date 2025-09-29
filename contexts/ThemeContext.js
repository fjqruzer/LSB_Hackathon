import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference from AsyncStorage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme !== null) {
          setIsDarkMode(JSON.parse(savedTheme));
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Save theme preference to AsyncStorage
  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('theme', JSON.stringify(newTheme));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  // Theme colors
  const colors = {
    light: {
      // Background colors
      primary: '#DFECE2',
      secondary: '#FFFFFF',
      surface: '#F8F9FA',
      
      // Text colors
      text: '#333333',
      textSecondary: '#666666',
      textTertiary: '#999999',
      
      // Accent colors
      accent: '#83AFA7',
      accentLight: '#A8C8C0',
      accentDark: '#6B8B7A',
      
      // Status colors
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#FF5252',
      info: '#2196F3',
      
      // Border colors
      border: '#E0E0E0',
      borderLight: '#F0F0F0',
      
      // Shadow colors
      shadow: '#000000',
      
      // Input colors
      inputBackground: '#FFFFFF',
      inputBorder: '#E0E0E0',
      inputText: '#333333',
      placeholder: '#999999',
    },
    dark: {
      // Background colors
      primary: '#1A1A1A',
      secondary: '#2D2D2D',
      surface: '#3A3A3A',
      
      // Text colors
      text: '#FFFFFF',
      textSecondary: '#CCCCCC',
      textTertiary: '#999999',
      
      // Accent colors
      accent: '#83AFA7',
      accentLight: '#A8C8C0',
      accentDark: '#6B8B7A',
      
      // Status colors
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#FF5252',
      info: '#2196F3',
      
      // Border colors
      border: '#404040',
      borderLight: '#333333',
      
      // Shadow colors
      shadow: '#000000',
      
      // Input colors
      inputBackground: '#2D2D2D',
      inputBorder: '#404040',
      inputText: '#FFFFFF',
      placeholder: '#999999',
    }
  };

  const theme = {
    isDarkMode,
    colors: colors[isDarkMode ? 'dark' : 'light'],
    toggleTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
