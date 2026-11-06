import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';
import { socketService, type SessionEndReason } from '../services/socketService';
import { clearVoucherConfigCache } from '../utils/voucherPdf';
import { clearStockListCache } from '../utils/stockCache';
import { sweepTenantAsyncStorage } from '../utils/logoutCleanup';
import { tenantKey, companySelectionFeature, fyFeature, setTenantKeyContext } from '../utils/tenantStorage';
import { setWorkspaceGeneration } from '../utils/workspaceGeneration';
import { companyInList, companyGuid, toAuthCompany, sameCompany } from '../utils/companyIdentity';
import { isDemoCompany as companyIsDemo, isLiveBooksStatus } from '../utils/isDemoCompany';
import { fyEquals, normalizeFy } from '../utils/fyIdentity';
import {
  setAuthFailureHandler,
  getActiveWorkspaceId,
  getCompanies,
  getCompanyYears,
  setRefreshToken,
  clearRefreshToken,
  tryRefreshSession,
  logoutOnServer,
  setWriteAsDemo,
} from '../services/api';
import { getStoredPushToken } from '../services/pushNotifications';
import { wsCompanyKey, wsFyKey } from '../utils/workspaceStorage';
import { BACKEND_URL } from '../config/backend';
import { clearPreAuthToken } from '../utils/preAuthToken';
import { readAccessToken, writeAccessToken, deleteAccessToken } from '../utils/accessToken';
import { DEMO_MODE } from '../demo/config';
import { showDemoNotice } from '../demo/demoData';

// ── Storage helpers ──────────────────────────────────────────
// The access token lives in the keychain on native (see utils/accessToken.ts);
// api.ts reads the same place, so every request and this context agree.
const storeToken = async (token: string) => {
  await writeAccessToken(token);
};

const removeToken = async () => {
  await sweepTenantAsyncStorage();
  await deleteAccessToken();
  await clearPreAuthToken();
  await clearRefreshToken();
};

const getToken = async (): Promise<string | null> => {
  return readAccessToken();
};

// ── Types ────────────────────────────────────────────────────
export interface Company {
  guid: string;
  name: string;
  gstin?: string | null;
  is_demo?: boolean;
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

export type { SessionEndReason };

export interface SignOutOptions {
  /** false when the server has already ended the session: only this device is cleared. */
  server?: boolean;
  /** Tells the user why they were signed out. */
  notice?: SessionEndReason | null;
}

const SIGN_OUT_NOTICE: Record<SessionEndReason, string> = {
  signed_out: 'auth.signedOutNotice',
  signed_out_everywhere: 'auth.signedOutEverywhereNotice',
  credentials_changed: 'auth.credentialsChangedNotice',
};

/** How long after expectSignOut() the server ending this session counts as expected. */
const EXPECTED_SIGN_OUT_MS = 60_000;

/**
 * Auth is user identity only. Pairing is a property of a workspace, not of a
 * user: the same person can own an unpaired workspace and be a member of a
 * paired one, so read `pairingStatus` / `tallyConnected` from WorkspaceContext.
 */
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isDesktopOnline: boolean;
  company: Company | null;
  user: UserInfo | null;
  lastSyncAt: number;
  selectedFY: FYInfo | null;
  setSelectedFY: (fy: FYInfo | null) => void;
  signIn: (token: string, userInfo?: UserInfo, refreshToken?: string | null) => Promise<void>;
  /** Ends the session on the server (unless `server: false`), then clears this device. Safe to call twice. */
  signOut: (opts?: SignOutOptions) => Promise<void>;
  /** The server is about to end this session on purpose (account deletion): its `logout` then signs out without a notice. */
  expectSignOut: () => void;
  setCompany: (c: Company | null | ((prev: Company | null) => Company | null)) => Promise<void>;
  setUser: (u: UserInfo) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  isDesktopOnline: false,
  company: null,
  user: null,
  lastSyncAt: 0,
  selectedFY: null,
  setSelectedFY: () => {},
  signIn: async () => {},
  signOut: async () => {},
  expectSignOut: () => {},
  setCompany: async () => {},
  setUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // The website demo shows a connected office PC from the first frame; the recorded status confirms it on the first poll.
  const [isDesktopOnline, setIsDesktopOnlineState] = useState(DEMO_MODE);
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const [selectedFY, setSelectedFY] = useState<FYInfo | null>(null);
  const [company, setCompanyState] = useState<Company | null>(null);
  const companyRef = useRef<Company | null>(null);
  const selectedFYRef = useRef<FYInfo | null>(null);
  const userRef = useRef<UserInfo | null>(null);
  const lastWsStatusRef = useRef('');
  const lastRevisionProbeRef = useRef(0);
  /** Set where sign-in and sign-out flip it, so a second sign-out right after the first sees it at once. */
  const isAuthenticatedRef = useRef(false);
  /** Workspace the status poll last reported on — resets derived state on switch. */
  const polledWsRef = useRef<string | null>(null);
  const [user, setUserState] = useState<UserInfo | null>(null);

  // Keep ref in sync for functional setCompany without double-setState hacks
  useEffect(() => {
    companyRef.current = company;
    setWriteAsDemo(companyIsDemo(company));
  }, [company]);
  useEffect(() => {
    selectedFYRef.current = selectedFY;
  }, [selectedFY]);
  useEffect(() => {
    userRef.current = user;
    setTenantKeyContext(user?.id ?? null, getActiveWorkspaceId());
  }, [user]);

  const BASE_URL = BACKEND_URL;

  // Restore persisted state on mount
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 3000);

    (async () => {
      try {
        const [tok, [userJson, wsIdPair]] = await Promise.all([
          getToken(),
          AsyncStorage.multiGet(['user_info', 'active_workspace_id']),
        ]);
        if (tok) {
          isAuthenticatedRef.current = true;
          setIsAuthenticated(true);
          const wsId = wsIdPair[1] || null;
          const userParsed = userJson[1] ? JSON.parse(userJson[1]) : null;
          const scopedCompanyKey = tenantKey({
            userId: userParsed?.id,
            workspaceId: wsId,
            feature: companySelectionFeature(),
          });
          const companyJson =
            (await AsyncStorage.getItem(scopedCompanyKey)) ||
            (wsId ? await AsyncStorage.getItem(wsCompanyKey(wsId)) : null);
          await AsyncStorage.removeItem('company_data').catch(() => {});
          if (companyJson) {
            const parsed = JSON.parse(companyJson);
            companyRef.current = parsed;
            setCompanyState(parsed);
            const fyKey = tenantKey({
              userId: userParsed?.id,
              workspaceId: wsId,
              companyGuid: parsed?.guid,
              feature: fyFeature(),
            });
            const fyJson = (await AsyncStorage.getItem(fyKey)) || (wsId ? await AsyncStorage.getItem(wsFyKey(wsId)) : null);
            if (fyJson) {
              try { setSelectedFY(JSON.parse(fyJson)); } catch { /* ignore */ }
            }
          }
          if (userJson[1]) setUserState(JSON.parse(userJson[1]));
        }
      } catch {}
      setIsLoading(false);
      clearTimeout(timeout);
    })();

    return () => clearTimeout(timeout);
  }, []);

  const signIn = useCallback(async (token: string, userInfo?: UserInfo, refreshToken?: string | null) => {
    await storeToken(token);
    // Absent on re-entry paths that only re-assert an existing session — never
    // overwrite a good refresh token with nothing.
    if (refreshToken) await setRefreshToken(refreshToken);
    isAuthenticatedRef.current = true;
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

  const signingOutRef = useRef(false);
  const expectedSignOutUntilRef = useRef(0);

  const signOut = useCallback(async ({ server = true, notice = null }: SignOutOptions = {}) => {
    // The website demo stays signed in: signing out would leave a sign-in screen that cannot be used.
    if (DEMO_MODE) { showDemoNotice(); return; }
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    try {
      // Already signed out (a late `logout` event, a second tap): nothing to end and nothing to say.
      if (!isAuthenticatedRef.current && !(await getToken())) return;
      // Before the server call: the `logout` the server sends this socket for this very sign-out must not
      // start a second one.
      socketService.disconnect();
      if (server) {
        const serverLogout = await logoutOnServer(await getStoredPushToken());
        if (!serverLogout.ok && __DEV__) {
          console.warn('[auth] server logout not revoked', serverLogout.reason || 'unknown');
        }
      }
      setWriteAsDemo(false);
      setTenantKeyContext(null, null);
      setWorkspaceGeneration(null);
      await removeToken();
      clearVoucherConfigCache();
      clearStockListCache();
      isAuthenticatedRef.current = false;
      setIsAuthenticated(false);
      setIsDesktopOnlineState(false);
      polledWsRef.current = null;
      lastWsStatusRef.current = '';
      setCompanyState(null);
      companyRef.current = null;
      setSelectedFY(null);
      setUserState(null);
      if (notice) {
        Toast.show({ type: 'info', text1: i18n.t('auth.signedOutTitle'), text2: i18n.t(SIGN_OUT_NOTICE[notice]), visibilityTime: 5000 });
      }
    } finally {
      signingOutRef.current = false;
    }
  }, []);

  // Central 401 → invalidate session once (api layer). 403 never reaches here as auth.
  useEffect(() => {
    setAuthFailureHandler(() => {
      signOut().catch(() => {});
    });
    return () => setAuthFailureHandler(null);
  }, [signOut]);

  const expectSignOut = useCallback(() => {
    expectedSignOutUntilRef.current = Date.now() + EXPECTED_SIGN_OUT_MS;
  }, []);

  // The server ended this session (signed out elsewhere, Log out of all devices, a PIN or phone change):
  // clear this device without calling the server again.
  useEffect(() => {
    socketService.setOnSessionEnded((reason) => {
      const expected = Date.now() < expectedSignOutUntilRef.current;
      signOut({ server: false, notice: expected ? null : reason }).catch(() => {});
    });
    return () => socketService.setOnSessionEnded(null);
  }, [signOut]);

  // Stable identity — WorkspaceContext refreshContext depends on this; a new
  // function every render re-fired refresh → setAccess → filterScoped → Header loops.
  const persistCompany = useCallback(async (next: Company | null) => {
    const wsId = getActiveWorkspaceId();
    const userId = user?.id ?? userRef.current?.id;
    if (!wsId) return;
    const key = tenantKey({ userId, workspaceId: wsId, feature: companySelectionFeature() });
    if (next) {
      await AsyncStorage.setItem(key, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(key);
    }
    await AsyncStorage.removeItem(wsCompanyKey(wsId)).catch(() => {});
    await AsyncStorage.removeItem('company_data').catch(() => {});
  }, [user?.id]);

  const setCompany = useCallback(async (c: Company | null | ((prev: Company | null) => Company | null)) => {
    const next = typeof c === 'function' ? c(companyRef.current) : c;
    if (!next && !companyRef.current) return;
    if (next && companyRef.current && sameCompany(next, companyRef.current)
      && !!next.is_demo === !!companyRef.current.is_demo
      && next.name === companyRef.current.name) {
      return;
    }
    if (next && next === companyRef.current) return;
    companyRef.current = next;
    setCompanyState(next);
    setWriteAsDemo(companyIsDemo(next));
    await persistCompany(next);
  }, [persistCompany]);

  const setSelectedFYPersisted = useCallback(async (fy: FYInfo | null) => {
    const normalized = fy ? normalizeFy(fy) : null;
    if (fyEquals(normalized, selectedFYRef.current)) return;
    selectedFYRef.current = normalized;
    setSelectedFY(normalized);
    const wsId = getActiveWorkspaceId();
    const userId = userRef.current?.id;
    const guid = companyGuid(companyRef.current);
    if (!wsId) return;
    const key = tenantKey({ userId, workspaceId: wsId, companyGuid: guid, feature: fyFeature() });
    if (normalized) await AsyncStorage.setItem(key, JSON.stringify(normalized));
    else await AsyncStorage.removeItem(key);
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

  // The response's X-Data-Revision goes through dataRevision: a newer one refreshes the screens
  // exactly like a `synced` event, an equal one does nothing.
  const probeRevision = useCallback((foreground = false) => {
    const cur = companyRef.current;
    const guid = companyGuid(cur);
    if (!guid || companyIsDemo(cur) || !getActiveWorkspaceId()) return;
    const now = Date.now();
    if (now - lastRevisionProbeRef.current < (foreground ? 5_000 : 30_000)) return;
    lastRevisionProbeRef.current = now;
    getCompanyYears(guid).catch(() => {});
  }, []);

  // ── Poll desktop presence + live company every 10s ────────────────────────
  // Pairing truth itself is per-workspace and belongs to WorkspaceContext; this
  // poll only keeps isDesktopOnline and the adopted company fresh, and every
  // write is gated on the workspace still being the active one.
  // Uses /api/tally-sync/status (lightweight, no websocket needed).
  useEffect(() => {
    if (!isAuthenticated) return;

    const poll = async () => {
      try {
        // Wait until WorkspaceContext has set X-Workspace-Id — otherwise we hit
        // the legacy path (no workspace_status) and never purge Demo correctly.
        const wsId = getActiveWorkspaceId();
        if (!wsId) return;
        // A switch invalidates everything the previous workspace told us; not
        // clearing here left the desktop badge of workspace ABC on top of XYZ.
        if (polledWsRef.current !== wsId) {
          polledWsRef.current = wsId;
          lastWsStatusRef.current = '';
          setIsDesktopOnlineState(false);
        }
        const token = await getToken();
        if (!token) return;
        if (getActiveWorkspaceId() !== wsId) return;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'X-Workspace-Id': wsId,
        };
        const res = await fetch(`${BASE_URL}/api/tally-sync/status`, {
          headers,
          cache: 'no-store',
        });
        if (res.status === 401) {
          // Access tokens last 15 minutes — renew before giving up the session.
          const outcome = await tryRefreshSession();
          // 'refreshed' → the next tick polls with the new token.
          // 'unavailable' → transient; keep the session and retry next tick.
          if (outcome === 'rejected') await signOut();
          return;
        }
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.success) return;
        // This response describes wsId. If the user switched while it was in
        // flight, applying it would write ABC's state onto XYZ.
        if (getActiveWorkspaceId() !== wsId) return;
        const { desktop_online, company: statusCompany, workspace_status } = json.data ?? {};
        const wsStatus = String(workspace_status || '').toUpperCase();
        // CONNECTED is the only state where Demo must be purged. RECONNECTING is still Demo Mode.
        const liveConnected = wsStatus === 'CONNECTED';
        const prevStatus = lastWsStatusRef.current;
        if (wsStatus) lastWsStatusRef.current = wsStatus;

        if (typeof desktop_online === 'boolean') {
          setIsDesktopOnlineState(desktop_online);
        }

        // Flip off Demo as soon as backend reports CONNECTED for this workspace.
        if (liveConnected && prevStatus !== 'CONNECTED') {
          setLastSyncAt(Date.now());
        }

        const liveBooks = isLiveBooksStatus(wsStatus);
        if (liveBooks && statusCompany && !companyIsDemo(statusCompany)) {
          const adopted = toAuthCompany(statusCompany);
          const cur = companyRef.current;
          if (adopted && !companyGuid(cur)) {
            await setCompany(adopted);
          }
        }

        if (liveBooks) {
          try {
            const cosRes: any = await getCompanies();
            if (getActiveWorkspaceId() !== wsId) return;
            const list = ((cosRes?.data || []) as any[]).filter((c) => !companyIsDemo(c));
            const cur = companyRef.current;
            if (cur && !companyIsDemo(cur) && companyInList(cur, list)) {
              // selection already valid — poll must not rewrite
            } else if (companyIsDemo(cur) || !cur) {
              if (!list.length) await setCompany(null);
              else {
                const live = statusCompany && !companyIsDemo(statusCompany) ? toAuthCompany(statusCompany) : null;
                const pickRow = (live && list.find((c) => sameCompany(c, live))) || list[0];
                const pick = toAuthCompany(pickRow);
                if (pick) await setCompany(pick);
              }
            } else if (list.length) {
              const live = statusCompany && !companyIsDemo(statusCompany) ? toAuthCompany(statusCompany) : null;
              const pickRow = (live && list.find((c) => sameCompany(c, live))) || list[0];
              const pick = toAuthCompany(pickRow);
              if (pick && !sameCompany(cur, pick)) await setCompany(pick);
            }
          } catch { /* keep cached */ }
        }

        // A missed `synced` (socket down): the selected company's published revision decides.
        // Desktop heartbeats move last_seen without new data, so it never refreshes screens.
        probeRevision();
      } catch {
        // Network error — don't change state, keep showing cached
      }
    };

    poll(); // immediate check on mount / auth change
    const interval = setInterval(poll, 10_000);
    // Back from background: catch a sync that happened while the app was suspended.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') probeRevision(true);
    });
    return () => {
      clearInterval(interval);
      appState.remove();
    };
  }, [isAuthenticated, BASE_URL, signOut, setCompany, probeRevision]);

  const value = useMemo<AuthContextType>(() => ({
    isAuthenticated, isLoading, isDesktopOnline, company, user, lastSyncAt,
    selectedFY, setSelectedFY: setSelectedFYPersisted,
    signIn, signOut, expectSignOut, setCompany, setUser,
  }), [
    isAuthenticated, isLoading, isDesktopOnline, company, user, lastSyncAt,
    selectedFY, setSelectedFYPersisted, signIn, signOut, expectSignOut, setCompany, setUser,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
