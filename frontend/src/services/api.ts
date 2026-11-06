// ============================================================
// Auditer API Service — V2
// Base: /api/* (new spec)
// Auth: JWT Bearer token in Authorization header
// STRICT RULE: No mock/fallback data. Throw errors — callers handle empty/error states.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  ApiError,
  kindFromStatus,
  notifyAuthFailure,
  setDeviceOnline,
  markServerReachable,
  friendlyUserMessage,
  NOT_IN_ACCESS,
} from './apiErrors';
import { toastRbasError, ACCESS_CODES } from '../utils/rbasErrors';
import { BACKEND_URL } from '../config/backend';
import { beginSingleFlight } from '../utils/singleFlight';
import { reportError } from './monitoring';
import { DATA_REVISION_HEADER, companyGuidOf, noteRevision } from './dataRevision';
import { CLIENT_HEADERS } from './clientIdentity';

export {
  ApiError,
  errorMessage,
  isApiError,
  setAuthFailureHandler,
  subscribeDeviceOnline,
  subscribeServerReachability,
  getDeviceOnline,
  friendlyUserMessage,
  type ApiErrorKind,
} from './apiErrors';

const BASE_URL = BACKEND_URL;
const REQUEST_TIMEOUT_MS = 25_000;

/** Active Workspace for X-Workspace-Id — set by WorkspaceContext. */
let _activeWorkspaceId: string | null = null;

let _workspaceWaiters: Array<() => void> = [];

export function setActiveWorkspaceId(id: string | null) {
  _activeWorkspaceId = id ? String(id) : null;
  if (_activeWorkspaceId && _workspaceWaiters.length) {
    const waiting = _workspaceWaiters;
    _workspaceWaiters = [];
    waiting.forEach((resume) => resume());
  }
}

export function getActiveWorkspaceId(): string | null {
  return _activeWorkspaceId;
}

// ── Token helpers (must match AuthContext storage keys) ──────
const getToken = async (): Promise<string | null> => {
  try {
    // Web: AuthContext also writes window.localStorage — prefer that first
    if (Platform.OS === 'web') {
      try {
        const t = window.localStorage.getItem('auth_token');
        if (t) return t;
      } catch { /* fall through to AsyncStorage */ }
    }
    return await AsyncStorage.getItem('auth_token');
  } catch {
    return null;
  }
};

/** Current access token as stored (same source every request uses). */
export const getStoredAccessToken = getToken;

type TokenListener = (token: string) => void;
const _tokenListeners = new Set<TokenListener>();

/** Fires after a refresh stores a new access token (e.g. socket re-register). */
export function subscribeAccessTokenRefreshed(cb: TokenListener): () => void {
  _tokenListeners.add(cb);
  return () => { _tokenListeners.delete(cb); };
}

const storeAccessToken = async (token: string) => {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem('auth_token', token); } catch { /* private mode */ }
  }
  await AsyncStorage.setItem('auth_token', token);
  _tokenListeners.forEach((cb) => {
    try { cb(token); } catch { /* ignore */ }
  });
};

// ── Refresh token ────────────────────────────────────────────
/**
 * The access token lives 15 minutes; the refresh token that renews it is valid
 * for far longer, so it goes in the device keychain (SecureStore — same store as
 * the biometric PIN) and never in AsyncStorage, which is world-readable plain
 * text on a rooted/jailbroken device.
 */
const REFRESH_TOKEN_KEY = 'td_refresh_token';

export async function setRefreshToken(token: string | null | undefined): Promise<void> {
  try {
    if (!token) {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      return;
    }
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, String(token));
  } catch {
    // No keychain (web fallback / locked device): the session simply ends when
    // the access token expires instead of silently downgrading to AsyncStorage.
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearRefreshToken(): Promise<void> {
  await setRefreshToken(null);
}

/**
 * Keeps the tokens a sign-in step answered with. A missing refresh token leaves the stored one alone: only
 * an answer that carries one replaces it.
 */
export async function storeSessionTokens(tokens: { access_token?: string | null; refresh_token?: string | null }): Promise<void> {
  if (tokens.access_token) await storeAccessToken(String(tokens.access_token));
  if (tokens.refresh_token) await setRefreshToken(String(tokens.refresh_token));
}

/**
 * 'refreshed'   — a new access token is stored, replay the request
 * 'rejected'    — the session is gone (revoked / expired / never had a refresh
 *                 token); the caller must sign out
 * 'unavailable' — the refresh endpoint did not answer for itself (offline, a
 *                 captive portal, a proxy, a rate limit, a server error); the
 *                 session may still be valid, so surface the 401 but keep the
 *                 user signed in
 */
export type RefreshOutcome = 'refreshed' | 'rejected' | 'unavailable';

const _refreshSlot: { current: Promise<RefreshOutcome> | null } = { current: null };

async function performRefresh(): Promise<RefreshOutcome> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return 'rejected';
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CLIENT_HEADERS },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // Offline / DNS / connection refused — do not destroy a session over a blip.
    markServerReachable(false);
    return 'unavailable';
  }
  const data = await safeParseJson(res);
  const next = data?.data ?? data;
  if (res.ok && next?.access_token) {
    // Only the tokens are touched: the active workspace and the selected company
    // are deliberately left alone so a mid-session refresh cannot move the user.
    await storeAccessToken(String(next.access_token));
    if (next.refresh_token) await setRefreshToken(String(next.refresh_token));
    markServerReachable(true);
    return 'refreshed';
  }
  // Only the refresh endpoint refusing the token (400 / 401) ends the session, as on the web. A captive
  // portal or a proxy (200 HTML, 404, 429) or a server error is not an answer about the session.
  if (res.status === 400 || res.status === 401) {
    await clearRefreshToken();
    return 'rejected';
  }
  if (res.status >= 500) markServerReachable(false);
  return 'unavailable';
}

const REFRESH_RETRY_MIN_MS = 2_000;
const REFRESH_RETRY_MAX_MS = 30_000;
let _refreshRetryTimer: ReturnType<typeof setTimeout> | null = null;
let _refreshRetryDelay = REFRESH_RETRY_MIN_MS;

/**
 * Server blip during refresh: keep the session and keep retrying quietly with
 * backoff. Only a definite rejection from /auth/refresh signs the user out.
 */
function scheduleRefreshRetry() {
  if (_refreshRetryTimer) return;
  const delay = _refreshRetryDelay;
  _refreshRetryDelay = Math.min(_refreshRetryDelay * 2, REFRESH_RETRY_MAX_MS);
  _refreshRetryTimer = setTimeout(async () => {
    _refreshRetryTimer = null;
    const outcome = await tryRefreshSession();
    if (outcome === 'rejected' && (await getToken())) {
      notifyAuthFailure(new ApiError('Session expired', { status: 401, kind: 'auth', code: 'REFRESH_REJECTED' }));
    }
  }, delay);
}

/**
 * Renew the access token, at most one request in flight. Without this guard a
 * screen that fires eight parallel calls turns one expiry into eight refreshes,
 * and with rotating refresh tokens all but one of them lose the race and would
 * sign the user out.
 */
export function tryRefreshSession(): Promise<RefreshOutcome> {
  return beginSingleFlight(_refreshSlot, performRefresh).then((outcome) => {
    if (outcome === 'unavailable') {
      scheduleRefreshRetry();
    } else {
      _refreshRetryDelay = REFRESH_RETRY_MIN_MS;
      if (_refreshRetryTimer) { clearTimeout(_refreshRetryTimer); _refreshRetryTimer = null; }
    }
    return outcome;
  });
}

async function safeParseJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
}

function extractErrorMeta(data: any): { message: string; code: string | null } {
  const code =
    data?.error?.code ??
    data?.code ??
    data?.error_code ??
    null;
  const raw =
    data?.error?.message ||
    data?.message ||
    (typeof data?.error === 'string' ? data.error : null) ||
    null;
  const codeStr = code ? String(code) : null;
  return {
    message: friendlyUserMessage(raw, codeStr) || '',
    code: codeStr,
  };
}

// ── Core HTTP ────────────────────────────────────────────────
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: object,
  requiresAuth = true,
  basePrefix: 'api' | 'tally' = 'api',
  /** Internal: false on the replay so one expiry can never loop. */
  allowRefresh = true,
  responseType: 'json' | 'text' = 'json',
  timeoutMs: number = REQUEST_TIMEOUT_MS,
  /** Internal: false on the replay of a response older than one already shown. */
  allowRevisionRetry = true,
): Promise<T> {
  // After an app refresh, company data must not be asked for before the workspace is restored:
  // without X-Workspace-Id the server would answer for another workspace ("Something went wrong").
  if (requiresAuth && !_activeWorkspaceId && /[?&]companyGuid=/.test(endpoint)) {
    await new Promise<void>((resume) => {
      const timer = setTimeout(resume, 8_000);
      _workspaceWaiters.push(() => { clearTimeout(timer); resume(); });
    });
  }
  const token = requiresAuth ? await getToken() : null;
  // Fail client-side before hitting backend (avoids "No token provided" spam)
  if (requiresAuth && !token) {
    throw new ApiError('Not authenticated', { status: 401, kind: 'auth', code: 'NO_TOKEN' });
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...CLIENT_HEADERS };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Workspace is never in JWT — attach header for all authenticated business calls.
  if (requiresAuth && _activeWorkspaceId) {
    headers['X-Workspace-Id'] = _activeWorkspaceId;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}/${basePrefix}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      // Prevent HTTP 304 empty-body responses (Express etag) wiping KPI/dashboard JSON
      cache: 'no-store',
    });

    setDeviceOnline(true);
    if (res.ok) markServerReachable(true);
    else if (res.status === 502 || res.status === 503 || res.status === 504) markServerReachable(false);
    if (responseType === 'text') {
      if (!res.ok) {
        const data = await safeParseJson(res);
        const { message, code } = extractErrorMeta(data);
        const kind = kindFromStatus(res.status, code);
        const accessRefused = res.status === 403 && !!code && ACCESS_CODES.has(code);
        const err = new ApiError(accessRefused ? NOT_IN_ACCESS : (message || `HTTP ${res.status}`), { status: res.status, code, kind, raw: data });
        if (res.status === 401) {
          if (requiresAuth && allowRefresh) {
            const outcome = await tryRefreshSession();
            if (outcome === 'refreshed') {
              clearTimeout(timer);
              return await request<T>(method, endpoint, body, requiresAuth, basePrefix, false, responseType, timeoutMs);
            }
            if (outcome === 'unavailable') throw err;
          }
          notifyAuthFailure(err);
        } else if (res.status === 403 || res.status === 402 || res.status === 409) {
          if (!(method === 'GET' && code && ACCESS_CODES.has(code))) toastRbasError(err);
        }
        throw err;
      }
      return (await res.text()) as T;
    }
    const data = await safeParseJson(res);

    // 304 / empty body: browsers & RN may cache GETs; treat as failure so callers retry
    if (res.status === 304 || (res.ok && data == null && method === 'GET')) {
      throw new ApiError('Empty response from server. Please retry.', {
        status: res.status,
        kind: 'network',
        code: 'EMPTY_RESPONSE',
      });
    }

    if (!res.ok) {
      const { message, code } = extractErrorMeta(data);
      const kind = kindFromStatus(res.status, code);
      // A 503 naming a feature the server has switched off (GST_NOT_CONFIGURED), or a 502–504 naming the GST
      // portal the server could not reach (GST_PORTAL_*), came from a server that is up.
      const featureOff = !!code && ((res.status === 503 && /_NOT_CONFIGURED$/.test(code)) || /^GST_PORTAL_/.test(code));
      if (featureOff) markServerReachable(true);
      // A refusal of the member's access reads "Not in your access" everywhere, so screens lock instead of erroring.
      const accessRefused = res.status === 403 && !!code && ACCESS_CODES.has(code);
      const err = new ApiError(
        accessRefused ? NOT_IN_ACCESS : (message || `HTTP ${res.status}`),
        { status: res.status, code, kind, raw: data },
      );
      // Genuine protected 401 → try the refresh token once, then replay the
      // request. Only a dead session reaches the central sign-out.
      // Never logout on 403 / RBAS codes.
      if (res.status === 401) {
        if (requiresAuth && allowRefresh) {
          const outcome = await tryRefreshSession();
          if (outcome === 'refreshed') {
            clearTimeout(timer);
            return await request<T>(method, endpoint, body, requiresAuth, basePrefix, false, responseType, timeoutMs);
          }
          if (outcome === 'unavailable') throw err;
        }
        notifyAuthFailure(err);
      } else if (res.status === 403 || res.status === 402 || res.status === 409) {
        // Background reads outside the member's access stay quiet; the screen shows the lock.
        if (!(method === 'GET' && code && ACCESS_CODES.has(code))) toastRbasError(err);
      } else if (res.status >= 500 && !featureOff) {
        reportError(err, { method, endpoint: endpoint.split('?')[0], status: res.status, code });
      }
      throw err;
    }

    const revisionCompany = method === 'GET' ? companyGuidOf(endpoint) : null;
    if (revisionCompany) {
      const outcome = noteRevision(_activeWorkspaceId, revisionCompany, res.headers?.get?.(DATA_REVISION_HEADER));
      if (outcome === 'older' && allowRevisionRetry) {
        clearTimeout(timer);
        return await request<T>(method, endpoint, body, requiresAuth, basePrefix, allowRefresh, responseType, timeoutMs, false);
      }
    }

    return data as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;

    const aborted =
      e?.name === 'AbortError' ||
      e?.message === 'Aborted' ||
      controller.signal.aborted;
    markServerReachable(false);
    if (aborted) {
      setDeviceOnline(false);
      throw new ApiError('Request timed out. Please try again.', {
        status: null,
        kind: 'timeout',
        code: 'TIMEOUT',
      });
    }

    // Network / DNS / connection refused
    setDeviceOnline(false);
    throw new ApiError(
      e?.message || 'Network error. Please check your connection.',
      { status: null, kind: 'network', code: 'NETWORK', raw: e },
    );
  } finally {
    clearTimeout(timer);
  }
}

const get      = <T>(endpoint: string, auth = true) => request<T>('GET', endpoint, undefined, auth);
const tallyGet = <T>(endpoint: string, auth = true) => request<T>('GET', endpoint, undefined, auth, 'tally');
const post = <T>(endpoint: string, body?: object, auth = true) => request<T>('POST', endpoint, body, auth);
const patch = <T>(endpoint: string, body?: object) => request<T>('PATCH', endpoint, body);
const del   = <T>(endpoint: string, body?: object) => request<T>('DELETE', endpoint, body);

/** When the selected company is canonical Demo, writes go to /api/demo/entries — never write_queue. */
let _writeAsDemo = false;
export function setWriteAsDemo(enabled: boolean) {
  _writeAsDemo = !!enabled;
}
export function getWriteAsDemo() {
  return _writeAsDemo;
}

export const createDemoEntry = (entryType: string, payload: object) =>
  post<any>('/demo/entries', { entryType, payload });
export const listDemoEntries = () => get<any>('/demo/entries');
export const deleteDemoEntry = (id: string) => del<any>(`/demo/entries/${encodeURIComponent(id)}`);
export const clearDemoEntries = () => del<any>('/demo/entries');

export function resolveWriteTarget(writeAsDemo: boolean, tallyEndpoint: string, demoEntryType?: string) {
  if (writeAsDemo && demoEntryType) {
    return { prefix: 'api' as const, endpoint: '/demo/entries', demo: true as const };
  }
  return { prefix: 'tally' as const, endpoint: tallyEndpoint, demo: false as const };
}

const tallyPost = <T>(endpoint: string, body: object, demoEntryType?: string) => {
  const target = resolveWriteTarget(_writeAsDemo, endpoint, demoEntryType);
  if (target.demo && demoEntryType) {
    return createDemoEntry(demoEntryType, body) as Promise<T>;
  }
  return request<T>('POST', endpoint, body, true, 'tally');
};

// Helper: append companyGuid + optional fy= param to query string
// fy = financial year in backend format e.g. '2025-2026'
const withCompany = (endpoint: string, companyGuid?: string, extra?: Record<string, string | undefined>) => {
  const params = new URLSearchParams();
  if (companyGuid) params.set('companyGuid', companyGuid);
  if (extra) Object.entries(extra).forEach(([k, v]) => { if (v != null && v !== '') params.set(k, v); });
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
};

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

export interface SendOTPResponse {
  success: boolean;
  data?: { message: string; expires_in: number; masked_phone: string; otp?: string };
}

export interface VerifyOTPResponse {
  success: boolean;
  data: {
    // 2FA flow
    requires_2fa?: boolean;
    pre_auth_token?: string;
    biometric_enabled?: boolean;
    // Normal login flow
    is_new_user?: boolean;
    access_token?: string;
    refresh_token?: string;
    session_id?: string;
    expires_in?: number;
    user?: { id: number; name: string | null; phone: string; language: string };
    // Pairing is per-workspace (WorkspaceContext.pairingStatus) — the login
    // response deliberately exposes no user-global paired flag.
    company?: { guid: string; name: string; gstin: string | null } | null;
  };
}

export interface RegisterResponse {
  success: boolean;
  data: {
    user: { id: number; name: string; phone: string; email: string; language: string };
    workspace?: { id: string; name: string };
    access_token: string;
    refresh_token?: string;
    session_id?: string;
  };
}

export interface AccountDeletionStartResponse {
  success: boolean;
  data: { masked_phone: string; message: string };
}

export interface OwnedSharedWorkspace {
  id: string;
  name: string;
  members: number;
}

export const sendOTP    = (phone: string): Promise<SendOTPResponse> => post<SendOTPResponse>('/auth/send-otp', { phone }, false);
export const verifyOTP  = (phone: string, otp: string, opts?: { reset_pin?: boolean }): Promise<VerifyOTPResponse> =>
  post<VerifyOTPResponse>('/auth/verify-otp', { phone, otp, ...opts }, false);
export const registerUser = (data: Partial<{ name: string; email: string; language: string; phone: string; workspace_name: string }>): Promise<RegisterResponse> => post<RegisterResponse>('/auth/register', data);
/** Sign-up email verification: a 6-digit code to the email, then confirm it. */
export const sendSignupEmailCode   = (email: string) => post<any>('/auth/email/send-code', { email });
export const verifySignupEmailCode = (email: string, otp: string) => post<any>('/auth/email/verify-code', { email, otp });
export const getMe       = () => get<any>('/auth/me');
export const updateMe    = (data: Partial<{ name: string; email: string; language: string }>) => patch<any>('/auth/me', data);
export const logout      = (pushToken?: string) => post<any>('/auth/logout', pushToken ? { pushToken } : {});
/** Account deletion: a WhatsApp code to the account's number, then confirm it. The server ends every session. */
export const startAccountDeletion   = () => post<AccountDeletionStartResponse>('/auth/account/delete/start');
export const confirmAccountDeletion = (otp: string) =>
  post<{ success: boolean; data: { deleted: boolean } }>('/auth/account/delete/confirm', { otp });

/** Workspaces with other members that block deleting the account (409 OWNS_SHARED_WORKSPACE); null for any other error. */
export function ownedSharedWorkspaces(err: unknown): OwnedSharedWorkspace[] | null {
  if (!(err instanceof ApiError) || err.code !== 'OWNS_SHARED_WORKSPACE') return null;
  const list = (err.raw as any)?.error?.workspaces;
  return Array.isArray(list) ? list : [];
}

const LOGOUT_TIMEOUT_MS = 5_000;
const LOGOUT_RETRY_DELAY_MS = 500;

export type ServerLogoutResult = { ok: boolean; revoked?: number; reason?: string };

/**
 * Ends this session on the server without the 401 → sign-out interceptor (a logout loop). The session is named
 * by the access token (an expired one still counts) and the refresh token; `pushToken` stops this device's
 * notifications. Each try gives up after 5 seconds, and a 503 (LOGOUT_FAILED) or a network failure is tried
 * once more. Nothing is thrown: the caller clears the device whatever the answer.
 */
export async function logoutOnServer(pushToken?: string | null): Promise<ServerLogoutResult> {
  const [access, refresh] = await Promise.all([getToken(), getRefreshToken()]);
  if (!access && !refresh) return { ok: false, reason: 'no-token' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...CLIENT_HEADERS };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (_activeWorkspaceId) headers['X-Workspace-Id'] = _activeWorkspaceId;
  const body = JSON.stringify({
    ...(refresh ? { refreshToken: refresh } : {}),
    ...(pushToken ? { pushToken } : {}),
  });
  let result = await logoutOnce(headers, body);
  if (result.retry) {
    await new Promise((resume) => setTimeout(resume, LOGOUT_RETRY_DELAY_MS));
    result = await logoutOnce(headers, body);
  }
  return { ok: result.ok, revoked: result.revoked, reason: result.reason };
}

async function logoutOnce(headers: Record<string, string>, body: string): Promise<ServerLogoutResult & { retry?: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST', headers, body, signal: controller.signal, cache: 'no-store',
    });
    const data = await safeParseJson(res);
    if (res.ok) {
      const revoked = Number(data?.data?.revoked);
      return { ok: true, revoked: Number.isFinite(revoked) ? revoked : undefined };
    }
    const code = data?.error?.code ? String(data.error.code) : null;
    // 401 (UNAUTHORIZED / SESSION_INVALID): no token names a live session, so there is nothing left to end.
    return { ok: false, reason: code || `http-${res.status}`, retry: code === 'LOGOUT_FAILED' || res.status === 503 };
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'network', retry: true };
  } finally {
    clearTimeout(timer);
  }
}

export interface AuthSessionRow {
  id: string;
  /** 'app' | 'web'; null for sign-ins from before the server recorded it. */
  client_type: string | null;
  /** "Pixel 7 (Android 15)", "Chrome on macOS"; null when the server never learnt it. */
  device_label: string | null;
  /** Epoch seconds. */
  created_at: number | null;
  last_used_at: number | null;
  /** The session making this request. */
  current: boolean;
}
/** GET /auth/sessions — this user's signed-in sessions, the calling one first. */
export const getAuthSessions = () =>
  get<{ success: boolean; data: { sessions: AuthSessionRow[] } }>('/auth/sessions');
/** POST /auth/logout-all — ends every session of this user; `keepCurrent` keeps this one signed in. */
export const logoutAllSessions = (keepCurrent: boolean) =>
  post<{ success: boolean; data: { revoked: number } }>('/auth/logout-all', keepCurrent ? { keepCurrent: true } : {});
export const registerPushToken = (token: string, platform: string, deviceId?: string) =>
  post<any>('/push-token', { token, platform, deviceId });
export const removePushToken = (token?: string) =>
  del<any>('/push-token', token ? { token } : {});

// ══════════════════════════════════════════════════════════════
// TALLY SYNC / PAIRING
// ══════════════════════════════════════════════════════════════

/** @deprecated Use pairWorkspaceTally — legacy user-scoped pair removed in Phase E. */
export const pairWithTally = (_pairing_code: string) =>
  Promise.reject(new Error('WORKSPACE_REQUIRED: use pairWorkspaceTally(workspaceId, code)'));
/** @deprecated Use unpairWorkspaceTally */
export const unpairDevice = () =>
  Promise.reject(new Error('WORKSPACE_REQUIRED: use unpairWorkspaceTally(workspaceId)'));
export const getTallySyncStatus = () => get<any>('/tally-sync/status');
export const getCompanies     = () => get<any>('/companies');
export const getCompanyYears   = (companyGuid?: string) => get<any>(withCompany('/company/years', companyGuid));
export const getCompanyProfile  = (companyGuid?: string) => get<any>(withCompany('/company/profile', companyGuid));
export const uploadCompanyLogo  = (companyGuid: string, logo: string) => post<any>(`/company/${companyGuid}/logo`, { logo });
export const getCompanyLogo     = (companyGuid: string) => get<any>(`/company/${companyGuid}/logo`);

export const getNotificationSettings  = () => get<any>('/notification-settings');
export const updateNotificationSettings = (data: any) => patch<any>('/notification-settings', data);
export const getAlertSettings         = () => get<any>('/alert-settings');
export const updateAlertSettings      = (data: any) => patch<any>('/alert-settings', data);
export const getIntegrationSettings   = () => get<any>('/integration-settings');
export const updateIntegrationSettings = (data: any) => patch<any>('/integration-settings', data);

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════

export const getKPIStrip = (companyGuid?: string, period = '7D', from?: string, to?: string) =>
  get<any>(withCompany('/dashboard/kpi-strip', companyGuid, { period, ...(from && to ? { from, to } : {}) }));

export const getMetrics = (companyGuid?: string, period = '7D', from?: string, to?: string) =>
  get<any>(withCompany('/dashboard/metrics', companyGuid, { period, ...(from && to ? { from, to } : {}) }));

export const getCashflow = (companyGuid?: string, period = '7D', from?: string, to?: string) =>
  get<any>(withCompany('/dashboard/cashflow', companyGuid, { period, ...(from && to ? { from, to } : {}) }))
    .then((res: any) => {
      const d = res?.data ?? res;
      if (!d || typeof d !== 'object') return null;
      return {
        netCash:              d.net_cash              ?? d.netCash              ?? 0,
        grossCash:            d.gross_cash            ?? d.grossCash            ?? 0,
        netRealisableBalance: d.net_realisable_balance?? d.netRealisableBalance ?? 0,
        grossProfit:          d.gross_profit          ?? d.grossProfit          ?? 0,
        netProfit:            d.net_profit            ?? d.netProfit            ?? 0,
        incomePercentage:     d.income_percentage     ?? d.incomePercentage     ?? 0,
        updatedAt:            d.updated_at            ?? d.updatedAt            ?? null,
        totalIncome:          d.total_income          ?? d.totalIncome          ?? 0,
        totalExpense:         d.total_expense         ?? d.totalExpense         ?? 0,
        sales:                d.sales                 ?? 0,
        purchase:             d.purchase              ?? 0,
        grossProfitVsSalesPct: d.gross_profit_vs_sales_pct ?? d.grossProfitVsSalesPct
          ?? d.income_percentage ?? d.incomePercentage ?? 0,
        series:               Array.isArray(d.series) ? d.series : [],
        interval:             d.interval ?? null,
      };
    });

export const getRecentActivity = (companyGuid?: string) => get<any>(withCompany('/dashboard/recent-activity', companyGuid));
/** Global search; `period` bounds vouchers to the selected financial year (same contract as the web portal). */
export const searchDashboard   = (q: string, companyGuid?: string, period: { from?: string; to?: string } = {}) =>
  get<any>(withCompany('/dashboard/search', companyGuid, { q, ...(period.from && period.to ? { from: period.from, to: period.to } : {}) }));

// ══════════════════════════════════════════════════════════════
// SALES
// ══════════════════════════════════════════════════════════════

export const getSalesInvoices  = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/invoices', companyGuid, params));
export const getSalesVouchers  = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/vouchers', companyGuid, params));
export const getSalesVoucherCounts = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/vouchers/counts', companyGuid, params));
export const getSalesInvoiceCreditNoteContext = (invoiceId: string, companyGuid: string) =>
  get<any>(withCompany(`/sales/invoices/${encodeURIComponent(invoiceId)}/credit-note-context`, companyGuid));
export const getSalesOrders    = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/orders', companyGuid, params));
export const getCreditNotes    = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/credit-notes', companyGuid, params));
export const getDeliveryNotes  = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/delivery-notes', companyGuid, params));
export const getEWayBills      = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/ewaybills', companyGuid, params));
export const createSalesInvoice  = (payload: any) => tallyPost<any>('/voucher/sales', payload, 'sales');
export const createProformaInvoice = (payload: any) => tallyPost<any>('/voucher/proforma', payload, 'proforma');
export const convertProformaInvoice = (payload: any) => tallyPost<any>('/voucher/proforma/convert', payload);

// Sales ledger accounts (Sales Accounts group only)
export const getSalesLedgerAccounts = (companyGuid?: string) =>
  get<any>(withCompany('/sales/ledger-accounts', companyGuid));

// Tax ledgers (GST/CGST/SGST/IGST)
export const getTaxLedgers = (companyGuid?: string) =>
  get<any>(withCompany('/tax/ledgers', companyGuid));

// Charge ledgers (logistics & additional charges for invoice form)
export const getChargeLedgers = (companyGuid?: string) =>
  get<any>(withCompany('/charge-ledgers', companyGuid));

// Create customer/party in Tally
export const createTallyParty = (payload: any) => tallyPost<any>('/master/party', payload);

// Geo masters (Tally country / state-emirate-province spellings)
export const getGeoCountries = () => get<any>('/geo/countries');
export const getGeoStates = (country: string) =>
  get<any>(`/geo/states?country=${encodeURIComponent(country)}`);

export const createSalesOrder    = (payload: any) => tallyPost<any>('/voucher/sales-order', payload, 'sales_order');
export const createCreditNote    = (payload: any) => tallyPost<any>('/voucher/credit-note', payload, 'credit_note');
export const createDeliveryNote  = (payload: any) => tallyPost<any>('/voucher/delivery-note', payload, 'delivery_note');

// ══════════════════════════════════════════════════════════════
// PURCHASE
// ══════════════════════════════════════════════════════════════

export const getPurchaseInvoices = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/invoices', companyGuid, params));
export const getPurchaseVouchers = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/vouchers', companyGuid, params));
export const getPurchaseVoucherCounts = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/vouchers/counts', companyGuid, params));
export const getPurchaseInvoiceDebitNoteContext = (invoiceId: string, companyGuid: string) =>
  get<any>(withCompany(`/purchase/invoices/${encodeURIComponent(invoiceId)}/debit-note-context`, companyGuid));
export const getPurchaseOrders   = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/orders', companyGuid, params));
export const getDebitNotes       = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/debit-notes', companyGuid, params));
export const getPurchaseLedgerAccounts = (companyGuid?: string) =>
  get<any>(withCompany('/purchase/ledger-accounts', companyGuid));
export const createPurchaseInvoice = (payload: any) => tallyPost<any>('/voucher/purchase', payload, 'purchase');
export const createPurchaseOrder   = (payload: any) => tallyPost<any>('/voucher/purchase-order', payload, 'purchase_order');
export const createDebitNote       = (payload: any) => tallyPost<any>('/voucher/debit-note', payload, 'debit_note');

// ══════════════════════════════════════════════════════════════
// VOUCHERS
// ══════════════════════════════════════════════════════════════

export const getVouchers       = (companyGuid?: string, type?: string, params?: any) => get<any>(withCompany('/vouchers', companyGuid, { ...(type ? { type } : {}), ...params }));
export const getVoucherById    = (companyGuid?: string, guid?: string) => get<any>(withCompany(`/vouchers/${guid}`, companyGuid));
export const createPaymentVoucher = (payload: any) => tallyPost<any>('/voucher/payment', payload, 'payment');
export const createReceiptVoucher = (payload: any) => tallyPost<any>('/voucher/receipt', payload, 'receipt');

// 2026-07-09: Receipt Voucher screen — outstanding bills per party (bill_outstanding table).
export const getPartyOutstandingBills = (
  companyGuid: string,
  ledger: string,
  opts?: { drOnly?: boolean; crOnly?: boolean },
) =>
  get<any>(withCompany('/party/outstanding-bills', companyGuid, {
    ledger,
    ...(opts?.drOnly ? { drOnly: 'true' } : {}),
    ...(opts?.crOnly ? { crOnly: 'true' } : {}),
  }));

// Receipt / Payment preview reuse invoice preview endpoint (buildVoucherDocument branches on voucher_type).
export const getReceiptPreview = (tdkRef: string, companyGuid: string) =>
  request<any>('GET', `/invoice/${encodeURIComponent(tdkRef)}/preview?companyGuid=${companyGuid}`, undefined, true, 'tally');
export const getPaymentPreview = (tdkRef: string, companyGuid: string) =>
  request<any>('GET', `/invoice/${encodeURIComponent(tdkRef)}/preview?companyGuid=${companyGuid}`, undefined, true, 'tally');
export const getJournalPreview = (tdkRef: string, companyGuid: string) =>
  request<any>('GET', `/invoice/${encodeURIComponent(tdkRef)}/preview?companyGuid=${companyGuid}`, undefined, true, 'tally');
export const getContraPreview = (tdkRef: string, companyGuid: string) =>
  request<any>('GET', `/invoice/${encodeURIComponent(tdkRef)}/preview?companyGuid=${companyGuid}`, undefined, true, 'tally');
export const getStockAdjustmentPreview = (tdkRef: string, companyGuid: string) =>
  request<any>('GET', `/invoice/${encodeURIComponent(tdkRef)}/preview?companyGuid=${companyGuid}`, undefined, true, 'tally');
export const getStockTransferPreview = (tdkRef: string, companyGuid: string) =>
  request<any>('GET', `/invoice/${encodeURIComponent(tdkRef)}/preview?companyGuid=${companyGuid}`, undefined, true, 'tally');
export const createJournalVoucher = (payload: any) => tallyPost<any>('/voucher/journal', payload, 'journal');
export const createContraVoucher  = (payload: any) => tallyPost<any>('/voucher/contra', payload, 'contra');

// ══════════════════════════════════════════════════════════════
// LEDGERS
// ══════════════════════════════════════════════════════════════

// Ledger endpoints accept optional fy= param for FY-specific balances
export const getLedgers        = (companyGuid?: string, params?: any) => get<any>(withCompany('/ledgers', companyGuid, params));
export const getBankLedgers    = (companyGuid?: string, type: 'bank' | 'cash' | 'all' = 'all') => get<any>(withCompany('/bank-ledgers', companyGuid, { type }));
export const getLedgerFyBalances = (companyGuid?: string, fy?: string) => get<any>(withCompany('/ledgers/fy-balances', companyGuid, fy ? { fy } : {}));
export const getLedgerDetail   = (companyGuid?: string, id?: string, params?: any) => get<any>(withCompany(`/ledgers/${id}`, companyGuid, params));
export const getLedgerStatement = (companyGuid?: string, id?: string, fy?: string, params?: any) => get<any>(withCompany(`/ledgers/${id}/statement`, companyGuid, { ...(fy ? { fy } : {}), ...params }));
export const createLedger      = (payload: any) => tallyPost<any>('/master/party', payload, 'party');

/** Master/ledger preview keyed by write_queue.id (not TDK ref). */
export const getMasterPreview = (queueId: string | number, companyGuid: string) =>
  request<any>('GET', `/master/${encodeURIComponent(String(queueId))}/preview?companyGuid=${companyGuid}`, undefined, true, 'tally');

// ══════════════════════════════════════════════════════════════
// STOCKS
// ══════════════════════════════════════════════════════════════

export const getStocks          = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/items', companyGuid, params));
export const getStockFastSlow      = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/fast-slow', companyGuid, params));
export const getExpirySchedule     = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/expiry-schedule', companyGuid, params));
export const getTransferHistory    = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/transfer-history', companyGuid, params));
export const getStockSnapshot        = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/snapshot',                 companyGuid, params));
export const getAgedItems            = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/aged-items',                companyGuid, params));
export const getMovementAnalytics    = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/movement-analytics',        companyGuid, params));
export const getMovementChart        = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/movement-analytics/chart',  companyGuid, params));
export const getNegativeStock    = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/negative-stock', companyGuid, params));
export const getStockDashboard  = (companyGuid: string) =>
  get<any>(withCompany('/stocks/dashboard', companyGuid));
export const getStockItem    = (companyGuid?: string, id?: string, params?: any) => get<any>(withCompany(`/stocks/items/${id}`, companyGuid, params));
export const getWarehouses       = (companyGuid?: string) => get<any>(withCompany('/stocks/warehouses', companyGuid));
export const getWarehouseDetail  = (companyGuid?: string, id?: string) => get<any>(withCompany(`/stocks/warehouses/${id}`, companyGuid));
export const getParties      = (companyGuid?: string, params?: any) => get<any>(withCompany('/parties', companyGuid, params));
export const resolveEinvoiceQr = (companyGuid: string, params: { sellerGstin: string; irn: string }) =>
  get<any>(withCompany('/purchase/einvoice-qr-resolve', companyGuid, params));
export const uploadPurchaseBillAttachment = (payload: { companyGuid: string; invoiceUuid: string; file: string }) =>
  post<any>('/purchase/bill-attachment', payload);
/** Must exceed the server's queue wait + OCR budget (billDocumentAnalyzer.js). */
const BILL_ANALYZE_TIMEOUT_MS = 45_000;
/** Reads a bill photo/PDF on the server (text layer or OCR) and says whether it looks like a bill. */
export const analyzePurchaseBill = (payload: { companyGuid: string; file: string }) =>
  request<any>('POST', '/purchase/bill-analyze', payload, true, 'api', true, 'json', BILL_ANALYZE_TIMEOUT_MS);
export const getPurchaseBillAttachment = (companyGuid: string, invoiceUuid: string) =>
  get<any>(withCompany(`/purchase/bill-attachment/${encodeURIComponent(invoiceUuid)}`, companyGuid));
export const createStockItem       = (payload: any) => tallyPost<any>('/master/stock-item', payload, 'stock_item');
export const createWarehouse       = (payload: any) => tallyPost<any>('/master/warehouse', payload, 'warehouse');
export const createStockAdjustment = (payload: any) => tallyPost<any>('/voucher/stock-adjustment', payload, 'stock_adjustment');
export const createStockTransfer   = (payload: any) => tallyPost<any>('/voucher/stock-transfer', payload, 'stock_transfer');
export const cancelVoucher         = (payload: any) => tallyPost<any>('/voucher/cancel', payload);
export const createParty           = (payload: any) => tallyPost<any>('/master/party', payload, 'party');

// ══════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════

export const getReports          = (companyGuid?: string) => get<any>(withCompany('/reports/financial', companyGuid));
export const getFinancialData    = (companyGuid?: string, from?: string, to?: string) => get<any>(withCompany('/reports/financial', companyGuid, from && to ? { from, to } : {}));
export const getFinancialReport  = (companyGuid?: string, from?: string, to?: string) => get<any>(withCompany('/reports/financial-report', companyGuid, from && to ? { from, to } : {}));
export const getFullFinancialReport = (companyGuid?: string, fy?: string, from?: string, to?: string) => get<any>(withCompany('/reports/pl-bs', companyGuid, { ...(fy ? { fy } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }));
export const getGSTReport        = (companyGuid?: string, from?: string, to?: string) => get<any>(withCompany('/reports/gst', companyGuid, from && to ? { from, to } : {}));

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export const getNotifications       = (companyGuid?: string) => get<any>(withCompany('/notifications', companyGuid));
// Notification ids carry percent-encoded characters, so the id must be encoded in the path.
export const markNotificationRead   = (id: string) => patch<any>(`/notifications/${encodeURIComponent(id)}/read`, {});
export const markAllNotificationsRead = (companyGuid?: string) => patch<any>(withCompany('/notifications/read-all', companyGuid), {});

// ══════════════════════════════════════════════════════════════
// COMPLIANCE ALERTS
// ══════════════════════════════════════════════════════════════

export const getAlerts           = (companyGuid?: string, params?: any) => get<any>(withCompany('/alerts', companyGuid, params));
export const getPaymentReminderLog = (companyGuid: string, page = 1) =>
  get<any>(withCompany('/payment-reminders/log', companyGuid, { page: String(page), limit: '30' }));
export const getEWBStatus        = (companyGuid?: string, params?: any) => get<any>(withCompany('/ewaybills/status', companyGuid, params));
export const getEWBPending       = (companyGuid?: string, params?: any) => get<any>(withCompany('/ewaybills/pending', companyGuid, params));
export const getEWBList          = (companyGuid?: string, params?: any) => get<any>(withCompany('/ewaybills', companyGuid, params));
export const generateEWayBill    = (payload: any) => post<any>('/ewaybills/generate', payload);
export const cancelEWayBill      = (payload: any) => post<any>('/ewaybills/cancel', payload);
export const askHelpAI = (message: string, history?: any[]) => post<any>('/ai/help', { message, history });
export const sendPaymentReminder = (companyGuid: string, data: any) => post<any>('/reminders/send', { companyGuid, ...data });

export const getUnmatchedInvoices = (companyGuid?: string, params?: any) => get<any>(withCompany('/reports/unmatched', companyGuid, params));
export const getEInvoiceStatus    = (companyGuid?: string, params?: any) => get<any>(withCompany('/einvoice/status', companyGuid, params));
export const getEInvoicePending   = (companyGuid?: string, params?: any) => get<any>(withCompany('/einvoice/pending', companyGuid, params));
export const getEInvoiceGenerated = (companyGuid?: string, params?: any) => get<any>(withCompany('/einvoice/generated', companyGuid, params));
export const generateEInvoice     = (payload: any) => post<any>('/einvoice/generate', payload);
export const cancelEInvoice       = (payload: any) => post<any>('/einvoice/cancel',   payload);
// ── Compliance rework (2026-11-03 spec §2) — e-Invoice / e-Way Bill through PeriOne ──
export type ComplianceDomain = 'einvoice' | 'ewaybill';
/** Keys follow the server's mergeDispatchDetails (Tally EWAYBILLDETAILS spelling). */
export interface DispatchDetails {
  dispatch_from?: string;
  ship_to?: string;
  /** 'Road' | 'Rail' | 'Air' | 'Ship' (or the NIC code '1'–'4'). */
  transport_mode?: string;
  distance?: string | number;
  vehicle_number?: string;
  transporter_id?: string;
  transporter_name?: string;
  transport_doc_no?: string;
  transport_doc_date?: string;
  /** Stock transfer: the receiving godown's address (`ship_to` carries its name). */
  ship_to_address1?: string;
  ship_to_pincode?: string;
  ship_to_state?: string;
}
export interface ReadinessGap { code: string; message: string; fix?: any }
export interface ReadinessRow {
  guid: string;
  voucher_number?: string;
  voucher_type?: string;
  date?: string;
  party_name?: string;
  party_gstin?: string;
  amount?: number;
  preview?: any;
  gaps?: ReadinessGap[];
  irn?: string;
  ack_no?: string;
  ack_date?: string;
  status?: string;
  ewb_number?: string;
  ewb_valid_till?: string;
  vehicle_no?: string;
  transporter_id?: string;
  error_message?: string;
  last_event_at?: string | number;
  /** 'tally' when TallyPrime generated the document (shown here, managed in Tally); 'auditer' when we did. */
  source?: 'tally' | 'auditer' | string;
  /** TallyPrime mode: nothing to register here, the next sync brings the document. */
  pending_in_tally?: boolean;
  /** E-invoice: last day the IRP accepts it (yyyy-mm-dd), days until then (<0 = closed) and how urgent that is. */
  deadline?: string;
  days_left?: number;
  urgency?: 'ok' | 'soon' | 'urgent' | 'expired';
  /** E-way bill: which document this is (sales, delivery_note, job_work, purchase_return, inward_unregistered, stock_transfer). */
  doc_kind?: string;
  supply_type?: 'O' | 'I';
  distance_km?: number | null;
  /** Created in Auditer (app voucher). */
  from_app?: boolean;
  [k: string]: any;
}
export interface ReadinessResponse {
  data: { ready: ReadinessRow[]; attention: ReadinessRow[]; generated: ReadinessRow[] };
  counts?: Record<string, number>;
  /** The company's generation settings: source 'tally' | 'auditer', mode NULL until chosen, active. */
  integration?: {
    active?: boolean; mode?: string | null; source?: string; applicable?: string; auto_since?: string | null;
    /** E-invoice: the 30-day limit applies (true), does not (false), or the ₹10 Cr question is unanswered (null). */
    rule_30_days?: boolean | null;
    app_invoices?: string; app_invoices_choice?: string | null;
    /** Last successful Tally sync; `stale` after 24 hours. */
    desktop?: { last_sync_at?: number | null; hours?: number | null; stale?: boolean } | null;
    [k: string]: any;
  } | null;
}
/** GET /einvoice/readiness — Ready / Needs attention / Generated for the period (+ coverage counts). */
export const fetchEinvoiceReadiness = (companyGuid: string, params?: Record<string, string | undefined>) =>
  get<ReadinessResponse>(withCompany('/einvoice/readiness', companyGuid, params));
/** POST /einvoice/generate — 2 credits; `alsoEwb` adds an e-way bill (2 more) with `dispatchDetails`. */
export const generateEinvoice = (payload: { companyGuid: string; voucherGuid: string; alsoEwb?: boolean; dispatchDetails?: DispatchDetails }) =>
  post<any>('/einvoice/generate', payload);
export const generateEinvoiceBulk = (payload: { companyGuid: string; voucherGuids: string[]; alsoEwb?: boolean }) =>
  post<any>('/einvoice/generate-bulk', payload);
/** GET /einvoice/:voucherGuid — { voucher, einvoice, ewaybill, history }. */
export const getEinvoiceRecord = (companyGuid: string, voucherGuid: string) =>
  get<any>(withCompany(`/einvoice/${encodeURIComponent(voucherGuid)}`, companyGuid));
/** GET /einvoice/:voucherGuid/signed-json — the signed payload as text (shared as IRN-<irn>.json). */
export const getEinvoiceSignedJson = (companyGuid: string, voucherGuid: string) =>
  request<string>('GET', withCompany(`/einvoice/${encodeURIComponent(voucherGuid)}/signed-json`, companyGuid), undefined, true, 'api', true, 'text');
export const verifyEinvoice = (companyGuid: string, voucherGuid: string) =>
  post<any>(`/einvoice/${encodeURIComponent(voucherGuid)}/verify`, { companyGuid });
export const refreshEinvoice = (companyGuid: string, voucherGuid: string) =>
  post<any>(`/einvoice/${encodeURIComponent(voucherGuid)}/refresh`, { companyGuid });
export const fetchEwbReadiness = (companyGuid: string, params?: Record<string, string | undefined>) =>
  get<ReadinessResponse>(withCompany('/ewaybills/readiness', companyGuid, params));
/** POST /ewaybills/generate — `subSupplyType` / `subSupplyDesc` say why a delivery note's goods move; `fromGodown` for a stock transfer. */
export const generateEwb = (payload: {
  companyGuid: string; voucherGuid: string; dispatchDetails?: DispatchDetails;
  subSupplyType?: string; subSupplyDesc?: string; fromGodown?: string; docKind?: string;
}) => post<any>('/ewaybills/generate', payload);
export const generateEwbBulk = (payload: { companyGuid: string; voucherGuids: string[]; dispatchDetails?: DispatchDetails }) =>
  post<any>('/ewaybills/generate-bulk', payload);
export const getEwbRecord = (companyGuid: string, voucherGuid: string) =>
  get<any>(withCompany(`/ewaybills/${encodeURIComponent(voucherGuid)}`, companyGuid));
/** POST /ewaybills/:voucherGuid/vehicle — Part B / vehicle update (reasonCode 4 = first time). */
export const updateEwbVehicle = (companyGuid: string, voucherGuid: string, body: {
  vehicleNo: string; fromPlace: string; fromState: string; reasonCode: string | number; reasonRem?: string;
  transMode: string | number; transDocNo?: string; transDocDate?: string;
}) => post<any>(`/ewaybills/${encodeURIComponent(voucherGuid)}/vehicle`, { companyGuid, ...body });
export const updateEwbTransporter = (companyGuid: string, voucherGuid: string, transporterId: string) =>
  post<any>(`/ewaybills/${encodeURIComponent(voucherGuid)}/transporter`, { companyGuid, transporterId });
export const extendEwb = (companyGuid: string, voucherGuid: string, body: {
  vehicleNo: string; fromPlace: string; fromState: string; fromPincode: string; remainingDistance: string | number;
  transMode: string | number; extendRsnCode: string | number; extendRemarks: string; consignmentStatus: 'M' | 'T';
  transitType?: string; addressLine1?: string;
}) => post<any>(`/ewaybills/${encodeURIComponent(voucherGuid)}/extend`, { companyGuid, ...body });
export const refreshEwb = (companyGuid: string, voucherGuid: string) =>
  post<any>(`/ewaybills/${encodeURIComponent(voucherGuid)}/refresh`, { companyGuid });
export const createConsolidatedEwb = (payload: {
  companyGuid: string; ewbNos: string[]; fromPlace: string; fromState: string; vehicleNo: string;
  transMode: string | number; transDocNo?: string; transDocDate?: string;
}) => post<any>('/ewaybills/consolidated', payload);
export const listConsolidatedEwbs = (companyGuid: string) =>
  get<any>(withCompany('/ewaybills/consolidated', companyGuid));
/** GET /ewaybills/incoming?date=dd/mm/yyyy — bills others generated on this GSTIN. */
export const listIncomingEwbs = (companyGuid: string, date: string) =>
  get<any>(withCompany('/ewaybills/incoming', companyGuid, { date }));
export const acceptIncomingEwb = (companyGuid: string, ewbNo: string) =>
  post<any>(`/ewaybills/incoming/${encodeURIComponent(ewbNo)}/accept`, { companyGuid });
export const rejectIncomingEwb = (companyGuid: string, ewbNo: string) =>
  post<any>(`/ewaybills/incoming/${encodeURIComponent(ewbNo)}/reject`, { companyGuid });
/** POST /compliance/event — records share / print / download_pdf (the PDF itself is built on the device). */
export const recordComplianceEvent = (payload: { companyGuid: string; voucherGuid: string; domain: ComplianceDomain; action: 'download_pdf' | 'print' | 'share'; detail?: any }) =>
  post<any>('/compliance/event', payload);
export const getComplianceHistory = (companyGuid: string, voucherGuid: string) =>
  get<any>(withCompany('/compliance/history', companyGuid, { voucherGuid }));
/** POST /tally/master/party-alter — GSTIN / pincode / state written back to the Tally ledger. */
export const alterParty = (payload: { companyGuid: string; ledgerGuid?: string; ledgerName?: string; gstin?: string; pincode?: string; state?: string; address?: string }) =>
  tallyPost<any>('/master/party-alter', payload);
/** POST /tally/voucher/sales-correct — alters the same Tally voucher (dated today, no live IRN) with the corrected lines. */
export const correctSalesInvoice = (payload: any) => tallyPost<any>('/voucher/sales-correct', payload, 'sales');

// ── Compliance v2 (spec 2026-11-04 §3.1, §5A) ──
export interface ComplianceConfig {
  e_invoice_applicable?: string;
  e_invoice_mode?: string | null;
  e_invoice_source?: string;
  e_way_bill_applicable?: string;
  e_way_bill_source?: string;
  /** "Has turnover crossed ₹5 Cr in any year since 2017-18?" */
  e_invoice_turnover?: 'above_5cr' | 'below_5cr' | null;
  /** "Was it ₹10 Cr or more?" — the 30-day limit. */
  e_invoice_aato_10cr?: boolean | null;
  e_invoice_app_invoices?: string | null;
  e_invoice_app_invoices_effective?: 'auto' | 'follow_mode' | 'auditer' | 'tally';
  e_invoice_rule_30_days?: boolean;
  /** "Does this business move goods worth ₹50,000 or more?" */
  e_way_bill_moves_goods?: boolean | null;
  e_way_bill_intra_limit?: number | null;
  e_way_bill_intra_limit_effective?: number;
  e_way_bill_doc_kinds?: string[] | null;
  e_way_bill_doc_kinds_effective?: string[];
  e_way_bill_state_rule?: { state_code?: string; state?: string | null; intra?: number; inter?: number; notified_only?: boolean; note?: string | null; checked_on?: string } | null;
  [k: string]: any;
}
export interface TurnoverYear { fy: string; fy_start?: number; turnover: number; complete: boolean; until?: string }
export interface ComplianceTurnover {
  pan?: string | null;
  pan_source?: 'profile' | 'gstin' | null;
  companies?: { guid: string; name: string; gstin?: string | null }[];
  years?: TurnoverYear[];
  crossed_5cr_in?: string | null;
  crossed_10cr_in?: string | null;
  advice?: { code: string; message: string | null; effective_from?: string | null; fy?: string | null } | null;
}
/** GET /compliance/turnover — turnover per FY across the PAN's companies (an estimate from the books) and the advice. */
export const getComplianceTurnover = (companyGuid: string) =>
  get<any>(withCompany('/compliance/turnover', companyGuid));
export type ComplianceReportTab = 'attention' | 'ready' | 'generated' | 'failed' | 'all';
/** GET /einvoice/report · /ewaybills/report — the list as CSV text (UTF-8 BOM first). */
export const getComplianceReportCsv = (domain: ComplianceDomain, companyGuid: string, params: { tab: ComplianceReportTab; from?: string; to?: string; fy?: string }) =>
  request<string>('GET', withCompany(domain === 'einvoice' ? '/einvoice/report' : '/ewaybills/report', companyGuid, params), undefined, true, 'api', true, 'text');
export interface VehicleCheckResult {
  available: boolean; found?: boolean; vehicle_no?: string; owner_name_masked?: string; vehicle_class?: string; maker_model?: string;
  registered_at?: string; fitness_upto?: string; insurance_upto?: string; puc_upto?: string; status_note?: string;
}
/** POST /ewaybills/vehicle-check — the vehicle as Vahan knows it; `{ available: false }` when Vahan is not set up. */
export const checkEwbVehicle = (companyGuid: string, vehicleNo: string) =>
  post<any>('/ewaybills/vehicle-check', { companyGuid, vehicleNo });
export interface StoredIncomingEwb {
  ewb_no: string; ewb_date?: string; from_gstin?: string; from_name?: string; doc_no?: string; doc_date?: string;
  value?: number | null; valid_till?: string; status?: string; decision?: string | null; decided_at?: number | null;
  /** Epoch seconds: generation + 72 h, the last moment the portal takes a rejection (also on the by-date rows). */
  reject_by?: number | null;
}
/** GET /ewaybills/incoming/stored — e-way bills raised on this company, as fetched twice a day. */
export const listStoredIncomingEwbs = (companyGuid: string, days = 3) =>
  get<any>(withCompany('/ewaybills/incoming/stored', companyGuid, { days: String(days) }));

export const getGSTDetail        = (companyGuid?: string, params?: any) => get<any>(withCompany('/reports/gst-detail', companyGuid, params));
export const getGSTSummary       = (companyGuid?: string, params?: any) => get<any>(withCompany('/reports/gst-summary', companyGuid, params));

// ── GST returns on PeriOne (spec 2026-11-04 §3.2) — /api/gst/*, 503 GST_NOT_CONFIGURED until the server has credentials ──
export interface GstConnection { status: 'not_connected' | 'connected' | 'expired' | string; connected_at?: number | string | null; expires_at?: number | string | null }
export interface GstConfig {
  returns_mode: 'prepare' | 'draft' | 'file';
  ims_mode: 'decide' | 'view';
  deposit_posting: 'show' | 'button' | 'auto';
  deposit_debit_ledger: string | null;
  deposit_bank_ledger: string | null;
  filing_frequency: 'monthly' | 'quarterly' | null;
  filing_frequency_effective?: string | null;
  username?: string | null;
  gstin?: string | null;
  configured_on_server?: boolean;
  /** GST_READ_ONLY on the server: Auditer only reads from the GST portal. */
  read_only?: boolean;
  connection?: GstConnection | null;
}
export interface GstCalendarRow {
  form: string; period: string; period_label?: string; due_date: string;
  status: 'filed' | 'due' | 'overdue' | 'upcoming' | string; filed_on?: string | null; arn?: string | null; days_left?: number | null;
  /** false when the portal's filing status could not be read: "due" / "overdue" is then only a guess. */
  status_known?: boolean;
}
export interface GstScore { score: number | null; parts?: { key: string; label: string; value: number | null; weight: number; note?: string | null }[] }
export interface GstOverview {
  configured_on_server?: boolean; read_only?: boolean; connection?: GstConnection | null; calendar?: GstCalendarRow[]; score?: GstScore | null; cash_balance?: any; last_deposit?: any;
  /** The filing frequency the server works with: a quarterly filer's GSTR-2B comes per quarter. */
  frequency?: 'monthly' | 'quarterly' | string | null;
}
export interface GstImsRow {
  id: string; section?: string; supplier_gstin?: string; supplier_name?: string; doc_type?: string; doc_no?: string; doc_date?: string;
  taxable?: number; tax?: number; action?: 'accepted' | 'rejected' | 'pending' | 'none' | string; in_books?: boolean; voucher_guid?: string | null;
}
export interface GstImsSection { key: string; label: string; count: number }
export interface GstImsResponse {
  mode: 'decide' | 'view' | string;
  /** The section asked for; null when the answer holds every section. */
  section?: string | null;
  sections?: GstImsSection[];
  period?: string | null;
  rows: GstImsRow[];
}
export type GstImsAction = 'accepted' | 'rejected' | 'pending';
/** 'unknown': Tally did not confirm the voucher, so it may be there already — it cannot be posted again from here. */
export type GstDepositPostStatus = 'not_posted' | 'queued' | 'posted' | 'failed' | 'unknown';
export interface GstDeposit {
  id: string; date: string; reference?: string; description?: string; amount: number;
  igst?: number; cgst?: number; sgst?: number; cess?: number; posted?: boolean; voucher_number?: string | null;
  post_status?: GstDepositPostStatus | null;
  /** Why the last posting failed (Tally's or the queue's own words). */
  post_error?: string | null;
  /** True when Post to Tally (or Post again after a failure) is allowed for this deposit. */
  can_post?: boolean;
}
/** POST /gst/deposits/:id/post — 'success': Tally took it · 'queued': the desktop posts it when online · 'unconfirmed': Tally did not answer. */
export interface GstDepositPostResult { queued: boolean; tdk_ref?: string | null; status: 'success' | 'queued' | 'unconfirmed' | string }
export interface GstinCheck {
  /** `found: false` — the GSTIN is not registered (or not found where it was looked up). */
  available: boolean; found?: boolean; source?: string; gstin?: string; legal_name?: string; trade_name?: string; status?: string; registration_type?: string;
  state?: string; state_code?: string; address?: string; registered_on?: string; cancelled_on?: string | null;
}
export const getGstConfig = (companyGuid: string) => get<any>(withCompany('/gst/config', companyGuid));
export const saveGstConfig = (companyGuid: string, patch: Partial<GstConfig>) => post<any>('/gst/config', { companyGuid, ...patch });
export const requestGstConnectOtp = (companyGuid: string, username: string) => post<any>('/gst/connect/otp', { companyGuid, username });
export const verifyGstConnectOtp = (companyGuid: string, otp: string, keepAliveDays: number, username?: string) =>
  post<any>('/gst/connect/verify', { companyGuid, otp, keepAliveDays, username });
export const disconnectGst = (companyGuid: string) => post<any>('/gst/disconnect', { companyGuid });
export const getGstOverview = (companyGuid: string, fy?: string) => get<any>(withCompany('/gst/overview', companyGuid, { fy }));
/**
 * GET /gst/ims?period=MMYYYY — supplier invoices in the Invoice Management System, matched to the books.
 * Without `section`: every section in one list (each row says its section) and `sections` with the count of each.
 */
export const getGstIms = (companyGuid: string, period: string, section?: string) =>
  get<{ success: boolean; data: GstImsResponse }>(withCompany('/gst/ims', companyGuid, { period, section }));
export const saveGstImsActions = (companyGuid: string, period: string, items: { id: string; action: GstImsAction }[]) =>
  post<any>('/gst/ims/action', { companyGuid, period, items });
export const getGstDeposits = (companyGuid: string, params: { from?: string; to?: string } = {}) => get<any>(withCompany('/gst/deposits', companyGuid, params));
/** Queues a Payment voucher in Tally for the deposit; after a failed posting it posts the deposit again. */
export const postGstDeposit = (companyGuid: string, id: string) =>
  post<{ success: boolean; data: GstDepositPostResult }>(`/gst/deposits/${encodeURIComponent(id)}/post`, { companyGuid });
export const checkGstin = (companyGuid: string, gstin: string) => get<any>(withCompany('/gst/gstin-check', companyGuid, { gstin }));

// ── Invoices as the GST portal holds them, matched to the books (read-only; the server caches a read up to 6 h) ──
export type GstPortalStatus = 'matched' | 'mismatch' | 'books_only' | 'portal_only';
/** Without a period the server answers for the latest one with data and names it in `period`. */
interface GstPortalHead {
  period: string;
  period_label?: string;
  default_period?: string | null;
  default_period_label?: string | null;
  /** false: the portal cannot have this period yet — `message` says when; rows are empty. Not an error. */
  ready: boolean;
  available_from?: string | null;
  message?: string | null;
  /** Epoch seconds of the portal read the answer comes from. */
  fetched_at?: number | null;
}
export interface GstPortalSection {
  key: string;
  label?: string;
  /** null when the section could not be read (`error` says why). */
  count: number | null;
  taxable_value?: number;
  total_tax?: number;
  invoice_value?: number | null;
  error?: string | null;
}
export interface GstPortalSalesSide {
  section?: string; doc_no?: string; doc_date?: string | null; counterparty_gstin?: string | null; place_of_supply?: string | null;
  taxable_value: number; total_tax: number; invoice_value?: number | null; voucher_guid?: string; voucher_number?: string;
}
export interface GstPortalSalesRow {
  status: GstPortalStatus;
  /** doc_no · gstin · section · place_of_supply · value · tax · date */
  reasons: string[];
  section: string;
  doc_type: string;
  doc_no: string;
  doc_date: string | null;
  counterparty_gstin: string | null;
  counterparty_name: string | null;
  place_of_supply: string | null;
  taxable_value: number;
  igst?: number; cgst?: number; sgst?: number; cess?: number;
  total_tax: number;
  invoice_value: number | null;
  irn?: string | null;
  filing_status?: string | null;
  portal: GstPortalSalesSide | null;
  books: GstPortalSalesSide | null;
  /** Books tax − portal tax. */
  difference: number;
}
export interface GstPortalB2csLine {
  status: GstPortalStatus;
  reasons?: string[];
  supply_type: string | null;
  place_of_supply: string | null;
  rate: number;
  taxable_value: number;
  total_tax: number;
  portal: { taxable_value: number; total_tax: number } | null;
  books: { taxable_value: number; total_tax: number } | null;
  difference: number;
}
export interface GstPortalSales extends GstPortalHead {
  frequency?: string;
  /** IFF for months 1 and 2 of a quarterly filer, GSTR1 otherwise. */
  return_form?: string;
  range?: { from: string; to: string };
  filing?: { status: 'filed' | 'not_filed' | null; filed_on?: string | null; arn?: string | null } | null;
  sections?: GstPortalSection[];
  summary?: {
    matched: number; mismatch: number; books_only: number; portal_only: number;
    portal_documents: number; books_documents: number; portal_taxable: number; portal_tax: number;
    books_taxable: number; books_tax: number; tax_difference: number; books_only_tax: number; portal_only_tax: number;
  };
  rows?: GstPortalSalesRow[];
  b2cs?: GstPortalB2csLine[];
}
export interface GstPortalPurchaseRow {
  status: GstPortalStatus;
  /** doc_no · value · tax · date */
  reasons: string[];
  supplier_gstin: string;
  /** null when neither the portal nor a ledger names the supplier. */
  supplier_name: string | null;
  doc_no: string;
  doc_type: string;
  doc_date: string | null;
  books: { voucher_guid?: string; voucher_number?: string; doc_no?: string; doc_date?: string | null; taxable: number; tax: number } | null;
  portal: {
    doc_no?: string; doc_date?: string | null; taxable: number; tax: number; value?: number | null; section?: string | null;
    /** false: the portal does not let this tax be claimed (yet). */
    itc_available?: boolean | null;
    /** GSTR-2A: 'not_filed' while the supplier has not filed the return the document is in. */
    filing_status?: string | null;
    place_of_supply?: string | null; irn?: string | null;
  } | null;
  /** Books tax − portal tax. */
  difference: number;
}
export type GstPurchaseSource = '2b' | '2a';
export interface GstPortalPurchases extends GstPortalHead {
  source: GstPurchaseSource;
  summary?: { matched: number; mismatch: number; books_only: number; portal_only: number; itc_at_risk: number; itc_in_books: number; portal_only_tax: number };
  rows?: GstPortalPurchaseRow[];
  /** GSTR-2A only: b2b and cdn. */
  sections?: GstPortalSection[];
}
/**
 * A cold read asks the portal three sections at a time, each call up to a minute on the server; waiting longer
 * than that lets the server's own GST_PORTAL_TIMEOUT arrive instead of a client timeout (which reads as offline).
 */
const GST_PORTAL_TIMEOUT_MS = 150_000;
/** GET /gst/portal-sales — own sales on the portal (GSTR-1 / IFF) against the books. `period` MMYYYY. */
export const getGstPortalSales = (companyGuid: string, period?: string | null) =>
  request<{ success: boolean; data: GstPortalSales }>(
    'GET', withCompany('/gst/portal-sales', companyGuid, { period: period || undefined }), undefined, true, 'api', true, 'json', GST_PORTAL_TIMEOUT_MS,
  );
/** GET /gst/purchases — GSTR-2B (the default) or GSTR-2A against the purchases in the books. `period` MMYYYY. */
export const getGstPortalPurchases = (companyGuid: string, period: string | null | undefined, source: GstPurchaseSource = '2b') =>
  request<{ success: boolean; data: GstPortalPurchases }>(
    'GET', withCompany('/gst/purchases', companyGuid, { period: period || undefined, source }), undefined, true, 'api', true, 'json', GST_PORTAL_TIMEOUT_MS,
  );
/** The server's "GST filing is not set up on the server yet" answer (503 GST_NOT_CONFIGURED). */
export const isGstNotConfigured = (err: unknown): boolean => {
  const code = (err as any)?.code;
  return code === 'GST_NOT_CONFIGURED' || (err instanceof ApiError && err.status === 503 && !code);
};

// ══════════════════════════════════════════════════════════════
// KPI DETAIL VIEWS
// ══════════════════════════════════════════════════════════════

export const getKPICashInHand = (companyGuid?: string, params?: any) => get<any>(withCompany('/kpi/cash-in-hand', companyGuid, params));
export const getKPIBankBalance = (companyGuid?: string, params?: any) => get<any>(withCompany('/kpi/bank-balance', companyGuid, params));
export const getKPIReceivables = (companyGuid?: string, params?: any) => get<any>(withCompany('/kpi/receivables', companyGuid, params));
export const getKPIPayables    = (companyGuid?: string, params?: any) => get<any>(withCompany('/kpi/payables', companyGuid, params));
export const getKPILoansODs    = (companyGuid?: string) => get<any>(withCompany('/kpi/loans-ods', companyGuid));
export const getKPIPayments    = (companyGuid?: string, params?: any) => get<any>(withCompany('/kpi/payments', companyGuid, params));
export const getKPIReceipts    = (companyGuid?: string, params?: any) => get<any>(withCompany('/kpi/receipts', companyGuid, params));
export const getSalesHomeMetrics = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/home-metrics', companyGuid, params));
export const getPurchaseHomeMetrics = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/home-metrics', companyGuid, params));
export const getExpensesHomeMetrics = (companyGuid?: string, params?: any) => get<any>(withCompany('/expenses/home-metrics', companyGuid, params));

// ══════════════════════════════════════════════════════════════
// EXPENSES + DAYBOOK
// ══════════════════════════════════════════════════════════════

export const getExpenses = (companyGuid?: string, params?: any) => get<any>(withCompany('/expenses', companyGuid, params));
export const getExpenseCounts = (companyGuid?: string, params?: any) => get<any>(withCompany('/expenses/counts', companyGuid, params));
export const getDaybook  = (companyGuid?: string, date?: string) => get<any>(withCompany('/daybook', companyGuid, date ? { date } : {}));

// ══════════════════════════════════════════════════════════════
// COMPANY CAPABILITIES
// ══════════════════════════════════════════════════════════════

export const getCompanyCapabilities = (companyGuid?: string) => get<any>(withCompany('/company/capabilities', companyGuid));

// ══════════════════════════════════════════════════════════════
// BILLING / RAZORPAY RECHARGE (Owner — Checkout on Web/Mobile later)
// ══════════════════════════════════════════════════════════════

export const getBillingOverview = () => get<any>('/billing/overview');
export const getBillingRechargeStatus = () => get<any>('/billing/recharge/status');
export const createBillingRecharge = (credits: number, workspaceId?: string) =>
  post<any>('/billing/recharge/create', { credits, workspaceId });
export const verifyBillingRecharge = (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) => post<any>('/billing/recharge/verify', payload);

// ══════════════════════════════════════════════════════════════
// AUDIT TRAIL
// ══════════════════════════════════════════════════════════════

export const getAuditTrail    = (companyGuid?: string) => tallyGet<any>(withCompany('/audit-trail', companyGuid));
export const retryAuditEntry  = (id: string) => tallyPost<any>(`/audit-trail/${id}/retry`, {});
export const getMyEntries     = (companyGuid?: string, params?: any) =>
  _writeAsDemo ? listDemoEntries() : get<any>(withCompany('/vouchers/my-entries', companyGuid, params));

// ══════════════════════════════════════════════════════════════
// AI INSIGHTS
// ══════════════════════════════════════════════════════════════

export const getAIInsights = (companyGuid?: string, from?: string, to?: string) =>
  get<any>(withCompany('/ai/insights', companyGuid, from && to ? { from, to } : {}));

/** Weekly sales forecast vs actual (last 8 weeks) for the Reports tab AI card. */
export const getAIWeeklyForecast = (companyGuid: string) =>
  get<any>(withCompany('/ai/ai-insights', companyGuid));

export const getAIInsightsHistory = (companyGuid: string, financialYear: string) =>
  get<any>(withCompany(`/ai/insights/history/${financialYear}`, companyGuid));

// ════════════════════════════════════════════════════════════
// USER SETTINGS
// ════════════════════════════════════════════════════════════

export const getUserSettings    = () => get<any>('/auth/user-settings');
export const updateUserSettings = (data: any) => patch<any>('/auth/user-settings', data);

// ── 2FA / Passkey ─────────────────────────────────────────────────────────────
// Helper: POST with a custom bearer token (for pre_auth_token flows)
async function postWithToken<T>(endpoint: string, body: object, customToken: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CLIENT_HEADERS, Authorization: `Bearer ${customToken}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    setDeviceOnline(true);
    const data = await safeParseJson(res);
    if (!res.ok) {
      const { message, code } = extractErrorMeta(data);
      const kind = kindFromStatus(res.status, code);
      const err = new ApiError(message || `HTTP ${res.status}`, {
        status: res.status, code, kind, raw: data,
      });
      // pre_auth 401 should NOT wipe the main session via notifyAuthFailure
      throw err;
    }
    return data as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (e?.name === 'AbortError' || controller.signal.aborted) {
      throw new ApiError('Request timed out. Please try again.', {
        status: null, kind: 'timeout', code: 'TIMEOUT',
      });
    }
    setDeviceOnline(false);
    throw new ApiError(e?.message || 'Network error. Please check your connection.', {
      status: null, kind: 'network', code: 'NETWORK', raw: e,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Phone / Email Change ────────────────────────────────────────────────
export const changePhone = (body: { step: number; currentPhone?: string; otp?: string; newPhone?: string }) =>
  post<any>('/auth/change-phone', body);
export const changeEmail = (body: { step: number; currentEmail?: string; otp?: string; newEmail?: string }) =>
  post<any>('/auth/change-email', body);

// ── Bank Feeds ─────────────────────────────────────────────────────────
export const createBankLedger = (payload: {
  companyGuid: string;
  companyName?: string;
  bankName: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  accountType?: string;
  openingBalance?: number;
  accountHolderName?: string;
}) => request<any>('POST', '/master/bank', payload, true, 'tally');

export const verifyPin   = (pin: string, preAuthToken: string) =>
  postWithToken<any>('/auth/verify-pin', { pin }, preAuthToken);

export const setPin      = (pin: string, currentPin?: string) =>
  post<any>('/auth/set-pin', currentPin ? { pin, current_pin: currentPin } : { pin });
export const resetPin    = (pin: string, preAuthToken: string) =>
  postWithToken<any>('/auth/reset-pin', { pin }, preAuthToken);
export const removePin   = (pin: string) => request<any>('DELETE', '/auth/remove-pin', { pin });
export const setBiometric = (enabled: boolean) => patch<any>('/auth/set-biometric', { enabled });
export const get2FAStatus = () => get<any>('/auth/two-fa-status');


// ── Other Taxes ─────────────────────────────────────────────────────────────
export const getOtherTaxesSummary      = (companyGuid?: string, params?: any) =>
  get<any>(withCompany('/reports/other-taxes/summary', companyGuid, params));
export const getOtherTaxesTransactions = (companyGuid?: string, params?: any) =>
  get<any>(withCompany('/reports/other-taxes/transactions', companyGuid, params));
export const getOtherTaxesLateChallans = (companyGuid?: string, params?: any) =>
  get<any>(withCompany('/reports/other-taxes/late-challans', companyGuid, params));

export const getStockLedger   = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/ledger', companyGuid, params));
export const getStockMovements = (companyGuid?: string, id?: string, params?: any) => get<any>(withCompany(`/stocks/items/${id}/movements`, companyGuid, params));
export const getStockGodowns = (companyGuid?: string, id?: string) => get<any>(withCompany(`/stocks/items/${id}/godowns`, companyGuid));
export const retryMyEntry = (id: string, opts: { confirmOutcomeUnknown?: boolean } = {}) =>
  post<any>(`/vouchers/my-entries/${id}/retry`, opts.confirmOutcomeUnknown ? { confirmOutcomeUnknown: true } : {});
export const alterStockItem    = (payload: any) => tallyPost<any>('/master/stock-item-alter', payload);
export const getStockGroups    = (companyGuid: string) => get<any>(`/stocks/groups?companyGuid=${companyGuid}`);
export const getStockUnits     = (companyGuid: string) => get<any>(`/stocks/units?companyGuid=${companyGuid}`);

// ── Inventory Settings ─────────────────────────────────────────────────────
export const getInventorySettings  = (companyGuid: string) =>
  get<any>(`/inventory/settings?companyGuid=${companyGuid}`);
export const saveInventorySettings = (companyGuid: string, payload: Record<string, any>) =>
  post<any>(`/inventory/settings?companyGuid=${companyGuid}`, payload);
export const checkHsnCode = (code: string) =>
  get<any>(`/inventory/hsn/check?code=${encodeURIComponent(code || '')}`);
export const getHsnValidation = (companyGuid?: string) =>
  get<any>(withCompany('/stocks/hsn-validation', companyGuid));

// ── Barcode Module ──────────────────────────────────────────────────────────────
export interface BarcodeItem {
  stockGuid:       string;
  displayName:     string;
  name:            string;
  alias:           string | null;
  partNumber:      string | null;
  sku:             string | null;
  barcode:         string | null;
  barcodeId:       number | null;
  barcodeType:     string | null;
  barcodeStatus:   string | null;
  source:          string | null;
  syncTarget:      string;
  tallySyncStatus: string | null;
  groupName:       string | null;
  currentQty:      number;
  unit:            string;
}
export interface BarcodeSettings {
  barcodeStorageMode: string;  // app_only | tally_alias | tally_part_number | tally_udf
  defaultBarcodeType: string;  // CODE128 | EAN13 | EAN8 | UPC | QR | INTERNAL
  autoSyncToTally:    boolean;
}
export interface BarcodeSummary {
  totalItems: number; linked: number; unlinked: number;
  duplicates: number; invalid: number; pendingTallySync: number;
}

export const getBarcodeList = (
  companyGuid: string,
  filters?: { period?: string; group?: string; status?: string; search?: string; page?: number; pageSize?: number }
) => post<any>('/inventory/barcodes', { companyGuid, ...filters });

export const generateBarcode = (
  companyGuid: string, stockGuid: string, barcodeType = 'CODE128', syncTarget = 'app_only'
) => post<any>('/inventory/barcodes/generate', { companyGuid, stockGuid, barcodeType, syncTarget });

export const linkBarcode = (
  companyGuid: string, stockGuid: string, barcode: string,
  barcodeType = 'CODE128', source = 'manual', syncTarget = 'app_only', isPrimary = true
) => post<any>('/inventory/barcodes/link', { companyGuid, stockGuid, barcode, barcodeType, source, syncTarget, isPrimary });

export const lookupBarcode = (
  companyGuid: string, barcode: string
) => post<any>('/inventory/barcodes/lookup', { companyGuid, barcode });

export const bulkImportBarcodes = (
  companyGuid: string, payload: { text?: string; lines?: string[]; fileName?: string }
) => post<any>('/inventory/barcodes/bulk-import', { companyGuid, ...payload });

export const getBarcodeTemplate = () => get<any>('/inventory/barcodes/template');

export const getBarcodeSettings = (companyGuid: string) =>
  get<any>(`/inventory/barcodes/settings?companyGuid=${companyGuid}`);

export const saveBarcodeSettings = (companyGuid: string, payload: BarcodeSettings) =>
  post<any>('/inventory/barcodes/settings', { companyGuid, ...payload });

export const pushPendingBarcodes = (companyGuid: string) =>
  post<any>('/inventory/barcodes/push-pending', { companyGuid });

// Returns raw CSV text (not JSON) — pre-filled with all company stocks
export const downloadBarcodeTemplate = (companyGuid: string): Promise<string> =>
  request<string>(
    'GET',
    `/inventory/barcodes/template?companyGuid=${encodeURIComponent(companyGuid)}`,
    undefined,
    true,
    'api',
    true,
    'text',
  );

export const getBarcodesByGuids = (companyGuid: string, stockGuids: string[]) =>
  post<any>('/inventory/barcodes/by-guids', { companyGuid, stockGuids });

export const generateBulkBarcodes = (
  companyGuid: string,
  options: {
    stockGuids?: string[];
    all?: boolean;
    period?: string;
    group?: string;
    status?: string;
    search?: string;
    barcodeType?: string;
    syncTarget?: string;
  }
) => post<any>('/inventory/barcodes/generate-bulk', { companyGuid, ...options });

export type BulkBarcodeJobStatus = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total: number;
  processed: number;
  generated: number;
  errors: number;
  pct?: number;
  errorMessage?: string | null;
  resumed?: boolean;
};

export const startBulkBarcodeJob = (
  companyGuid: string,
  options: {
    all?: boolean;
    stockGuids?: string[];
    period?: string;
    group?: string;
    status?: string;
    search?: string;
    barcodeType?: string;
    syncTarget?: string;
  }
) => post<{ data: BulkBarcodeJobStatus | { jobId: null; total: 0; status: string; generated: number; errors: number } }>(
  '/inventory/barcodes/generate-bulk/start',
  { companyGuid, ...options },
);

export const getBulkBarcodeJobStatus = (companyGuid: string, jobId: string) =>
  get<{ data: BulkBarcodeJobStatus }>(
    `/inventory/barcodes/generate-bulk/status/${encodeURIComponent(jobId)}?companyGuid=${encodeURIComponent(companyGuid)}`,
  );

export const getActiveBulkBarcodeJob = (companyGuid: string) =>
  get<{ data: BulkBarcodeJobStatus | null }>(
    `/inventory/barcodes/generate-bulk/active?companyGuid=${encodeURIComponent(companyGuid)}`,
  );

// ── Compliance Config ──────────────────────────────────────────────────────────
export const getComplianceConfig  = (guid: string) => get<any>(`/company/${guid}/compliance-config`);
export const saveComplianceConfig = (guid: string, payload: any) => post<any>(`/company/${guid}/compliance-config`, payload);

// ── Invoice Preview & Share PDF (Provisional/Final flow) ─────────────────────
// GET /tally/invoice/:tdkRef/preview — returns VoucherDocument from app_vouchers snapshot
export const getInvoicePreview = (tdkRef: string, companyGuid: string) =>
  request<any>('GET', `/invoice/${encodeURIComponent(tdkRef)}/preview?companyGuid=${companyGuid}`, undefined, true, 'tally');

// POST /tally/invoice/:tdkRef/share-pdf — waits up to maxWaitMs for Tally number, returns snapshot
export const invoiceSharePdf = (
  tdkRef: string,
  companyGuid: string,
  waitForTallyNumber = true,
  maxWaitMs = 10000
) => request<any>('POST', `/invoice/${encodeURIComponent(tdkRef)}/share-pdf`, { companyGuid, waitForTallyNumber, maxWaitMs }, true, 'tally');

// Sales Order Preview — reuses the same /tally/invoice/:tdkRef/preview endpoint
// (backend serves the app_vouchers snapshot for any voucher type keyed by tdkRef).
export const getOrderPreview = (tdkRef: string, companyGuid: string) => getInvoicePreview(tdkRef, companyGuid);

// ── Workspace / RBAS (Mobile) ─────────────────────────────────────────────────
export const listMyWorkspaces = () => get<any>('/me/workspaces');
export const getWorkspaceContext = (workspaceId: string) =>
  get<any>(`/workspaces/${encodeURIComponent(workspaceId)}/context`);
export const renameWorkspace = (workspaceId: string, name: string) =>
  patch<any>(`/workspaces/${encodeURIComponent(workspaceId)}`, { name });
export const listWorkspaceCompanies = (workspaceId: string) =>
  get<any>(`/workspaces/${encodeURIComponent(workspaceId)}/companies`);
export const listWorkspaceCompanyYears = (workspaceId: string, companyGuid: string) =>
  get<any>(
    `/workspaces/${encodeURIComponent(workspaceId)}/company-years?companyGuid=${encodeURIComponent(companyGuid)}`
  );
export const listMyInvitations = () => get<any>('/me/invitations');
export const acceptInvitation = (id: string) => post<any>(`/invitations/${encodeURIComponent(id)}/accept`);
export const declineInvitation = (id: string) => post<any>(`/invitations/${encodeURIComponent(id)}/decline`);
export const getWorkspaceTallyStatus = (workspaceId: string) =>
  get<any>(`/workspaces/${encodeURIComponent(workspaceId)}/tally/status`);
export const pairWorkspaceTally = (workspaceId: string, pairing_code: string) =>
  post<any>(`/workspaces/${encodeURIComponent(workspaceId)}/tally/pair`, { pairing_code });
export const unpairWorkspaceTally = (workspaceId: string) =>
  post<any>(`/workspaces/${encodeURIComponent(workspaceId)}/tally/unpair`);
// Owner billing summary (RBC-09) — read-only on Mobile
export const getSeatPlan = (workspaceId: string) => get<any>(`/workspaces/${encodeURIComponent(workspaceId)}/seat-plan`);
export const getBillingNotices = () => get<any>('/billing/notices');
export const getCreditHistory = (limit = 5) => get<any>(`/billing/history?limit=${limit}`);

export const getWorkspaceApprovals = (workspaceId: string) =>
  get<any>(`/workspaces/${encodeURIComponent(workspaceId)}/approvals`);
export const approveHardSyncRequest = (requestId: string) =>
  post<any>(`/hard-sync-requests/${encodeURIComponent(requestId)}/approve`);
export const rejectHardSyncRequest = (requestId: string) =>
  post<any>(`/hard-sync-requests/${encodeURIComponent(requestId)}/reject`);
/** Workspace Owner only: approve one restore request (by its id) with the chosen backup and companies. */
export const approveRestoreRequest = (requestId: string, body: { backupId: string; companyFolders?: string[] | null }) =>
  post<any>(`/restore-sessions/${encodeURIComponent(requestId)}/approve`, body);
export const rejectRestoreSession = (sessionId: string) =>
  post<any>(`/restore-sessions/${encodeURIComponent(sessionId)}/reject`);
// Integrations are per company since 2026-11-03: every write carries `companyId`.
export interface IntegrationCompanyRow {
  company_id: number | string;
  company_guid?: string;
  name: string;
  gstin?: string | null;
  status: 'NOT_CONFIGURED' | 'CONFIGURED' | 'ACTIVE' | string;
  activated_at?: number | string | null;
  config_json?: { gstin?: string; username?: string; useSandboxLogin?: boolean; provider?: string } | null;
  /** Per secret key (`{ password: true }`): managers learn a secret is saved, never its value. */
  secretsSet?: Record<string, boolean>;
  useSandboxLogin?: boolean;
  /** Generation settings for this domain: source 'tally' | 'auditer', mode NULL until chosen, opt-out, auto_since. */
  compliance?: { source?: 'tally' | 'auditer' | string; mode?: string | null; applicable?: string | null; auto_since?: string | null } | null;
}
export interface WorkspaceIntegrationResponse {
  gateway?: { provider: string; env: string; configured: boolean; sandboxLogin: { gstin: string; username: string } | null } | null;
  rate?: { activation: number; generate: number } | null;
  companies?: IntegrationCompanyRow[];
  /** Legacy workspace-level row (older servers). */
  status?: string;
  config_json?: any;
}
/** GET /workspaces/:id/integrations/:domain → { gateway, rate, companies[] }. */
export const getWorkspaceIntegration = (workspaceId: string, domain: string) =>
  get<any>(`/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(domain)}`);
export const saveWorkspaceIntegration = (workspaceId: string, domain: string, config: { companyId: number | string; gstin?: string; username?: string; password?: string; useSandboxLogin?: boolean; provider?: string }) =>
  post<any>(`/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(domain)}`, config);
export const testWorkspaceIntegration = (workspaceId: string, domain: string, body: { companyId: number | string; gstin?: string; username?: string; password?: string }) =>
  post<any>(`/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(domain)}/test`, body);
/** Charges the one-time activation (100 credits) for that company; idempotent once activated. */
export const activateWorkspaceIntegration = (workspaceId: string, domain: string, companyId: number | string) =>
  post<any>(`/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(domain)}/activate`, { companyId });
/** DELETE ?companyId= — wipes the credentials, keeps the paid activation. */
export const removeWorkspaceIntegration = (workspaceId: string, domain: string, companyId: number | string) =>
  del<any>(`/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(domain)}?companyId=${encodeURIComponent(String(companyId))}`);

