// ============================================================
// TallyDekho API Service — V2
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
} from './apiErrors';
import { toastRbasError } from '../utils/rbasErrors';
import { BACKEND_URL } from '../config/backend';
import { beginSingleFlight } from '../utils/singleFlight';

export {
  ApiError,
  errorMessage,
  isApiError,
  setAuthFailureHandler,
  subscribeDeviceOnline,
  getDeviceOnline,
  type ApiErrorKind,
} from './apiErrors';

const BASE_URL = BACKEND_URL;
const REQUEST_TIMEOUT_MS = 25_000;

/** Active Workspace for X-Workspace-Id — set by WorkspaceContext. */
let _activeWorkspaceId: string | null = null;

export function setActiveWorkspaceId(id: string | null) {
  _activeWorkspaceId = id ? String(id) : null;
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

const storeAccessToken = async (token: string) => {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem('auth_token', token); } catch { /* private mode */ }
  }
  await AsyncStorage.setItem('auth_token', token);
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
 * 'refreshed'   — a new access token is stored, replay the request
 * 'rejected'    — the session is gone (revoked / expired / never had a refresh
 *                 token); the caller must sign out
 * 'unavailable' — the refresh endpoint could not be reached; the session may
 *                 still be valid, so surface the 401 but keep the user signed in
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // Offline / DNS / connection refused — do not destroy a session over a blip.
    return 'unavailable';
  }
  const data = await safeParseJson(res);
  const next = data?.data ?? data;
  if (!res.ok || !next?.access_token) {
    if (res.status >= 500) return 'unavailable';
    await clearRefreshToken();
    return 'rejected';
  }
  // Only the tokens are touched: the active workspace and the selected company
  // are deliberately left alone so a mid-session refresh cannot move the user.
  await storeAccessToken(String(next.access_token));
  if (next.refresh_token) await setRefreshToken(String(next.refresh_token));
  return 'refreshed';
}

/**
 * Renew the access token, at most one request in flight. Without this guard a
 * screen that fires eight parallel calls turns one expiry into eight refreshes,
 * and with rotating refresh tokens all but one of them lose the race and would
 * sign the user out.
 */
export function tryRefreshSession(): Promise<RefreshOutcome> {
  return beginSingleFlight(_refreshSlot, performRefresh);
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
  const message =
    data?.error?.message ||
    data?.message ||
    (typeof data?.error === 'string' ? data.error : null) ||
    null;
  return { message: message || '', code: code ? String(code) : null };
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
): Promise<T> {
  const token = requiresAuth ? await getToken() : null;
  // Fail client-side before hitting backend (avoids "No token provided" spam)
  if (requiresAuth && !token) {
    throw new ApiError('Not authenticated', { status: 401, kind: 'auth', code: 'NO_TOKEN' });
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Workspace is never in JWT — attach header for all authenticated business calls.
  if (requiresAuth && _activeWorkspaceId) {
    headers['X-Workspace-Id'] = _activeWorkspaceId;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
    if (responseType === 'text') {
      if (!res.ok) {
        const data = await safeParseJson(res);
        const { message, code } = extractErrorMeta(data);
        const kind = kindFromStatus(res.status, code);
        const err = new ApiError(message || `HTTP ${res.status}`, { status: res.status, code, kind, raw: data });
        if (res.status === 401) {
          if (requiresAuth && allowRefresh) {
            const outcome = await tryRefreshSession();
            if (outcome === 'refreshed') {
              clearTimeout(timer);
              return await request<T>(method, endpoint, body, requiresAuth, basePrefix, false, responseType);
            }
            if (outcome === 'unavailable') throw err;
          }
          notifyAuthFailure(err);
        } else if (res.status === 403 || res.status === 402 || res.status === 409) {
          toastRbasError(err);
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
      const err = new ApiError(
        message || `HTTP ${res.status}`,
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
            return await request<T>(method, endpoint, body, requiresAuth, basePrefix, false, responseType);
          }
          if (outcome === 'unavailable') throw err;
        }
        notifyAuthFailure(err);
      } else if (res.status === 403 || res.status === 402 || res.status === 409) {
        toastRbasError(err);
      }
      throw err;
    }

    return data as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;

    const aborted =
      e?.name === 'AbortError' ||
      e?.message === 'Aborted' ||
      controller.signal.aborted;
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
    access_token: string;
    refresh_token?: string;
    session_id?: string;
  };
}

export const sendOTP    = (phone: string): Promise<SendOTPResponse> => post<SendOTPResponse>('/auth/send-otp', { phone }, false);
export const verifyOTP  = (phone: string, otp: string, opts?: { reset_pin?: boolean }): Promise<VerifyOTPResponse> =>
  post<VerifyOTPResponse>('/auth/verify-otp', { phone, otp, ...opts }, false);
export const registerUser = (data: Partial<{ name: string; email: string; language: string; phone: string }>): Promise<RegisterResponse> => post<RegisterResponse>('/auth/register', data);
export const getMe       = () => get<any>('/auth/me');
export const updateMe    = (data: Partial<{ name: string; email: string; language: string }>) => patch<any>('/auth/me', data);
export const logout      = (pushToken?: string) => post<any>('/auth/logout', pushToken ? { pushToken } : {});

/**
 * Server logout without the 401 → signOut interceptor (avoids a logout loop).
 * Network failure is returned, never thrown — caller still clears local state.
 */
export async function logoutOnServer(pushToken?: string): Promise<{ ok: boolean; reason?: string }> {
  const token = await getToken();
  if (!token) return { ok: false, reason: 'no-token' };
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (_activeWorkspaceId) headers['X-Workspace-Id'] = _activeWorkspaceId;
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(pushToken ? { pushToken } : {}),
      cache: 'no-store',
    });
    return { ok: res.ok, reason: res.ok ? undefined : `http-${res.status}` };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
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
export const updateCompanyProfile = (companyGuid: string, data: any) => patch<any>(withCompany('/company/profile', companyGuid), data);

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
      };
    });

export const getRecentActivity = (companyGuid?: string) => get<any>(withCompany('/dashboard/recent-activity', companyGuid));
export const searchDashboard   = (q: string, companyGuid?: string) => get<any>(withCompany('/dashboard/search', companyGuid, { q }));

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
export const markNotificationRead   = (id: string) => patch<any>(`/notifications/${id}/read`, {});
export const markAllNotificationsRead = (companyGuid?: string) => patch<any>(withCompany('/notifications/read-all', companyGuid), {});

// ══════════════════════════════════════════════════════════════
// COMPLIANCE ALERTS
// ══════════════════════════════════════════════════════════════

export const getAlerts           = (companyGuid?: string, params?: any) => get<any>(withCompany('/alerts', companyGuid, params));
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
export const getGSTDetail        = (companyGuid?: string, params?: any) => get<any>(withCompany('/reports/gst-detail', companyGuid, params));
export const getGSTSummary       = (companyGuid?: string, params?: any) => get<any>(withCompany('/reports/gst-summary', companyGuid, params));

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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customToken}` },
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

export const setPin      = (pin: string) => post<any>('/auth/set-pin', { pin });
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
export const retryMyEntry = (id: string) => post<any>(`/vouchers/my-entries/${id}/retry`, {});
export const alterStockItem    = (payload: any) => tallyPost<any>('/master/stock-item-alter', payload);
export const getStockGroups    = (companyGuid: string) => get<any>(`/stocks/groups?companyGuid=${companyGuid}`);
export const getStockUnits     = (companyGuid: string) => get<any>(`/stocks/units?companyGuid=${companyGuid}`);

// ── Inventory Settings ─────────────────────────────────────────────────────
export const getInventorySettings  = (companyGuid: string) =>
  get<any>(`/inventory/settings?companyGuid=${companyGuid}`);
export const saveInventorySettings = (companyGuid: string, payload: Record<string, any>) =>
  post<any>(`/inventory/settings?companyGuid=${companyGuid}`, payload);

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
export const getWorkspaceApprovals = (workspaceId: string) =>
  get<any>(`/workspaces/${encodeURIComponent(workspaceId)}/approvals`);
export const approveHardSyncRequest = (requestId: string) =>
  post<any>(`/hard-sync-requests/${encodeURIComponent(requestId)}/approve`);
export const rejectHardSyncRequest = (requestId: string) =>
  post<any>(`/hard-sync-requests/${encodeURIComponent(requestId)}/reject`);
export const approveRestoreSession = (sessionId: string, body: { code: string; backupId: string }) =>
  post<any>(`/restore-sessions/${encodeURIComponent(sessionId)}/approve`, body);
export const approveWorkspaceRestoreByCode = (body: { code: string; backupId: string }) =>
  post<any>('/workspace/restore/approve', body);
export const rejectRestoreSession = (sessionId: string) =>
  post<any>(`/restore-sessions/${encodeURIComponent(sessionId)}/reject`);
export const getWorkspaceIntegration = (workspaceId: string, domain: string) =>
  get<any>(`/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(domain)}`);
export const saveWorkspaceIntegration = (workspaceId: string, domain: string, config: object) =>
  post<any>(`/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(domain)}`, config);
export const activateWorkspaceIntegration = (workspaceId: string, domain: string) =>
  post<any>(`/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(domain)}/activate`);

