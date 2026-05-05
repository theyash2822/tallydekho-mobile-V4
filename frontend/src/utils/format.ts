/**
 * format.ts — Shared formatting utilities for TallyDekho
 *
 * Use these functions directly when outside a React component (e.g. PDF/HTML export, share).
 * Inside components, prefer useSettings() which sources settings from context automatically.
 */

export interface FormatSettings {
  currency: string;       // 'INR' | 'USD' | 'EUR' | 'AED' | etc.
  number_format: string;  // 'Indian' | 'International'
  decimal_places: number;
  date_format: string;    // 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
}

export const DEFAULT_FORMAT_SETTINGS: FormatSettings = {
  currency: 'INR',
  number_format: 'Indian',
  decimal_places: 2,
  date_format: 'DD/MM/YYYY',
};

// ── Currency symbol map ────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',  USD: '$',   EUR: '€',  GBP: '£',  AED: 'د.إ', AUD: 'A$',
  BDT: '৳',  BHD: 'BD',  CAD: 'C$', CNY: '¥',  JPY: '¥',   KES: 'KSh',
  KWD: 'KD', LKR: 'Rs',  MYR: 'RM', NGN: '₦',  NPR: 'रू',  NZD: 'NZ$',
  OMR: '﷼',  QAR: 'QR',  SAR: 'SR', SGD: 'S$', TZS: 'TSh', ZAR: 'R',
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Whether a currency uses Indian compact notation (L = Lakh, Cr = Crore).
 * INR and a few South Asian currencies use Indian system.
 * All others use International (K, M, B).
 */
function isIndianCurrency(currency: string): boolean {
  return ['INR', 'NPR', 'LKR', 'BDT'].includes(currency);
}

/**
 * Format a number as a full amount string.
 * Examples:
 *   INR / Indian:        ₹1,25,000.00
 *   USD / International: $125,000.00
 *   AED / International: د.إ125,000.00
 */
export function formatAmount(n: number, settings: FormatSettings): string {
  const symbol = getCurrencySymbol(settings.currency);
  const abs = Math.abs(n);
  const locale = settings.number_format === 'Indian' ? 'en-IN' : 'en-US';
  const formatted = abs.toLocaleString(locale, {
    minimumFractionDigits: settings.decimal_places,
    maximumFractionDigits: settings.decimal_places,
  });
  return (n < 0 ? '-' : '') + symbol + formatted;
}

/**
 * Format a number in compact notation, respecting currency system.
 *
 * Indian system (INR, NPR, LKR, BDT):
 *   < 1,000       → ₹500
 *   1,000–99,999  → ₹1.2K
 *   1,00,000+     → ₹1.2L
 *   1,00,00,000+  → ₹1.2Cr
 *
 * International system (USD, EUR, AED, etc.):
 *   < 1,000       → $500
 *   1,000–999,999 → $1.2K
 *   1,000,000+    → $1.2M
 *   1,000,000,000 → $1.2B
 */
export function formatAmountCompact(n: number, settings: FormatSettings): string {
  const symbol = getCurrencySymbol(settings.currency);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (isIndianCurrency(settings.currency)) {
    // Indian compact
    if (abs >= 1_00_00_000) {
      return `${sign}${symbol}${(abs / 1_00_00_000).toFixed(1)}Cr`;
    } else if (abs >= 1_00_000) {
      return `${sign}${symbol}${(abs / 1_00_000).toFixed(1)}L`;
    } else if (abs >= 1_000) {
      return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
    }
    return `${sign}${symbol}${Math.round(abs)}`;
  } else {
    // International compact
    if (abs >= 1_000_000_000) {
      return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(1)}B`;
    } else if (abs >= 1_000_000) {
      return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
    } else if (abs >= 1_000) {
      return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
    }
    return `${sign}${symbol}${Math.round(abs)}`;
  }
}

/**
 * Format a transaction date string.
 * Only applies to ISO date strings (YYYY-MM-DD or with T).
 * Non-ISO strings (e.g. "10 Jul") are returned as-is.
 */
export function formatDate(iso: string, settings: FormatSettings): string {
  if (!iso) return '';
  // Only format ISO-style strings
  const datePart = iso.split('T')[0];
  if (!datePart.match(/^\d{4}-\d{2}-\d{2}$/)) return iso;
  const [y, m, d] = datePart.split('-');
  switch (settings.date_format) {
    case 'MM/DD/YYYY': return `${m}/${d}/${y}`;
    case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
    default:           return `${d}/${m}/${y}`; // DD/MM/YYYY
  }
}
