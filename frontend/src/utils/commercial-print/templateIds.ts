/**
 * Commercial template IDs per Spec MASTER v1.
 * Thermal replaces former TallyDekho Ledger commercial.
 */

export const COMMERCIAL_TEMPLATE_IDS = [
  'tally_classic_commercial_v1',
  'td_thermal_commercial_v1',
  'td_executive_commercial_v1',
] as const;

export type CommercialTemplateId = (typeof COMMERCIAL_TEMPLATE_IDS)[number];

export const DEFAULT_COMMERCIAL_TEMPLATE_ID: CommercialTemplateId =
  'tally_classic_commercial_v1';

export const DEFAULT = DEFAULT_COMMERCIAL_TEMPLATE_ID;

export type LegacyDocumentFormat = 'tally' | 'modern_a' | 'modern_b' | 1 | 2 | 3;

const LEGACY_TO_TEMPLATE: Record<string, CommercialTemplateId> = {
  tally: 'tally_classic_commercial_v1',
  modern_a: 'td_thermal_commercial_v1',
  modern_b: 'td_executive_commercial_v1',
  '1': 'tally_classic_commercial_v1',
  '2': 'td_thermal_commercial_v1',
  '3': 'td_executive_commercial_v1',
  tally_classic_v1: 'tally_classic_commercial_v1',
  td_ledger_v1: 'td_thermal_commercial_v1',
  td_thermal_v1: 'td_thermal_commercial_v1',
  td_executive_v1: 'td_executive_commercial_v1',
  tally_classic_commercial_v1: 'tally_classic_commercial_v1',
  td_ledger_commercial_v1: 'td_thermal_commercial_v1', // Ledger → Thermal
  td_thermal_commercial_v1: 'td_thermal_commercial_v1',
  td_executive_commercial_v1: 'td_executive_commercial_v1',
};

export const TEMPLATE_DISPLAY: Record<CommercialTemplateId, string> = {
  tally_classic_commercial_v1: 'Tally Classic',
  td_thermal_commercial_v1: 'TallyDekho Thermal',
  td_executive_commercial_v1: 'TallyDekho Executive',
};

export function resolveCommercialTemplateId(
  format?: string | number | null
): CommercialTemplateId {
  if (format == null || format === '') return DEFAULT_COMMERCIAL_TEMPLATE_ID;
  const key = String(format);
  return LEGACY_TO_TEMPLATE[key] ?? DEFAULT_COMMERCIAL_TEMPLATE_ID;
}
