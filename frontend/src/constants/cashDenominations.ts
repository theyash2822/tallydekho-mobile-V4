/**
 * Currency-keyed cash denomination masters for Contra Cash Count.
 * Order is descending face value (UI + Auto Split greedy).
 * INR UI notes start at ₹500 (no ₹2000). Tally slots keep a leading 2000
 * position always encoded as 0 so CASHDENOMINATION stays 12 parts.
 */
export type CashDenomMaster = {
  currency: string;
  symbol: string;
  /** Face values largest → smallest (UI) */
  notes: number[];
  /** Slot order for Tally CASHDENOMINATION encode (must stay 12 slots). */
  tallySlots: number[];
};

export const CASH_DENOMINATION_MASTERS: Record<string, CashDenomMaster> = {
  INR: {
    currency: 'INR',
    symbol: '₹',
    notes: [500, 200, 100, 50, 20, 10, 5, 2, 1],
    // Contra_2: leading slot is 2000 (always 0 from app), then 500, 100…
    tallySlots: [2000, 500, 100, 50, 20, 10, 5, 2, 1, 0, 0, 0],
  },
  USD: {
    currency: 'USD',
    symbol: '$',
    notes: [100, 50, 20, 10, 5, 2, 1],
    tallySlots: [100, 50, 20, 10, 5, 2, 1, 0, 0, 0, 0, 0],
  },
  EUR: {
    currency: 'EUR',
    symbol: '€',
    notes: [500, 200, 100, 50, 20, 10, 5, 2, 1],
    tallySlots: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0, 0, 0],
  },
};

export function getCashDenomMaster(currency?: string): CashDenomMaster {
  const key = (currency || 'INR').toUpperCase();
  return CASH_DENOMINATION_MASTERS[key] || CASH_DENOMINATION_MASTERS.INR;
}

export type DenomCounts = Record<string, number>;

export function sumDenomCounts(counts: DenomCounts): number {
  let total = 0;
  for (const [face, qty] of Object.entries(counts || {})) {
    const f = parseFloat(face);
    const q = Math.max(0, parseInt(String(qty), 10) || 0);
    if (f > 0 && q > 0) total += f * q;
  }
  return Math.round(total * 100) / 100;
}

/** Greedy Auto Split of target amount into notes (largest first). */
export function autoSplitAmount(target: number, notes: number[]): DenomCounts {
  let remaining = Math.round((target || 0) * 100) / 100;
  const out: DenomCounts = {};
  for (const face of notes) {
    if (!(face > 0) || remaining < face) {
      out[String(face)] = 0;
      continue;
    }
    const qty = Math.floor(remaining / face);
    out[String(face)] = qty;
    remaining = Math.round((remaining - qty * face) * 100) / 100;
  }
  return out;
}

export function emptyDenomCounts(notes: number[]): DenomCounts {
  const out: DenomCounts = {};
  for (const n of notes) out[String(n)] = 0;
  return out;
}

export function encodeCashDenomination(counts: DenomCounts, slots: number[]): string {
  const denoms: DenomCounts = { ...counts };
  const twoHundreds = Math.max(0, parseInt(String(denoms['200'] ?? 0), 10) || 0);
  if (twoHundreds > 0 && !slots.includes(200)) {
    denoms['100'] = (parseInt(String(denoms['100'] ?? 0), 10) || 0) + twoHundreds * 2;
    delete denoms['200'];
  }
  return slots
    .map((face) => {
      if (!face) return 0;
      return Math.max(0, parseInt(String(denoms[String(face)] ?? 0), 10) || 0);
    })
    .join('-');
}

const LAST_PATTERN_KEY = 'tdk_contra_last_cash_pattern';

export async function loadLastCashPattern(
  storageGet: (k: string) => Promise<string | null>,
): Promise<DenomCounts | null> {
  try {
    const raw = await storageGet(LAST_PATTERN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveLastCashPattern(
  storageSet: (k: string, v: string) => Promise<void>,
  counts: DenomCounts,
): Promise<void> {
  try {
    await storageSet(LAST_PATTERN_KEY, JSON.stringify(counts));
  } catch { /* ignore */ }
}

export { LAST_PATTERN_KEY };
