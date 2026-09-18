/**
 * Render helpers for sensitive-policy fields (backend may already mask).
 */
export type SensitiveVisibility = 'VISIBLE' | 'MASKED' | 'HIDDEN' | boolean;

export function policyVisibility(
  policies: Record<string, SensitiveVisibility> | null | undefined,
  key: string
): 'VISIBLE' | 'MASKED' | 'HIDDEN' {
  if (!policies) return 'VISIBLE';
  const v = policies[key];
  if (v === true || v === 'VISIBLE') return 'VISIBLE';
  if (v === 'MASKED') return 'MASKED';
  if (v === false || v === 'HIDDEN') return 'HIDDEN';
  return 'VISIBLE';
}

export function formatSensitive(
  policies: Record<string, SensitiveVisibility> | null | undefined,
  key: string,
  value: any,
  formatVisible?: (v: any) => string
): string | null {
  const vis = policyVisibility(policies, key);
  if (vis === 'HIDDEN') return null;
  if (vis === 'MASKED') return '••••';
  if (value == null || value === '') return '—';
  return formatVisible ? formatVisible(value) : String(value);
}

export function isSensitiveHidden(
  policies: Record<string, SensitiveVisibility> | null | undefined,
  key: string
): boolean {
  return policyVisibility(policies, key) === 'HIDDEN';
}
