/**
 * Template IDs per Spec MASTER v1.
 * Thermal replaces former TallyDekho Ledger.
 */

export const VOUCHER_TEMPLATE_IDS = [
  'tally_classic_v1',
  'td_thermal_v1',
  'td_executive_v1',
] as const;

export type VoucherTemplateId = (typeof VOUCHER_TEMPLATE_IDS)[number];

export const DEFAULT_VOUCHER_TEMPLATE_ID: VoucherTemplateId = 'tally_classic_v1';

/** Legacy Settings → Voucher Config format values. */
export type LegacyDocumentFormat = 'tally' | 'modern_a' | 'modern_b' | 1 | 2 | 3;

const LEGACY_TO_TEMPLATE: Record<string, VoucherTemplateId> = {
  tally: 'tally_classic_v1',
  modern_a: 'td_thermal_v1',
  modern_b: 'td_executive_v1',
  '1': 'tally_classic_v1',
  '2': 'td_thermal_v1',
  '3': 'td_executive_v1',
  tally_classic_v1: 'tally_classic_v1',
  td_ledger_v1: 'td_thermal_v1', // Ledger → Thermal migration
  td_thermal_v1: 'td_thermal_v1',
  td_executive_v1: 'td_executive_v1',
};

export const TEMPLATE_DISPLAY: Record<VoucherTemplateId, string> = {
  tally_classic_v1: 'Tally Classic',
  td_thermal_v1: 'TallyDekho Thermal',
  td_executive_v1: 'TallyDekho Executive',
};

export function resolveVoucherTemplateId(
  format?: string | number | null
): VoucherTemplateId {
  if (format == null || format === '') return DEFAULT_VOUCHER_TEMPLATE_ID;
  const key = String(format);
  return LEGACY_TO_TEMPLATE[key] ?? DEFAULT_VOUCHER_TEMPLATE_ID;
}

export function toStoredTemplateId(id: VoucherTemplateId): VoucherTemplateId {
  return id;
}
