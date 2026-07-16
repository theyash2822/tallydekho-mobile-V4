/**
 * Universal voucher numbering + reconcile guidelines.
 *
 * LOCKED (2026-07-16) — see tallydekho-brain/DECISIONS.md
 *
 * Create UI:
 *   - Every data-entry screen uses this hook (or identical rules).
 *   - No on-screen numbering pills / overrides — Settings → Voucher Config only.
 *
 * Policy values:
 *   - tally_prime_series (default): empty VOUCHERNUMBER → Tally assigns series;
 *     TDK id lives in <REFERENCE>.
 *   - tallydekho_series: backend fills TD/… into VOUCHERNUMBER for regular only
 *     (optional stays Auto / Tally).
 *
 * Codes: SAL / RCP / PAY / JOR / CON (+ OPT- when optional).
 * Auto-Receipt / Make Payment Now: own TDK in <REFERENCE>; parent via bill Agst Ref.
 *
 * Reconcile order (backend ingest — stop at first success):
 *   1. Primary — REFERENCE match (vouchers.reference = tdk_reference_no)
 *   2. Sales bill-ref (New Ref / Agst Ref name = TDK-SAL…)
 *   3. Batch JOIN safety net (thin payload missing Reference)
 *   4. Strategy C last resort — unique party/date/amount (or type/date/amount);
 *      ambiguous → do not attach number
 * Forbidden as primary: narration anchors for new writes.
 */
import { useEffect, useState } from 'react';
import { getComplianceConfig } from '../services/api';

export type NumberingPolicy = 'tally_prime_series' | 'tallydekho_series';

export const DEFAULT_NUMBERING_POLICY: NumberingPolicy = 'tally_prime_series';

export function useNumberingPolicy(companyGuid?: string | null) {
  const [numberingPolicy, setNumberingPolicy] = useState<NumberingPolicy>(DEFAULT_NUMBERING_POLICY);

  useEffect(() => {
    if (!companyGuid) return;
    getComplianceConfig(companyGuid)
      .then((res: any) => {
        const cfg = res?.data || res;
        setNumberingPolicy(cfg?.numbering_policy === 'tallydekho_series' ? 'tallydekho_series' : 'tally_prime_series');
      })
      .catch(() => {
        setNumberingPolicy(DEFAULT_NUMBERING_POLICY);
      });
  }, [companyGuid]);

  return { numberingPolicy, setNumberingPolicy };
}
