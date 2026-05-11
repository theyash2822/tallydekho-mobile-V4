// ============================================================
// TallyDekho API Service — V2
// Base: /api/* (new spec)
// Auth: JWT Bearer token in Authorization header
// STRICT RULE: No mock/fallback data. Throw errors — callers handle empty/error states.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

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

const get      = <T>(endpoint: string, auth = true) => request<T>('GET', endpoint, undefined, auth);
const tallyGet = <T>(endpoint: string, auth = true) => request<T>('GET', endpoint, undefined, auth, 'tally');
const post = <T>(endpoint: string, body: object, auth = true) => request<T>('POST', endpoint, body, auth);
const patch = <T>(endpoint: string, body: object) => request<T>('PATCH', endpoint, body);
const del   = <T>(endpoint: string, body?: object) => request<T>('DELETE', endpoint, body);
const tallyPost = <T>(endpoint: string, body: object) => request<T>('POST', endpoint, body, true, 'tally');

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
    expires_in?: number;
    user?: { id: number; name: string | null; phone: string; language: string };
    is_paired?: boolean;
    company?: { guid: string; name: string; gstin: string | null } | null;
  };
}

export interface RegisterResponse {
  success: boolean;
  data: {
    user: { id: number; name: string; phone: string; email: string; language: string };
    access_token: string;
  };
}

export const sendOTP    = (phone: string): Promise<SendOTPResponse> => post<SendOTPResponse>('/auth/send-otp', { phone }, false);
export const verifyOTP  = (phone: string, otp: string, opts?: { reset_pin?: boolean }): Promise<VerifyOTPResponse> =>
  post<VerifyOTPResponse>('/auth/verify-otp', { phone, otp, ...opts }, false);
export const registerUser = (data: Partial<{ name: string; email: string; language: string; phone: string }>): Promise<RegisterResponse> => post<RegisterResponse>('/auth/register', data);
export const getMe       = () => get<any>('/auth/me');
export const updateMe    = (data: Partial<{ name: string; email: string; language: string }>) => patch<any>('/auth/me', data);
export const logout      = (pushToken?: string) => post<any>('/auth/logout', pushToken ? { pushToken } : {});
export const registerPushToken = (token: string, platform: string, deviceId?: string) =>
  post<any>('/push-token', { token, platform, deviceId });
export const removePushToken = (token?: string) =>
  del<any>('/push-token', token ? { token } : {});

// ══════════════════════════════════════════════════════════════
// TALLY SYNC / PAIRING
// ══════════════════════════════════════════════════════════════

export const pairWithTally    = (pairing_code: string) => post<any>('/tally-sync/pair', { pairing_code });
export const getTallySyncStatus = () => get<any>('/tally-sync/status');
export const unpairDevice     = () => post<any>('/tally-sync/unpair', {});
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
      };
    });

export const getRecentActivity = (companyGuid?: string) => get<any>(withCompany('/dashboard/recent-activity', companyGuid));
export const searchDashboard   = (q: string, companyGuid?: string) => get<any>(withCompany('/dashboard/search', companyGuid, { q }));

// ══════════════════════════════════════════════════════════════
// SALES
// ══════════════════════════════════════════════════════════════

export const getSalesInvoices  = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/invoices', companyGuid, params));
export const getSalesOrders    = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/orders', companyGuid, params));
export const getSalesQuotations = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/quotations', companyGuid, params));
export const getCreditNotes    = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/credit-notes', companyGuid, params));
export const getDeliveryNotes  = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/delivery-notes', companyGuid, params));
export const getEWayBills      = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/ewaybills', companyGuid, params));
export const createSalesInvoice  = (payload: any) => tallyPost<any>('/voucher/sales', payload);
export const createSalesOrder    = (payload: any) => tallyPost<any>('/voucher/sales-order', payload);
export const createQuotation     = (payload: any) => tallyPost<any>('/voucher/sales-order', payload);
export const createCreditNote    = (payload: any) => tallyPost<any>('/voucher/credit-note', payload);
export const createDeliveryNote  = (payload: any) => tallyPost<any>('/voucher/delivery-note', payload);

// ══════════════════════════════════════════════════════════════
// PURCHASE
// ══════════════════════════════════════════════════════════════

export const getPurchaseInvoices = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/invoices', companyGuid, params));
export const getPurchaseOrders   = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/orders', companyGuid, params));
export const getDebitNotes       = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/debit-notes', companyGuid, params));
export const createPurchaseInvoice = (payload: any) => tallyPost<any>('/voucher/purchase', payload);
export const createPurchaseOrder   = (payload: any) => tallyPost<any>('/voucher/purchase-order', payload);
export const createDebitNote       = (payload: any) => tallyPost<any>('/voucher/debit-note', payload);

// ══════════════════════════════════════════════════════════════
// VOUCHERS
// ══════════════════════════════════════════════════════════════

export const getVouchers       = (companyGuid?: string, type?: string, params?: any) => get<any>(withCompany('/vouchers', companyGuid, { ...(type ? { type } : {}), ...params }));
export const getVoucherById    = (companyGuid?: string, guid?: string) => get<any>(withCompany(`/vouchers/${guid}`, companyGuid));
export const createPaymentVoucher = (payload: any) => tallyPost<any>('/voucher/payment', payload);
export const createReceiptVoucher = (payload: any) => tallyPost<any>('/voucher/receipt', payload);
export const createJournalVoucher = (payload: any) => tallyPost<any>('/voucher/journal', payload);
export const createContraVoucher  = (payload: any) => tallyPost<any>('/voucher/contra', payload);

// ══════════════════════════════════════════════════════════════
// LEDGERS
// ══════════════════════════════════════════════════════════════

// Ledger endpoints accept optional fy= param for FY-specific balances
export const getLedgers        = (companyGuid?: string, params?: any) => get<any>(withCompany('/ledgers', companyGuid, params));
export const getBankLedgers    = (companyGuid?: string) => get<any>(withCompany('/bank-ledgers', companyGuid));
export const getLedgerFyBalances = (companyGuid?: string, fy?: string) => get<any>(withCompany('/ledgers/fy-balances', companyGuid, fy ? { fy } : {}));
export const getLedgerDetail   = (companyGuid?: string, id?: string, params?: any) => get<any>(withCompany(`/ledgers/${id}`, companyGuid, params));
export const getLedgerStatement = (companyGuid?: string, id?: string, fy?: string, params?: any) => get<any>(withCompany(`/ledgers/${id}/statement`, companyGuid, { ...(fy ? { fy } : {}), ...params }));
export const createLedger      = (payload: any) => tallyPost<any>('/master/party', payload);

// ══════════════════════════════════════════════════════════════
// STOCKS
// ══════════════════════════════════════════════════════════════

export const getStocks       = (companyGuid?: string, params?: any) => get<any>(withCompany('/stocks/items', companyGuid, params));
export const getStockItem    = (companyGuid?: string, id?: string) => get<any>(withCompany(`/stocks/items/${id}`, companyGuid));
export const getWarehouses       = (companyGuid?: string) => get<any>(withCompany('/stocks/warehouses', companyGuid));
export const getWarehouseDetail  = (companyGuid?: string, id?: string) => get<any>(withCompany(`/stocks/warehouses/${id}`, companyGuid));
export const getParties      = (companyGuid?: string, params?: any) => get<any>(withCompany('/parties', companyGuid, params));
export const createStockItem       = (payload: any) => tallyPost<any>('/master/stock-item', payload);
export const createWarehouse       = (payload: any) => tallyPost<any>('/master/warehouse', payload);
export const createStockAdjustment = (payload: any) => tallyPost<any>('/voucher/stock-adjustment', payload);
export const createStockTransfer   = (payload: any) => tallyPost<any>('/voucher/stock-transfer', payload);
export const cancelVoucher         = (payload: any) => tallyPost<any>('/voucher/cancel', payload);
export const createParty           = (payload: any) => tallyPost<any>('/master/party', payload);

// ══════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════

export const getReports          = (companyGuid?: string) => get<any>(withCompany('/reports/financial', companyGuid));
export const getFinancialData    = (companyGuid?: string, from?: string, to?: string) => get<any>(withCompany('/reports/financial', companyGuid, from && to ? { from, to } : {}));
export const getFinancialReport  = (companyGuid?: string, from?: string, to?: string) => get<any>(withCompany('/reports/financial-report', companyGuid, from && to ? { from, to } : {}));
export const getFullFinancialReport = (companyGuid?: string, fy?: string) => get<any>(withCompany('/reports/pl-bs', companyGuid, fy ? { fy } : undefined));
export const getGSTReport        = (companyGuid?: string, from?: string, to?: string) => get<any>(withCompany('/reports/gst', companyGuid, from && to ? { from, to } : {}));

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export const getNotifications       = (companyGuid?: string) => get<any>(withCompany('/notifications', companyGuid));
export const markNotificationRead   = (id: string) => patch<any>(`/notifications/${id}/read`, {});
export const markAllNotificationsRead = () => patch<any>('/notifications/read-all', {});

// ══════════════════════════════════════════════════════════════
// COMPLIANCE ALERTS
// ══════════════════════════════════════════════════════════════

export const getAlerts           = (companyGuid?: string) => get<any>(withCompany('/alerts', companyGuid));
export const getEWBList          = (companyGuid?: string, params?: any) => get<any>(withCompany('/ewaybills', companyGuid, params));
export const askHelpAI = (message: string, history?: any[]) => post<any>('/ai/help', { message, history });
export const sendPaymentReminder = (companyGuid: string, data: any) => post<any>('/reminders/send', { companyGuid, ...data });

export const getUnmatchedInvoices = (companyGuid?: string, params?: any) => get<any>(withCompany('/reports/unmatched', companyGuid, params));
export const getEInvoicePending  = (companyGuid?: string) => get<any>(withCompany('/einvoice/pending', companyGuid));
export const getEInvoiceGenerated = (companyGuid?: string) => get<any>(withCompany('/einvoice/generated', companyGuid));
export const getGSTDetail        = (companyGuid?: string, params?: any) => get<any>(withCompany('/reports/gst-detail', companyGuid, params));

// ══════════════════════════════════════════════════════════════
// KPI DETAIL VIEWS
// ══════════════════════════════════════════════════════════════

export const getKPICashInHand = (companyGuid?: string) => get<any>(withCompany('/kpi/cash-in-hand', companyGuid));
export const getKPIBankBalance = (companyGuid?: string) => get<any>(withCompany('/kpi/bank-balance', companyGuid));
export const getKPIReceivables = (companyGuid?: string) => get<any>(withCompany('/kpi/receivables', companyGuid));
export const getKPIPayables    = (companyGuid?: string) => get<any>(withCompany('/kpi/payables', companyGuid));
export const getKPILoansODs    = (companyGuid?: string) => get<any>(withCompany('/kpi/loans-ods', companyGuid));
export const getKPIPayments    = (companyGuid?: string, params?: any) => get<any>(withCompany('/kpi/payments', companyGuid, params));
export const getKPIReceipts    = (companyGuid?: string, params?: any) => get<any>(withCompany('/kpi/receipts', companyGuid, params));

// ══════════════════════════════════════════════════════════════
// EXPENSES + DAYBOOK
// ══════════════════════════════════════════════════════════════

export const getExpenses = (companyGuid?: string, params?: any) => get<any>(withCompany('/expenses', companyGuid, params));
export const getDaybook  = (companyGuid?: string, date?: string) => get<any>(withCompany('/daybook', companyGuid, date ? { date } : {}));

// ══════════════════════════════════════════════════════════════
// COMPANY CAPABILITIES
// ══════════════════════════════════════════════════════════════

export const getCompanyCapabilities = (companyGuid?: string) => get<any>(withCompany('/company/capabilities', companyGuid));

// ══════════════════════════════════════════════════════════════
// AUDIT TRAIL
// ══════════════════════════════════════════════════════════════

export const getAuditTrail    = (companyGuid?: string) => tallyGet<any>(withCompany('/audit-trail', companyGuid));
export const retryAuditEntry  = (id: string) => tallyPost<any>(`/audit-trail/${id}/retry`, {});
export const getMyEntries     = (companyGuid?: string, params?: any) => get<any>(withCompany('/vouchers/my-entries', companyGuid, params));

// ══════════════════════════════════════════════════════════════
// AI INSIGHTS
// ══════════════════════════════════════════════════════════════

export const getAIInsights = (companyGuid?: string, from?: string, to?: string) =>
  get<any>(withCompany('/ai/insights', companyGuid, from && to ? { from, to } : {}));

// ════════════════════════════════════════════════════════════
// USER SETTINGS
// ════════════════════════════════════════════════════════════

export const getUserSettings    = () => get<any>('/auth/user-settings');
export const updateUserSettings = (data: any) => patch<any>('/auth/user-settings', data);

// ── 2FA / Passkey ─────────────────────────────────────────────────────────────
// Helper: POST with a custom bearer token (for pre_auth_token flows)
async function postWithToken<T>(endpoint: string, body: object, customToken: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

// ── Phone / Email Change ────────────────────────────────────────────────
export const changePhone = (body: { step: number; currentPhone?: string; otp?: string; newPhone?: string }) =>
  post<any>('/auth/change-phone', body);
export const changeEmail = (body: { step: number; currentEmail?: string; otp?: string; newEmail?: string }) =>
  post<any>('/auth/change-email', body);

// ── Bank Feeds ─────────────────────────────────────────────────────────
export const createBankLedger = (payload: {
  companyGuid: string;
  bankName: string;
  accountNumber?: string;
  ifsc?: string;
  accountType?: string;
  openingBalance?: number;
}) => request<any>('POST', '/master/bank', payload, true, 'tally');

export const verifyPin   = (pin: string, preAuthToken: string) =>
  postWithToken<any>('/auth/verify-pin', { pin }, preAuthToken);

export const setPin      = (pin: string) => post<any>('/auth/set-pin', { pin });
export const resetPin    = (pin: string, preAuthToken: string) =>
  postWithToken<any>('/auth/reset-pin', { pin }, preAuthToken);
export const removePin   = (pin: string) => request<any>('DELETE', '/auth/remove-pin', { pin });
export const setBiometric = (enabled: boolean) => patch<any>('/auth/set-biometric', { enabled });
export const get2FAStatus = () => get<any>('/auth/two-fa-status');
