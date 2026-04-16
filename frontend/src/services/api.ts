// ============================================================
// TallyDekho API Service
// Pattern: Try API first → fallback to mock data on failure
// When API responds correctly, mock data is auto-bypassed.
// ============================================================

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

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Core fallback wrapper
async function fetchWithFallback<T>(apiCall: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const result = await apiCall();
    return result;
  } catch {
    console.log('[TallyDekho] API unavailable – using mock data');
    return fallback;
  }
}

async function get<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function post<T>(endpoint: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Auth
export const sendOTP = (phone: string) =>
  fetchWithFallback(() => post('/auth/send-otp', { phone }), { success: true, message: 'OTP sent' });

export const verifyOTP = (phone: string, otp: string) =>
  fetchWithFallback(
    () => post('/auth/verify-otp', { phone, otp }),
    { success: true, token: 'mock_token_123', isNewUser: true }
  );

export const registerUser = (data: { name: string; language: string; phone: string }) =>
  fetchWithFallback(
    () => post('/auth/register', data),
    { success: true, token: 'mock_token_123', user: { ...data, id: 'user_001' } }
  );

// Dashboard
export const getKPIStrip = (period: string = '7D') =>
  fetchWithFallback(() => get(`/dashboard/kpi-strip?period=${period}`), MOCK_KPI_STRIP);

export const getMetrics = (period: string = '7D') =>
  fetchWithFallback(() => get(`/dashboard/metrics?period=${period}`), MOCK_METRICS);

export const getCashflow = (period: string = '7D') =>
  fetchWithFallback(() => get(`/dashboard/cashflow?period=${period}`), MOCK_CASHFLOW);

export const getRecentActivity = () =>
  fetchWithFallback(() => get('/dashboard/recent-activity'), MOCK_RECENT_ACTIVITY);

export const searchDashboard = (q: string) =>
  fetchWithFallback(() => get(`/dashboard/search?q=${encodeURIComponent(q)}`), MOCK_RECENT_ACTIVITY);

// Sales
export const getSalesInvoices = () =>
  fetchWithFallback(() => get('/sales/invoices'), {
    invoices: [],
    pending_irn_count: 14,
    total: 14,
  });

// Stocks
export const getStocks = () =>
  fetchWithFallback(() => get('/stocks'), MOCK_STOCKS);

// Ledgers
export const getLedgers = () =>
  fetchWithFallback(() => get('/ledgers'), MOCK_LEDGERS);

// Reports
export const getReports = () =>
  fetchWithFallback(() => get('/reports'), MOCK_REPORTS);

// Financial Report (P&L, Balance Sheet, Trial Balance)
// API endpoint: GET /api/reports/financial-report?from=DD/MM/YY&to=DD/MM/YY
export const getFinancialReport = (fromDate?: string, toDate?: string) =>
  fetchWithFallback(
    () => get(`/reports/financial-report${fromDate && toDate ? `?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}` : ''}`),
    null   // mock data lives inside the screen component; backend will return real data
  );

export const getFinancialData = () =>
  fetchWithFallback(
    () => get<{ months: string[]; revenue: number[]; expenses: number[] }>('/reports/financial'),
    {
      months:   ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
      revenue:  [450000,520000,480000,610000,580000,640000,720000,680000,750000,820000,790000,950000],
      expenses: [380000,420000,410000,490000,460000,510000,580000,545000,600000,660000,630000,720000],
    }
  );

// Notifications
export const getNotifications = () =>
  fetchWithFallback(() => get('/notifications'), MOCK_NOTIFICATIONS);
