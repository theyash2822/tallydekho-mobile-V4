// ============================================================
// TallyDekho API Service — v2
// Base: /api/* (new spec)
// Auth: JWT Bearer token in Authorization header
// Pattern: Try API first → fallback to mock on failure
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MOCK_KPI_STRIP,
  MOCK_METRICS,
  MOCK_CASHFLOW,
  MOCK_RECENT_ACTIVITY,
  MOCK_STOCKS,
  MOCK_LEDGERS,
  MOCK_REPORTS,
  MOCK_NOTIFICATIONS,
} from '../data/mockData';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.246:3001';

// ── Token helpers ────────────────────────────────────────────
const getToken = async (): Promise<string | null> => {
  try { return await AsyncStorage.getItem('auth_token'); } catch { return null; }
};

// ── Core HTTP ────────────────────────────────────────────────
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: object,
  requiresAuth = true
): Promise<T> {
  const token = requiresAuth ? await getToken() : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
  return data;
}

const get = <T>(endpoint: string, auth = true) => request<T>('GET', endpoint, undefined, auth);
const post = <T>(endpoint: string, body: object, auth = true) => request<T>('POST', endpoint, body, auth);
const patch = <T>(endpoint: string, body: object) => request<T>('PATCH', endpoint, body);

// ── Fallback wrapper ─────────────────────────────────────────
async function withFallback<T>(apiCall: () => Promise<T>, fallback: T): Promise<T> {
  try { return await apiCall(); }
  catch (err) {
    console.log('[TallyDekho] API fallback:', (err as Error).message);
    return fallback;
  }
}

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
    is_new_user: boolean;
    access_token: string;
    expires_in: number;
    user: { id: number; name: string | null; phone: string; language: string };
    is_paired: boolean;
    company: { guid: string; name: string; gstin: string | null } | null;
  };
}

export interface RegisterResponse {
  success: boolean;
  data: {
    user: { id: number; name: string; phone: string; email: string; language: string };
    access_token: string;
  };
}

export const sendOTP = (phone: string): Promise<SendOTPResponse> =>
  post<SendOTPResponse>('/auth/send-otp', { phone }, false);

export const verifyOTP = (phone: string, otp: string): Promise<VerifyOTPResponse> =>
  post<VerifyOTPResponse>('/auth/verify-otp', { phone, otp }, false);

export const registerUser = (data: { name: string; email: string; language: string; phone?: string }): Promise<RegisterResponse> =>
  post<RegisterResponse>('/auth/register', data);

export const getMe = () => get<any>('/auth/me');

export const updateMe = (data: Partial<{ name: string; email: string; language: string }>) =>
  patch<any>('/auth/me', data);

export const logout = () => post<any>('/auth/logout', {});

// ══════════════════════════════════════════════════════════════
// TALLY SYNC / PAIRING
// ══════════════════════════════════════════════════════════════

export interface PairResponse {
  success: boolean;
  data: {
    message: string;
    device_id: string;
    is_paired: boolean;
    company: { guid: string; name: string; gstin: string | null } | null;
  };
}

export const pairWithTally = (pairing_code: string): Promise<PairResponse> =>
  post<PairResponse>('/tally-sync/pair', { pairing_code });

export const getTallySyncStatus = () => get<any>('/tally-sync/status');

export const getCompanies = () => get<any>('/companies');

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════

export const getKPIStrip = (period = '7D') =>
  withFallback(() => get(`/dashboard/kpi-strip?period=${period}`), MOCK_KPI_STRIP);

export const getMetrics = (period = '7D') =>
  withFallback(() => get(`/dashboard/metrics?period=${period}`), MOCK_METRICS);

export const getCashflow = (period = '7D') =>
  withFallback(() => get(`/dashboard/cashflow?period=${period}`), MOCK_CASHFLOW);

export const getRecentActivity = () =>
  withFallback(() => get('/dashboard/recent-activity'), MOCK_RECENT_ACTIVITY);

export const searchDashboard = (q: string) =>
  withFallback(() => get(`/dashboard/search?q=${encodeURIComponent(q)}`), []);

// ══════════════════════════════════════════════════════════════
// SALES
// ══════════════════════════════════════════════════════════════

export const getSalesInvoices = (params?: { status?: string; search?: string; page?: number; from?: string; to?: string }) =>
  withFallback(() => get(`/sales/invoices${params ? '?' + new URLSearchParams(params as any).toString() : ''}`), { data: { invoices: [], summary: { total_docs: 0 } } });

export const getSalesOrders = (params?: any) =>
  withFallback(() => get(`/sales/orders${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const getSalesQuotations = (params?: any) =>
  withFallback(() => get(`/sales/quotations${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const getCreditNotes = (params?: any) =>
  withFallback(() => get(`/sales/credit-notes${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const getDeliveryNotes = (params?: any) =>
  withFallback(() => get(`/sales/delivery-notes${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const getEWayBills = (params?: any) =>
  withFallback(() => get(`/sales/ewaybills${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const createSalesInvoice = (payload: any) => post('/sales/invoices', payload);
export const createSalesOrder = (payload: any) => post('/sales/orders', payload);
export const createQuotation = (payload: any) => post('/sales/quotations', payload);
export const createCreditNote = (payload: any) => post('/sales/credit-notes', payload);
export const createDeliveryNote = (payload: any) => post('/sales/delivery-notes', payload);

// ══════════════════════════════════════════════════════════════
// PURCHASE
// ══════════════════════════════════════════════════════════════

export const getPurchaseInvoices = (params?: any) =>
  withFallback(() => get(`/purchase/invoices${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const getPurchaseOrders = (params?: any) =>
  withFallback(() => get(`/purchase/orders${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const getDebitNotes = (params?: any) =>
  withFallback(() => get(`/purchase/debit-notes${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const createPurchaseInvoice = (payload: any) => post('/purchase/invoices', payload);
export const createPurchaseOrder = (payload: any) => post('/purchase/orders', payload);
export const createDebitNote = (payload: any) => post('/purchase/debit-notes', payload);

// ══════════════════════════════════════════════════════════════
// VOUCHERS
// ══════════════════════════════════════════════════════════════

export const getVouchers = (type?: string, params?: any) =>
  withFallback(() => get(`/vouchers${type ? `?type=${type}` : ''}${params ? '&' + new URLSearchParams(params).toString() : ''}`), { data: [] });

export const createPaymentVoucher = (payload: any) => post('/vouchers/payment', payload);
export const createReceiptVoucher = (payload: any) => post('/vouchers/receipt', payload);
export const createJournalVoucher = (payload: any) => post('/vouchers/journal', payload);
export const createContraVoucher = (payload: any) => post('/vouchers/contra', payload);

// ══════════════════════════════════════════════════════════════
// LEDGERS
// ══════════════════════════════════════════════════════════════

export const getLedgers = (params?: { group?: string; nature?: string; search?: string; page?: number }) =>
  withFallback(() => get(`/ledgers${params ? '?' + new URLSearchParams(params as any).toString() : ''}`), { data: MOCK_LEDGERS });

export const getLedgerDetail = (id: string, params?: { from?: string; to?: string }) =>
  withFallback(() => get(`/ledgers/${id}${params ? '?' + new URLSearchParams(params).toString() : ''}`), null);

export const createLedger = (payload: any) => post('/ledgers', payload);

// ══════════════════════════════════════════════════════════════
// STOCKS
// ══════════════════════════════════════════════════════════════

export const getStocks = (params?: any) =>
  withFallback(() => get(`/stocks/items${params ? '?' + new URLSearchParams(params).toString() : ''}`), { data: MOCK_STOCKS });

export const getStockItem = (id: string) =>
  withFallback(() => get(`/stocks/items/${id}`), null);

export const getWarehouses = () =>
  withFallback(() => get('/stocks/warehouses'), { data: [] });

export const createStockItem = (payload: any) => post('/stocks/items', payload);
export const createWarehouse = (payload: any) => post('/stocks/warehouses', payload);
export const createStockAdjustment = (payload: any) => post('/stocks/adjustments', payload);
export const createStockTransfer = (payload: any) => post('/stocks/transfers', payload);

// ══════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════

export const getReports = () =>
  withFallback(() => get('/reports/financial'), { data: MOCK_REPORTS });

export const getFinancialReport = (from?: string, to?: string) =>
  withFallback(() => get(`/reports/financial-report${from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ''}`), null);

export const getFinancialData = () =>
  withFallback(
    () => get<{ months: string[]; revenue: number[]; expenses: number[] }>('/reports/financial'),
    {
      months:   ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
      revenue:  [450000,520000,480000,610000,580000,640000,720000,680000,750000,820000,790000,950000],
      expenses: [380000,420000,410000,490000,460000,510000,580000,545000,600000,660000,630000,720000],
    }
  );

export const getGSTReport = (params?: any) =>
  withFallback(() => get(`/reports/gst${params ? '?' + new URLSearchParams(params).toString() : ''}`), null);

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export const getNotifications = () =>
  withFallback(() => get('/notifications'), { data: MOCK_NOTIFICATIONS });

export const markNotificationRead = (id: string) =>
  patch(`/notifications/${id}/read`, {});

export const markAllNotificationsRead = () =>
  patch('/notifications/read-all', {});
