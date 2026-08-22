// ============================================================
// TallyDekho API Service — V2
// Base: /api/* (new spec)
// Auth: JWT Bearer token in Authorization header
// STRICT RULE: No mock/fallback data. Throw errors — callers handle empty/error states.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.240:3001';

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
  basePrefix: 'api' | 'tally' | 'app' = 'api'
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
const appPost   = <T>(endpoint: string, body: object) => request<T>('POST', endpoint, body, true, 'app');

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
export const getSalesInvoiceCreditNoteContext = (invoiceId: string, companyGuid: string) =>
  get<any>(withCompany(`/sales/invoices/${encodeURIComponent(invoiceId)}/credit-note-context`, companyGuid));
export const getSalesOrders    = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/orders', companyGuid, params));
export const getCreditNotes    = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/credit-notes', companyGuid, params));
export const getDeliveryNotes  = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/delivery-notes', companyGuid, params));
export const getEWayBills      = (companyGuid?: string, params?: any) => get<any>(withCompany('/sales/ewaybills', companyGuid, params));
export const createSalesInvoice  = (payload: any) => tallyPost<any>('/voucher/sales', payload);
export const createProformaInvoice = (payload: any) => tallyPost<any>('/voucher/proforma', payload);
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

export const createSalesOrder    = (payload: any) => tallyPost<any>('/voucher/sales-order', payload);
export const createCreditNote    = (payload: any) => tallyPost<any>('/voucher/credit-note', payload);
export const createDeliveryNote  = (payload: any) => tallyPost<any>('/voucher/delivery-note', payload);

// ══════════════════════════════════════════════════════════════
// PURCHASE
// ══════════════════════════════════════════════════════════════

export const getPurchaseInvoices = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/invoices', companyGuid, params));
export const getPurchaseInvoiceDebitNoteContext = (invoiceId: string, companyGuid: string) =>
  get<any>(withCompany(`/purchase/invoices/${encodeURIComponent(invoiceId)}/debit-note-context`, companyGuid));
export const getPurchaseOrders   = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/orders', companyGuid, params));
export const getDebitNotes       = (companyGuid?: string, params?: any) => get<any>(withCompany('/purchase/debit-notes', companyGuid, params));
export const getPurchaseLedgerAccounts = (companyGuid?: string) =>
  get<any>(withCompany('/purchase/ledger-accounts', companyGuid));
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
export const createJournalVoucher = (payload: any) => tallyPost<any>('/voucher/journal', payload);
export const createContraVoucher  = (payload: any) => tallyPost<any>('/voucher/contra', payload);

// ══════════════════════════════════════════════════════════════
// LEDGERS
// ══════════════════════════════════════════════════════════════

// Ledger endpoints accept optional fy= param for FY-specific balances
export const getLedgers        = (companyGuid?: string, params?: any) => get<any>(withCompany('/ledgers', companyGuid, params));
export const getBankLedgers    = (companyGuid?: string, type: 'bank' | 'cash' | 'all' = 'all') => get<any>(withCompany('/bank-ledgers', companyGuid, { type }));
export const getLedgerFyBalances = (companyGuid?: string, fy?: string) => get<any>(withCompany('/ledgers/fy-balances', companyGuid, fy ? { fy } : {}));
export const getLedgerDetail   = (companyGuid?: string, id?: string, params?: any) => get<any>(withCompany(`/ledgers/${id}`, companyGuid, params));
export const getLedgerStatement = (companyGuid?: string, id?: string, fy?: string, params?: any) => get<any>(withCompany(`/ledgers/${id}/statement`, companyGuid, { ...(fy ? { fy } : {}), ...params }));
export const createLedger      = (payload: any) => tallyPost<any>('/master/party', payload);

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
export const getStockDashboard  = (companyGuid: string) => appPost<any>('/stock-dashboard', { companyGuid });
export const getStockItem    = (companyGuid?: string, id?: string, params?: any) => get<any>(withCompany(`/stocks/items/${id}`, companyGuid, params));
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
export const downloadBarcodeTemplate = async (companyGuid: string): Promise<string> => {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/api/inventory/barcodes/template?companyGuid=${companyGuid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Template fetch failed: ${res.status}`);
  return res.text();
};

export const getBarcodesByGuids = (companyGuid: string, stockGuids: string[]) =>
  post<any>('/inventory/barcodes/by-guids', { companyGuid, stockGuids });

export const generateBulkBarcodes = (
  companyGuid: string,
  options: { stockGuids?: string[]; all?: boolean; barcodeType?: string; syncTarget?: string }
) => post<any>('/inventory/barcodes/generate-bulk', { companyGuid, ...options });

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
