import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { socketService } from '../services/socketService';
import { clearVoucherConfigCache } from '../utils/voucherPdf';
import { setAuthFailureHandler, getActiveWorkspaceId, getCompanies } from '../services/api';
import { wsCompanyKey, wsFyKey } from '../utils/workspaceStorage';
import { BACKEND_URL } from '../config/backend';

// ── Storage helpers ──────────────────────────────────────────
const storeToken = async (token: string) => {
  if (Platform.OS === 'web') { try { window.localStorage.setItem('auth_token', token); } catch {} }
  await AsyncStorage.setItem('auth_token', token);
};

const removeToken = async () => {
  if (Platform.OS === 'web') {
    try { window.localStorage.removeItem('auth_token'); window.localStorage.removeItem('user_data'); } catch {}
  }
  await AsyncStorage.multiRemove(['auth_token', 'user_data', 'company_data', 'is_paired', 'user_info', 'active_workspace_id', 'active_workspace_manual_pin']);
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
  setCompany: (c: Company | null | ((prev: Company | null) => Company | null)) => Promise<void>;
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
  const companyRef = useRef<Company | null>(null);
  const lastWsStatusRef = useRef('');
  const [user, setUserState] = useState<UserInfo | null>(null);

  // Keep ref in sync for functional setCompany without double-setState hacks
  useEffect(() => {
    companyRef.current = company;
  }, [company]);

  const BASE_URL = BACKEND_URL;

  // Restore persisted state on mount
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 3000);

    (async () => {
      try {
        const [token, pairedStr, userJson, wsIdPair] = await AsyncStorage.multiGet([
          'auth_token', 'is_paired', 'user_info', 'active_workspace_id',
        ]);
        const tok = token[1];
        if (tok) {
          setIsAuthenticated(true);
          const wsId = wsIdPair[1] || null;
          const companyJson = await AsyncStorage.getItem(wsCompanyKey(wsId));
          const legacyCompany = companyJson ? null : await AsyncStorage.getItem('company_data');
          const rawCompany = companyJson || legacyCompany;
          if (rawCompany) {
            const parsed = JSON.parse(rawCompany);
            companyRef.current = parsed;
            setCompanyState(parsed);
          }
          const fyJson = await AsyncStorage.getItem(wsFyKey(wsId));
          if (fyJson) {
            try { setSelectedFY(JSON.parse(fyJson)); } catch { /* ignore */ }
          }
          if (pairedStr[1] === 'true') setIsPairedState(true);
          if (userJson[1]) setUserState(JSON.parse(userJson[1]));
        }
      } catch {}
      setIsLoading(false);
      clearTimeout(timeout);
    })();

    return () => clearTimeout(timeout);
  }, []);

  const signIn = useCallback(async (token: string, userInfo?: UserInfo) => {
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
  }, [BASE_URL]);

  const signOut = useCallback(async () => {
    socketService.disconnect();
    await removeToken();
    // The PDF format choice is user-level and cached in memory, so it has to go
    // or the next account inherits this one's layouts.
    clearVoucherConfigCache();
    setIsAuthenticated(false);
    setIsPairedState(false);
    setCompanyState(null);
    setUserState(null);
  }, []);

  // Central 401 → invalidate session once (api layer). 403 never reaches here as auth.
  useEffect(() => {
    setAuthFailureHandler(() => {
      signOut().catch(() => {});
    });
    return () => setAuthFailureHandler(null);
  }, [signOut]);

  const setIsPaired = useCallback((v: boolean) => {
    setIsPairedState(v);
    AsyncStorage.setItem('is_paired', v ? 'true' : 'false').catch(() => {});
  }, []);

  // Stable identity — WorkspaceContext refreshContext depends on this; a new
  // function every render re-fired refresh → setAccess → filterScoped → Header loops.
  const setCompany = useCallback(async (c: Company | null | ((prev: Company | null) => Company | null)) => {
    const next = typeof c === 'function' ? c(companyRef.current) : c;
    // No-op when identity unchanged (stops Demo↔null flicker loops)
    if (!next && !companyRef.current) return;
    if (next?.guid && next.guid === companyRef.current?.guid) return;
    // Also no-op when functional updater returns the same object reference
    if (next && next === companyRef.current) return;
    companyRef.current = next;
    setCompanyState(next);
    const wsId = getActiveWorkspaceId();
    const key = wsCompanyKey(wsId);
    if (next) {
      await AsyncStorage.setItem(key, JSON.stringify(next));
      await AsyncStorage.setItem('company_data', JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(key);
      await AsyncStorage.removeItem('company_data');
    }
  }, []);

  const isDemoCompany = (c: { guid?: string; name?: string; id?: string } | null | undefined) => {
    if (!c) return false;
    const name = String(c.name || '').toLowerCase();
    const guid = String(c.guid || c.id || '');
    return name.startsWith('demo') || guid.startsWith('dddddddd-dddd-4ddd-8ddd-') || guid.startsWith('DEMO');
  };

  const setSelectedFYPersisted = useCallback(async (fy: FYInfo | null) => {
    setSelectedFY(fy);
    const wsId = getActiveWorkspaceId();
    const key = wsFyKey(wsId);
    if (fy) {
      await AsyncStorage.setItem(key, JSON.stringify(fy));
    } else {
      await AsyncStorage.removeItem(key);
    }
  }, []);

  const setUser = useCallback((u: UserInfo) => {
    setUserState(u);
    AsyncStorage.setItem('user_info', JSON.stringify(u)).catch(() => {});
  }, []);

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
        // Wait until WorkspaceContext has set X-Workspace-Id — otherwise we hit
        // the legacy path (no workspace_status) and never purge Demo correctly.
        const wsId = getActiveWorkspaceId();
        if (!wsId) return;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'X-Workspace-Id': wsId,
        };
        const res = await fetch(`${BASE_URL}/api/tally-sync/status`, {
          headers,
          cache: 'no-store',
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
        const { is_paired, desktop_online, company: statusCompany, workspace_status } = json.data ?? {};
        const wsStatus = String(workspace_status || '').toUpperCase();
        // CONNECTED is the only state where Demo must be purged. RECONNECTING is still Demo Mode.
        const liveConnected = wsStatus === 'CONNECTED';
        const prevStatus = lastWsStatusRef.current;
        if (wsStatus) lastWsStatusRef.current = wsStatus;

        if (typeof is_paired === 'boolean') {
          AsyncStorage.setItem('is_paired', is_paired ? 'true' : 'false').catch(() => {});
          setIsPairedState(is_paired);
        }
        if (typeof desktop_online === 'boolean') {
          setIsDesktopOnlineState(desktop_online);
        }

        // Flip off Demo as soon as backend reports CONNECTED (don't wait for is_paired change).
        if (liveConnected && prevStatus !== 'CONNECTED') {
          setLastSyncAt(Date.now());
        }

        if (liveConnected && statusCompany?.guid && !isDemoCompany(statusCompany)) {
          setCompanyState(cur => {
            if (cur?.guid && !isDemoCompany(cur)) return cur;
            const c = { guid: statusCompany.guid, name: statusCompany.name, gstin: statusCompany.gstin || null };
            companyRef.current = c;
            AsyncStorage.setItem('company_data', JSON.stringify(c)).catch(() => {});
            AsyncStorage.setItem(wsCompanyKey(wsId), JSON.stringify(c)).catch(() => {});
            return c;
          });
        }

        // After desktop syncs a different/new company, active set changes (old cos
        // marked is_active=false). Drop inactive cached company and adopt active one.
        // Only while CONNECTED — Demo Mode must keep Demo Company.
        if (liveConnected) {
          try {
            const cosRes: any = await getCompanies();
            const list: { id: string; name: string; gstin?: string | null }[] = (cosRes?.data || [])
              .filter((c: any) => !isDemoCompany(c));
            setCompanyState(cur => {
              if (isDemoCompany(cur)) {
                // Demo while CONNECTED is illegal — clear even if list empty
                if (!list.length) {
                  companyRef.current = null;
                  AsyncStorage.removeItem('company_data').catch(() => {});
                  return null;
                }
              }
              const stillActive = !!(cur?.guid && list.some(c => c.id === cur.guid));
              if (stillActive) return cur;
              if (!list.length) {
                // Paired empty (only Demo filtered out) → stable null
                if (!cur || isDemoCompany(cur)) {
                  companyRef.current = null;
                  AsyncStorage.removeItem('company_data').catch(() => {});
                  return null;
                }
                return cur;
              }
              const liveGuid = statusCompany?.guid && !isDemoCompany(statusCompany) ? statusCompany.guid : null;
              const pick = (liveGuid && list.find(c => c.id === liveGuid)) || list[0];
              if (!pick) return cur;
              const c = { guid: pick.id, name: pick.name, gstin: pick.gstin || null };
              companyRef.current = c;
              AsyncStorage.setItem('company_data', JSON.stringify(c)).catch(() => {});
              AsyncStorage.setItem(wsCompanyKey(wsId), JSON.stringify(c)).catch(() => {});
              return c;
            });
          } catch { /* keep cached */ }
        }

        // Track last_seen changes — when desktop syncs, last_seen advances.
        // pg bigint / JSON may arrive as string — coerce with Number().
        const deviceLastSeen = Number(json.data?.device?.last_seen);
        if (Number.isFinite(deviceLastSeen) && deviceLastSeen > 0) {
          const ms = deviceLastSeen * 1000;
          setLastSyncAt(prev => (ms > prev ? ms : prev));
        }
      } catch {
        // Network error — don't change state, keep showing cached
      }
    };

    poll(); // immediate check on mount / auth change
    const interval = setInterval(poll, 10_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, BASE_URL]);

  const value = useMemo<AuthContextType>(() => ({
    isAuthenticated, isLoading, isPaired, isDesktopOnline, company, user, lastSyncAt,
    selectedFY, setSelectedFY: setSelectedFYPersisted,
    signIn, signOut, setIsPaired, setCompany, setUser,
  }), [
    isAuthenticated, isLoading, isPaired, isDesktopOnline, company, user, lastSyncAt,
    selectedFY, setSelectedFYPersisted, signIn, signOut, setIsPaired, setCompany, setUser,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
