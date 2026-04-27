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

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.241:3001';

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

// Helper: append companyGuid to query string
const withCompany = (endpoint: string, companyGuid?: string, extra?: Record<string, string>) => {
  const params = new URLSearchParams();
  if (companyGuid) params.set('companyGuid', companyGuid);
  if (extra) Object.entries(extra).forEach(([k, v]) => v && params.set(k, v));
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
};

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

export const getKPIStrip = (companyGuid?: string, period = '7D') =>
  withFallback(() => get(withCompany('/dashboard/kpi-strip', companyGuid, { period })), MOCK_KPI_STRIP);

export const getMetrics = (companyGuid?: string, period = '7D') =>
  withFallback(() => get(withCompany('/dashboard/metrics', companyGuid, { period })), MOCK_METRICS);

export const getCashflow = (companyGuid?: string, period = '7D') =>
  withFallback(() => get(withCompany('/dashboard/cashflow', companyGuid, { period })), MOCK_CASHFLOW);

export const getRecentActivity = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/dashboard/recent-activity', companyGuid)), MOCK_RECENT_ACTIVITY);

export const searchDashboard = (q: string, companyGuid?: string) =>
  withFallback(() => get(withCompany('/dashboard/search', companyGuid, { q })), []);

// ══════════════════════════════════════════════════════════════
// SALES
// ══════════════════════════════════════════════════════════════

export const getSalesInvoices = (companyGuid?: string, params?: { status?: string; search?: string; page?: string; from?: string; to?: string }) =>
  withFallback(() => get(withCompany('/sales/invoices', companyGuid, params as any)), { data: [], meta: { total: 0 } });

export const getSalesOrders = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/sales/orders', companyGuid, params)), { data: [], meta: { total: 0 } });

export const getSalesQuotations = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/sales/quotations', companyGuid, params)), { data: [], meta: { total: 0 } });

export const getCreditNotes = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/sales/credit-notes', companyGuid, params)), { data: [], meta: { total: 0 } });

export const getDeliveryNotes = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/sales/delivery-notes', companyGuid, params)), { data: [], meta: { total: 0 } });

export const getEWayBills = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/sales/ewaybills', companyGuid, params)), { data: [], meta: { total: 0 } });

export const createSalesInvoice = (payload: any) => post('/sales/invoices', payload);
export const createSalesOrder = (payload: any) => post('/sales/orders', payload);
export const createQuotation = (payload: any) => post('/sales/quotations', payload);
export const createCreditNote = (payload: any) => post('/sales/credit-notes', payload);
export const createDeliveryNote = (payload: any) => post('/sales/delivery-notes', payload);

// ══════════════════════════════════════════════════════════════
// PURCHASE
// ══════════════════════════════════════════════════════════════

export const getPurchaseInvoices = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/purchase/invoices', companyGuid, params)), { data: [], meta: { total: 0 } });

export const getPurchaseOrders = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/purchase/orders', companyGuid, params)), { data: [], meta: { total: 0 } });

export const getDebitNotes = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/purchase/debit-notes', companyGuid, params)), { data: [], meta: { total: 0 } });

export const createPurchaseInvoice = (payload: any) => post('/purchase/invoices', payload);
export const createPurchaseOrder = (payload: any) => post('/purchase/orders', payload);
export const createDebitNote = (payload: any) => post('/purchase/debit-notes', payload);

// ══════════════════════════════════════════════════════════════
// VOUCHERS
// ══════════════════════════════════════════════════════════════

export const getVouchers = (companyGuid?: string, type?: string, params?: any) =>
  withFallback(() => get(withCompany('/vouchers', companyGuid, { ...(type ? { type } : {}), ...params })), { data: [], meta: { total: 0 } });

export const createPaymentVoucher = (payload: any) => post('/vouchers/payment', payload);
export const createReceiptVoucher = (payload: any) => post('/vouchers/receipt', payload);
export const createJournalVoucher = (payload: any) => post('/vouchers/journal', payload);
export const createContraVoucher = (payload: any) => post('/vouchers/contra', payload);

// ══════════════════════════════════════════════════════════════
// LEDGERS
// ══════════════════════════════════════════════════════════════

export const getLedgers = (companyGuid?: string, params?: { group?: string; nature?: string; search?: string; page?: string }) =>
  withFallback(() => get(withCompany('/ledgers', companyGuid, params as any)), { data: MOCK_LEDGERS, meta: { total: 0 } });

export const getLedgerDetail = (companyGuid?: string, id?: string, params?: { from?: string; to?: string }) =>
  withFallback(() => get(withCompany(`/ledgers/${id}`, companyGuid, params)), null);

export const createLedger = (payload: any) => post('/ledgers', payload);

// ══════════════════════════════════════════════════════════════
// STOCKS
// ══════════════════════════════════════════════════════════════

export const getStocks = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/stocks/items', companyGuid, params)), { data: { summary: {}, items: MOCK_STOCKS } });

export const getStockItem = (companyGuid?: string, id?: string) =>
  withFallback(() => get(withCompany(`/stocks/items/${id}`, companyGuid)), null);

export const getWarehouses = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/stocks/warehouses', companyGuid)), { data: [] });

export const getParties = (companyGuid?: string, params?: { search?: string; type?: string }) =>
  withFallback(() => get(withCompany('/parties', companyGuid, params)), { data: [] });

export const createStockItem = (payload: any) => post('/stocks/items', payload);
export const createWarehouse = (payload: any) => post('/stocks/warehouses', payload);
export const createStockAdjustment = (payload: any) => post('/stocks/adjustments', payload);
export const createStockTransfer = (payload: any) => post('/stocks/transfers', payload);

// ══════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════

export const getReports = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/reports/financial', companyGuid)), { data: MOCK_REPORTS });

export const getFinancialData = (companyGuid?: string) =>
  withFallback(
    () => get<any>(withCompany('/reports/financial', companyGuid)),
    {
      data: {
        months:   ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
        revenue:  [450000,520000,480000,610000,580000,640000,720000,680000,750000,820000,790000,950000],
        expenses: [380000,420000,410000,490000,460000,510000,580000,545000,600000,660000,630000,720000],
      }
    }
  );

export const getFinancialReport = (companyGuid?: string, from?: string, to?: string) =>
  withFallback(() => get(withCompany('/reports/financial-report', companyGuid, from && to ? { from, to } : {})), null);

export const getGSTReport = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/reports/gst', companyGuid)), null);

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export const getNotifications = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/notifications', companyGuid)), { data: MOCK_NOTIFICATIONS });

export const markNotificationRead = (id: string) =>
  patch(`/notifications/${id}/read`, {});

export const markAllNotificationsRead = () =>
  patch('/notifications/read-all', {});

// ══════════════════════════════════════════════════════════════
// KPI DETAIL VIEWS
// ══════════════════════════════════════════════════════════════

export const getKPICashInHand = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/kpi/cash-in-hand', companyGuid)), null);
export const getKPIBankBalance = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/kpi/bank-balance', companyGuid)), null);
export const getKPIReceivables = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/kpi/receivables', companyGuid)), null);
export const getKPIPayables = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/kpi/payables', companyGuid)), null);
export const getKPIPayments = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/kpi/payments', companyGuid)), null);
export const getKPIReceipts = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/kpi/receipts', companyGuid)), null);
export const getKPILoansODs = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/kpi/loans-ods', companyGuid)), null);

// ══════════════════════════════════════════════════════════════
// E-WAY BILLS + E-INVOICE (country-aware)
// ══════════════════════════════════════════════════════════════

export const getEWBList = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/ewaybills', companyGuid, params)), { data: [], meta: { country_applicable: false } });
export const getEInvoicePending = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/einvoice/pending', companyGuid)), { data: [], meta: { country_applicable: false } });
export const getEInvoiceGenerated = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/einvoice/generated', companyGuid)), { data: [], meta: {} });
export const getGSTDetail = (companyGuid?: string, params?: { type?: string; from?: string; to?: string }) =>
  withFallback(() => get(withCompany('/reports/gst-detail', companyGuid, params as any)), { data: [], meta: { country_applicable: false } });

// ══════════════════════════════════════════════════════════════
// EXPENSES + DAYBOOK
// ══════════════════════════════════════════════════════════════

export const getExpenses = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/expenses', companyGuid, params)), { data: [], summary: { total: 0 } });
export const getDaybook = (companyGuid?: string, date?: string) =>
  withFallback(() => get(withCompany('/daybook', companyGuid, date ? { date } : {})), { data: [], meta: { total: 0 } });

// ══════════════════════════════════════════════════════════════
// COUNTRY CAPABILITIES
// ══════════════════════════════════════════════════════════════

export const getCompanyCapabilities = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/company/capabilities', companyGuid)), {
    data: { country: 'IN', features: { gst: true, einvoice: true, ewaybill: true, tds: true, multi_currency: false, tally_sync: true } }
  });
