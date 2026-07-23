import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { socketService } from '../services/socketService';

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

export interface FYInfo {
  label: string;     // e.g. 'FY 2025-26'
  startDate: string; // e.g. '2025-04-01'
  endDate: string;   // e.g. '2026-03-31'
  finYear?: string;  // e.g. '2025-2026' (backend format, used as fy= param)
}

// Convert FYInfo label to backend finYear format: 'FY 2025-26' -> '2025-2026'
export function fyInfoToParam(fy: FYInfo | null): string | undefined {
  if (!fy) return undefined;
  if (fy.finYear) return fy.finYear;
  // Parse from label: 'FY 2025-26' or from startDate
  if (fy.startDate) {
    const y = parseInt(fy.startDate.slice(0, 4), 10);
    return `${y}-${y + 1}`;
  }
  return undefined;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isPaired: boolean;
  isDesktopOnline: boolean;
  company: Company | null;
  user: UserInfo | null;
  lastSyncAt: number;
  selectedFY: FYInfo | null;
  setSelectedFY: (fy: FYInfo | null) => void;
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
  lastSyncAt: 0,
  selectedFY: null,
  setSelectedFY: () => {},
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
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const [selectedFY, setSelectedFY] = useState<FYInfo | null>(null);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [user, setUserState] = useState<UserInfo | null>(null);

  const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.240:3001';

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
    // Connect socket immediately after login
    socketService.connect(BASE_URL, token);
    socketService.setOnSynced(() => {
      setLastSyncAt(Date.now()); // instant bump → all screens refetch
    });
  };

  const signOut = async () => {
    socketService.disconnect();
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

  // ── Connect socket when already authenticated (app restart / token restore) ─
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      socketService.connect(BASE_URL, token);
      socketService.setOnSynced(() => {
        setLastSyncAt(Date.now()); // instant bump → all screens refetch
      });
    })();
    return () => socketService.disconnect();
  }, [isAuthenticated, BASE_URL]);

  // ── Poll pairing + desktop status every 10s ───────────────────────────────
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
        const { is_paired, desktop_online, company: statusCompany } = json.data ?? {};
        if (typeof is_paired === 'boolean') {
          setIsPairedState(prev => {
            const wasUnpaired = !prev && is_paired;
            AsyncStorage.setItem('is_paired', is_paired ? 'true' : 'false').catch(() => {});
            // Pairing transition with no cached company → adopt status company
            if (wasUnpaired && is_paired && statusCompany?.guid) {
              setCompanyState(cur => {
                if (cur?.guid) return cur;
                const c = { guid: statusCompany.guid, name: statusCompany.name, gstin: statusCompany.gstin || null };
                AsyncStorage.setItem('company_data', JSON.stringify(c)).catch(() => {});
                return c;
              });
            }
            return is_paired;
          });
        }
        if (typeof desktop_online === 'boolean') {
          setIsDesktopOnlineState(desktop_online);
        }

        // After desktop syncs a different/new company, active set changes (old cos
        // marked is_active=false). Drop inactive cached company and adopt active one.
        if (is_paired && statusCompany?.guid) {
          try {
            const cosRes = await fetch(`${BASE_URL}/api/companies`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (cosRes.ok) {
              const cosJson = await cosRes.json();
              const list: { id: string; name: string; gstin?: string | null }[] = cosJson?.data || [];
              setCompanyState(cur => {
                const stillActive = !!(cur?.guid && list.some(c => c.id === cur.guid));
                if (stillActive) return cur;
                const pick = list.find(c => c.id === statusCompany.guid) || list[0];
                if (!pick) return cur;
                const c = { guid: pick.id, name: pick.name, gstin: pick.gstin || null };
                AsyncStorage.setItem('company_data', JSON.stringify(c)).catch(() => {});
                return c;
              });
            }
          } catch { /* keep cached */ }
        }

        // Track last_seen changes — when desktop syncs, last_seen advances
        const deviceLastSeen = json.data?.device?.last_seen;
        if (deviceLastSeen && typeof deviceLastSeen === 'number') {
          setLastSyncAt(prev => (deviceLastSeen * 1000) > prev ? (deviceLastSeen * 1000) : prev);
        }
      } catch {
        // Network error — don't change state, keep showing cached
      }
    };

    poll(); // immediate check on mount / auth change
    const interval = setInterval(poll, 10_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, BASE_URL]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, isPaired, isDesktopOnline, company, user, lastSyncAt,
      selectedFY, setSelectedFY,
      signIn, signOut, setIsPaired, setCompany, setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
