import React, { createContext, useContext, useState } from 'react';

const NotificationNavigationContext = createContext();

export const useNotificationNavigation = () => {
  const context = useContext(NotificationNavigationContext);
  if (!context) {
    throw new Error('useNotificationNavigation must be used within a NotificationNavigationProvider');
  }
  return context;
};

export const NotificationNavigationProvider = ({ children }) => {
  const [navigationData, setNavigationData] = useState(null);
  const [shouldNavigate, setShouldNavigate] = useState(false);

  const handleNotificationClick = (data) => {
    setNavigationData(data);
    setShouldNavigate(true);
  };

  const clearNavigation = () => {
    setNavigationData(null);
    setShouldNavigate(false);
  };

  const value = {
    navigationData,
    shouldNavigate,
    handleNotificationClick,
    clearNavigation
  };

  return (
    <NotificationNavigationContext.Provider value={value}>
      {children}
    </NotificationNavigationContext.Provider>
  );
};