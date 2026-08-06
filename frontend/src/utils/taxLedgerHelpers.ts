/**
 * Tax ledger rate helpers — autofill % from Tally ledger tax_rate (or name fallback).
 * Source of truth: ledgers.tax_rate ← Tally RateOfTaxCalculation (TAXRATE).
 */

export type TaxLedgerOption = {
  name: string;
  guid?: string;
  taxRate?: number | string | null;
};

/** Parse rate from names like "CGST @ 9%", "SGST 9%", "IGST@18". Returns 0 if none. */
export function parseTaxRateFromName(name: string): number {
  if (!name) return 0;
  const withPct = name.match(/(\d+(?:\.\d+)?)\s*%/);
  if (withPct) {
    const n = parseFloat(withPct[1]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const atRate = name.match(/@\s*(\d+(?:\.\d+)?)\b/);
  if (atRate) {
    const n = parseFloat(atRate[1]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

/** Prefer DB/API taxRate; fallback to name parse when blank/0. */
export function resolveTaxLedgerRate(ledger?: TaxLedgerOption | null): number {
  if (!ledger) return 0;
  const fromDb = parseFloat(String(ledger.taxRate ?? 0));
  if (Number.isFinite(fromDb) && fromDb > 0) return fromDb;
  return parseTaxRateFromName(ledger.name || '');
}

/** Apply ledger select → rate + amount from taxable base. */
export function taxFieldsFromLedgerSelect(
  ledgerName: string,
  taxLedgers: TaxLedgerOption[],
  taxable: number,
): { ledgerName: string; taxRate: string; taxAmount: string } {
  const ledger = taxLedgers.find(l => l.name === ledgerName) || { name: ledgerName };
  const rate = resolveTaxLedgerRate(ledger);
  if (!(rate > 0)) {
    return { ledgerName, taxRate: '', taxAmount: '' };
  }
  const amount = (taxable * rate / 100).toFixed(2);
  return {
    ledgerName,
    taxRate: String(rate),
    taxAmount: amount,
  };
}
