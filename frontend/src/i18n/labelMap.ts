/**
 * Map known UI chrome ids/labels → i18n keys.
 * Tally master data (party names, item names, voucher numbers) must NOT use this —
 * show those AS-IS from the API.
 */
import type { TFunction } from 'i18next';

const KPI_ID_KEYS: Record<string, string> = {
  cash: 'home.kpiCash',
  cash_in_hand: 'home.kpiCash',
  'cash-in-hand': 'home.kpiCash',
  bank: 'home.kpiBank',
  bank_balance: 'home.kpiBank',
  'bank-balance': 'home.kpiBank',
  receivables: 'home.kpiReceivables',
  ar: 'home.kpiReceivables',
  payables: 'home.kpiPayables',
  ap: 'home.kpiPayables',
  loans: 'home.kpiLoans',
  loans_ods: 'home.kpiLoans',
  'loans-ods': 'home.kpiLoans',
  payments: 'home.kpiPayments',
  receipts: 'home.kpiReceipts',
};

const METRIC_ID_KEYS: Record<string, string> = {
  sales: 'home.metricSales',
  purchases: 'home.metricPurchases',
  purchase: 'home.metricPurchases',
  expenses: 'home.metricExpenses',
};

const KPI_LABEL_FALLBACK: Record<string, string> = {
  'Cash in Hand': 'home.kpiCash',
  'Bank Balance': 'home.kpiBank',
  Receivables: 'home.kpiReceivables',
  Payables: 'home.kpiPayables',
  'Loans & ODs': 'home.kpiLoans',
  Loans: 'home.kpiLoans',
  Payments: 'home.kpiPayments',
  Receipts: 'home.kpiReceipts',
};

export function tKpiLabel(t: TFunction, id?: string, fallbackLabel?: string): string {
  if (id && KPI_ID_KEYS[id]) return t(KPI_ID_KEYS[id]);
  if (fallbackLabel && KPI_LABEL_FALLBACK[fallbackLabel]) return t(KPI_LABEL_FALLBACK[fallbackLabel]);
  return fallbackLabel || id || '';
}

export function tMetricLabel(t: TFunction, id?: string, fallbackLabel?: string): string {
  if (id && METRIC_ID_KEYS[id]) return t(METRIC_ID_KEYS[id]);
  return fallbackLabel || id || '';
}
