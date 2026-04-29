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
  requiresAuth = true,
  basePrefix: 'api' | 'tally' = 'api'
): Promise<T> {
  const token = requiresAuth ? await getToken() : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/${basePrefix}${endpoint}`, {
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
const tallyPost = <T>(endpoint: string, body: object) => request<T>('POST', endpoint, body, true, 'tally');

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
    const msg = (err as Error).message || String(err);
    // Log clearly: auth errors are serious, network errors are expected when offline
    if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
      console.warn('[TallyDekho] Auth error (check token):', msg);
    } else if (msg.includes('Network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
      console.log('[TallyDekho] Network fallback (offline?):', msg);
    } else {
      console.warn('[TallyDekho] API fallback:', msg);
    }
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
export const unpairDevice = () => post<any>('/tally-sync/unpair', {});

export const getCompanies = () => get<any>('/companies');
export const getCompanyYears = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/company/years', companyGuid)), { data: [] });

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════

// Core dashboard — no mock fallback: empty means no data, not fake data
export const getKPIStrip = (companyGuid?: string, period = '7D', from?: string, to?: string) =>
  get(withCompany('/dashboard/kpi-strip', companyGuid, { period, ...(from && to ? { from, to } : {}) }));

export const getMetrics = (companyGuid?: string, period = '7D', from?: string, to?: string) =>
  get(withCompany('/dashboard/metrics', companyGuid, { period, ...(from && to ? { from, to } : {}) }));

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
        updatedAt:            d.updated_at            ?? d.updatedAt            ?? 'just now',
        totalIncome:          d.total_income          ?? d.totalIncome,
        totalExpense:         d.total_expense         ?? d.totalExpense,
      };
    });

export const getRecentActivity = (companyGuid?: string) =>
  get(withCompany('/dashboard/recent-activity', companyGuid));

export const searchDashboard = (q: string, companyGuid?: string) =>
  withFallback(() => get(withCompany('/dashboard/search', companyGuid, { q })), []);

// ══════════════════════════════════════════════════════════════
// SALES
// ══════════════════════════════════════════════════════════════

export const getSalesInvoices = (companyGuid?: string, params?: { status?: string; search?: string; page?: string; from?: string; to?: string }) =>
  get(withCompany('/sales/invoices', companyGuid, params as any));

export const getSalesOrders = (companyGuid?: string, params?: any) =>
  get(withCompany('/sales/orders', companyGuid, params));

export const getSalesQuotations = (companyGuid?: string, params?: any) =>
  get(withCompany('/sales/quotations', companyGuid, params));

export const getCreditNotes = (companyGuid?: string, params?: any) =>
  get(withCompany('/sales/credit-notes', companyGuid, params));

export const getDeliveryNotes = (companyGuid?: string, params?: any) =>
  get(withCompany('/sales/delivery-notes', companyGuid, params));

export const getEWayBills = (companyGuid?: string, params?: any) =>
  withFallback(() => get(withCompany('/sales/ewaybills', companyGuid, params)), { data: [], meta: { total: 0 } });

export const createSalesInvoice = (payload: any) => tallyPost('/voucher/sales', payload);
export const createSalesOrder = (payload: any) => tallyPost('/voucher/sales-order', payload);
export const createQuotation = (payload: any) => tallyPost('/voucher/sales-order', payload);
export const createCreditNote = (payload: any) => tallyPost('/voucher/credit-note', payload);
export const createDeliveryNote = (payload: any) => tallyPost('/voucher/delivery-note', payload);

// ══════════════════════════════════════════════════════════════
// PURCHASE
// ══════════════════════════════════════════════════════════════

export const getPurchaseInvoices = (companyGuid?: string, params?: any) =>
  get(withCompany('/purchase/invoices', companyGuid, params));

export const getPurchaseOrders = (companyGuid?: string, params?: any) =>
  get(withCompany('/purchase/orders', companyGuid, params));

export const getDebitNotes = (companyGuid?: string, params?: any) =>
  get(withCompany('/purchase/debit-notes', companyGuid, params));

export const createPurchaseInvoice = (payload: any) => tallyPost('/voucher/purchase', payload);
export const createPurchaseOrder = (payload: any) => tallyPost('/voucher/purchase-order', payload);
export const createDebitNote = (payload: any) => tallyPost('/voucher/debit-note', payload);

// ══════════════════════════════════════════════════════════════
// VOUCHERS
// ══════════════════════════════════════════════════════════════

export const getVouchers = (companyGuid?: string, type?: string, params?: any) =>
  get(withCompany('/vouchers', companyGuid, { ...(type ? { type } : {}), ...params }));

export const createPaymentVoucher = (payload: any) => tallyPost('/voucher/payment', payload);
export const createReceiptVoucher = (payload: any) => tallyPost('/voucher/receipt', payload);
export const createJournalVoucher = (payload: any) => tallyPost('/voucher/journal', payload);
export const createContraVoucher = (payload: any) => tallyPost('/voucher/contra', payload);

// ══════════════════════════════════════════════════════════════
// LEDGERS
// ══════════════════════════════════════════════════════════════

export const getLedgers = (companyGuid?: string, params?: { group?: string; nature?: string; search?: string; page?: string }) =>
  get(withCompany('/ledgers', companyGuid, params as any));

export const getLedgerDetail = (companyGuid?: string, id?: string, params?: { from?: string; to?: string }) =>
  withFallback(() => get(withCompany(`/ledgers/${id}`, companyGuid, params)), null);

export const createLedger = (payload: any) => tallyPost('/master/party', payload);

// ══════════════════════════════════════════════════════════════
// STOCKS
// ══════════════════════════════════════════════════════════════

export const getStocks = (companyGuid?: string, params?: any) =>
  get(withCompany('/stocks/items', companyGuid, params));

export const getStockItem = (companyGuid?: string, id?: string) =>
  withFallback(() => get(withCompany(`/stocks/items/${id}`, companyGuid)), null);

export const getWarehouses = (companyGuid?: string) =>
  get(withCompany('/stocks/warehouses', companyGuid));

export const getParties = (companyGuid?: string, params?: { search?: string; type?: string }) =>
  withFallback(() => get(withCompany('/parties', companyGuid, params)), { data: [] });

export const createStockItem = (payload: any) => tallyPost('/master/stock-item', payload);
export const createWarehouse = (payload: any) => tallyPost('/master/warehouse', payload);
export const createStockAdjustment = (payload: any) => tallyPost('/voucher/stock-adjustment', payload);
export const createStockTransfer = (payload: any) => tallyPost('/voucher/stock-transfer', payload);
export const cancelVoucher = (payload: any) => tallyPost('/voucher/cancel', payload);
export const createParty = (payload: any) => tallyPost('/master/party', payload);

// ══════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════

export const getReports = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/reports/financial', companyGuid)), { data: MOCK_REPORTS });

export const getFinancialData = (companyGuid?: string, from?: string, to?: string) =>
  get<any>(withCompany('/reports/financial', companyGuid, from && to ? { from, to } : {}));

export const getFinancialReport = (companyGuid?: string, from?: string, to?: string) =>
  withFallback(() => get(withCompany('/reports/financial-report', companyGuid, from && to ? { from, to } : {})), null);

// Full P&L + Balance Sheet + Trial Balance from ledger closing balances
export const getFullFinancialReport = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/reports/pl-bs', companyGuid)), null);

// Compliance alerts — IRN pending, EWB pending, unmatched GST, etc.
export const getAlerts = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/alerts', companyGuid)), { data: { pendingIRNCount: 0, pendingEWBCount: 0, unmatchedGSTCount: 0, totalAlerts: 0 } });

export const getGSTReport = (companyGuid?: string, from?: string, to?: string) =>
  get(withCompany('/reports/gst', companyGuid, from && to ? { from, to } : {}));

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export const getNotifications = (companyGuid?: string) =>
  get(withCompany('/notifications', companyGuid));

export const markNotificationRead = (id: string) =>
  patch(`/notifications/${id}/read`, {});

export const markAllNotificationsRead = () =>
  patch('/notifications/read-all', {});

// ══════════════════════════════════════════════════════════════
// KPI DETAIL VIEWS
// ══════════════════════════════════════════════════════════════

// Balance-based KPIs (ledger closing balance — no date filter needed)
export const getKPICashInHand = (companyGuid?: string) =>
  get(withCompany('/kpi/cash-in-hand', companyGuid));
export const getKPIBankBalance = (companyGuid?: string) =>
  get(withCompany('/kpi/bank-balance', companyGuid));
export const getKPIReceivables = (companyGuid?: string) =>
  get(withCompany('/kpi/receivables', companyGuid));
export const getKPIPayables = (companyGuid?: string) =>
  get(withCompany('/kpi/payables', companyGuid));
export const getKPILoansODs = (companyGuid?: string) =>
  get(withCompany('/kpi/loans-ods', companyGuid));
// Voucher-based KPIs (accept optional date range for FY scoping)
export const getKPIPayments = (companyGuid?: string, params?: { from?: string; to?: string }) =>
  get(withCompany('/kpi/payments', companyGuid, params));
export const getKPIReceipts = (companyGuid?: string, params?: { from?: string; to?: string }) =>
  get(withCompany('/kpi/receipts', companyGuid, params));

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

export const getExpenses = (companyGuid?: string, params?: { from?: string; to?: string; [key: string]: any }) =>
  get(withCompany('/expenses', companyGuid, params));
export const getDaybook = (companyGuid?: string, date?: string) =>
  withFallback(() => get(withCompany('/daybook', companyGuid, date ? { date } : {})), { data: [], meta: { total: 0 } });

// ══════════════════════════════════════════════════════════════
// COUNTRY CAPABILITIES
// ══════════════════════════════════════════════════════════════

export const getCompanyCapabilities = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/company/capabilities', companyGuid)), {
    data: { country: 'IN', features: { gst: true, einvoice: true, ewaybill: true, tds: true, multi_currency: false, tally_sync: true } }
  });

// ══════════════════════════════════════════════════════════════
// AUDIT TRAIL + SEARCH
// ══════════════════════════════════════════════════════════════

export const getAuditTrail = (companyGuid?: string) =>
  withFallback(() => get(withCompany('/audit-trail', companyGuid)), { data: [] });

export const retryAuditEntry = (id: string) =>
  withFallback(() => post(`/audit-trail/${id}/retry`, {}), {});

// searchDashboard already declared above

// ══════════════════════════════════════════════════════════════
// AI INSIGHTS
// ══════════════════════════════════════════════════════════════
export const getAIInsights = (companyGuid?: string, from?: string, to?: string) =>
  withFallback(
    () => get(withCompany('/ai/insights', companyGuid, from && to ? { from, to } : {})),
    { data: { insights: [], summary: 'Connect to Tally to get AI insights.' } }
  );
