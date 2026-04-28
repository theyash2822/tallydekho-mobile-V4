import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── Storage helpers ──────────────────────────────────────────
const storeToken = async (token: string) => {
  if (Platform.OS === 'web') { try { window.localStorage.setItem('auth_token', token); } catch {} }
  await AsyncStorage.setItem('auth_token', token);
};

const removeToken = async () => {
  if (Platform.OS === 'web') {
    try { window.localStorage.removeItem('auth_token'); window.localStorage.removeItem('user_data'); } catch {}
  }
  await AsyncStorage.multiRemove(['auth_token', 'user_data', 'company_data', 'is_paired', 'user_info']);
};

const getToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try { const t = window.localStorage.getItem('auth_token'); if (t) return t; } catch {}
  }
  return AsyncStorage.getItem('auth_token');
};

// ── Types ────────────────────────────────────────────────────
export interface Company {
  guid: string;
  name: string;
  gstin?: string | null;
}

export interface UserInfo {
  id?: number;
  name?: string;
  phone?: string;
  email?: string;
  language?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isPaired: boolean;
  isDesktopOnline: boolean;
  company: Company | null;
  user: UserInfo | null;
  signIn: (token: string, userInfo?: UserInfo) => Promise<void>;
  signOut: () => Promise<void>;
  setIsPaired: (v: boolean) => void;
  setCompany: (c: Company) => Promise<void>;
  setUser: (u: UserInfo) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  isPaired: false,
  isDesktopOnline: false,
  company: null,
  user: null,
  signIn: async () => {},
  signOut: async () => {},
  setIsPaired: () => {},
  setCompany: async () => {},
  setUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaired, setIsPairedState] = useState(false);
  const [isDesktopOnline, setIsDesktopOnlineState] = useState(false);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [user, setUserState] = useState<UserInfo | null>(null);

  const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.241:3001';

  // Restore persisted state on mount
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 3000);

    (async () => {
      try {
        const [token, companyJson, pairedStr, userJson] = await AsyncStorage.multiGet([
          'auth_token', 'company_data', 'is_paired', 'user_info'
        ]);
        const tok = token[1];
        if (tok) {
          setIsAuthenticated(true);
          if (companyJson[1]) setCompanyState(JSON.parse(companyJson[1]));
          if (pairedStr[1] === 'true') setIsPairedState(true);
          if (userJson[1]) setUserState(JSON.parse(userJson[1]));
        }
      } catch {}
      setIsLoading(false);
      clearTimeout(timeout);
    })();

    return () => clearTimeout(timeout);
  }, []);

  const signIn = async (token: string, userInfo?: UserInfo) => {
    await storeToken(token);
    setIsAuthenticated(true);
    if (userInfo) {
      setUserState(userInfo);
      AsyncStorage.setItem('user_info', JSON.stringify(userInfo)).catch(() => {});
    }
  };

  const signOut = async () => {
    await removeToken();
    setIsAuthenticated(false);
    setIsPairedState(false);
    setCompanyState(null);
    setUserState(null);
  };

  const setIsPaired = (v: boolean) => {
    setIsPairedState(v);
    AsyncStorage.setItem('is_paired', v ? 'true' : 'false').catch(() => {});
  };

  const setCompany = async (c: Company) => {
    setCompanyState(c);
    await AsyncStorage.setItem('company_data', JSON.stringify(c)).catch(() => {});
  };

  const setUser = (u: UserInfo) => {
    setUserState(u);
    AsyncStorage.setItem('user_info', JSON.stringify(u)).catch(() => {});
  };

  // ── Poll pairing + desktop status every 30s ───────────────────────────────
  // Keeps isPaired + isDesktopOnline in sync with server truth.
  // Uses /api/tally-sync/status (lightweight, no websocket needed).
  useEffect(() => {
    if (!isAuthenticated) return;

    const poll = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${BASE_URL}/api/tally-sync/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          // Token expired — sign out cleanly
          await removeToken();
          setIsAuthenticated(false);
          setIsPairedState(false);
          setCompanyState(null);
          setUserState(null);
          return;
        }
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.success) return;
        const { is_paired, desktop_online } = json.data ?? {};
        if (typeof is_paired === 'boolean') {
          setIsPairedState(is_paired);
          AsyncStorage.setItem('is_paired', is_paired ? 'true' : 'false').catch(() => {});
        }
        if (typeof desktop_online === 'boolean') {
          setIsDesktopOnlineState(desktop_online);
        }
      } catch {
        // Network error — don't change state, keep showing cached
      }
    };

    poll(); // immediate check on mount / auth change
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, BASE_URL]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, isPaired, isDesktopOnline, company, user,
      signIn, signOut, setIsPaired, setCompany, setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
