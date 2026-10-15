/**
 * India financial year (Apr–Mar) for gating voucher create when a past FY is selected.
 * Parity: td-web-portal/src/utils/runningFinancialYear.js
 */
import { fyInfoToParam, type FYInfo } from '../context/AuthContext';
import { normalizeFinYearLabel } from './normalizeFinYearLabel';

export function indiaRunningFinYearBounds(asOf: Date = new Date()) {
  const y = asOf.getFullYear();
  const month = asOf.getMonth();
  const startYear = month >= 3 ? y : y - 1;
  const endYear = startYear + 1;
  return {
    startYear,
    endYear,
    labelFull: `${startYear}-${endYear}`,
    labelShort: `${startYear}-${String(endYear).slice(-2)}`,
  };
}

function labelsEquivalent(a: string | undefined | null, b: string | undefined | null) {
  const na = normalizeFinYearLabel(a ?? undefined);
  const nb = normalizeFinYearLabel(b ?? undefined);
  return !!(na && nb && na === nb);
}

/** True when `selectedFY` is the FY that contains `asOf` (India Apr–Mar). */
export function isRunningFinancialYear(selectedFY: FYInfo | null | undefined, asOf: Date = new Date()) {
  if (!selectedFY) return false;
  const running = indiaRunningFinYearBounds(asOf);
  const candidates = [
    fyInfoToParam(selectedFY),
    selectedFY.finYear,
    selectedFY.label,
  ].filter(Boolean) as string[];
  if (candidates.some((c) => labelsEquivalent(c, running.labelFull) || labelsEquivalent(c, running.labelShort))) {
    return true;
  }
  const selStart = selectedFY.startDate;
  if (selStart) {
    const sy = parseInt(String(selStart).slice(0, 4), 10);
    if (Number.isFinite(sy) && sy === running.startYear) return true;
  }
  return false;
}
