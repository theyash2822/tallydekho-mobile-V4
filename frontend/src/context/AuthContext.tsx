import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Web-safe storage helpers
const storeToken = async (token: string) => {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem('auth_token', token); } catch {}
  }
  await AsyncStorage.setItem('auth_token', token);
};

const removeToken = async () => {
  if (Platform.OS === 'web') {
    try { window.localStorage.removeItem('auth_token'); window.localStorage.removeItem('user_data'); } catch {}
  }
  await AsyncStorage.removeItem('auth_token');
  await AsyncStorage.removeItem('user_data');
};

const getToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      const webToken = window.localStorage.getItem('auth_token');
      if (webToken) return webToken;
    } catch {}
  }
  return AsyncStorage.getItem('auth_token');
};

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Add timeout fallback so web doesn't get stuck if AsyncStorage hangs
    const timeout = setTimeout(() => setIsLoading(false), 3000);
    
    getToken()
      .then(token => {
        setIsAuthenticated(!!token);
        setIsLoading(false);
        clearTimeout(timeout);
      })
      .catch(() => {
        setIsLoading(false);
        clearTimeout(timeout);
      });
    
    return () => clearTimeout(timeout);
  }, []);

  const signIn = async (token: string) => {
    await storeToken(token);
    setIsAuthenticated(true);
  };

  const signOut = async () => {
    await removeToken();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
