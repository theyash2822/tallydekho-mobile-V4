/**
 * Display unit for read-only stock/voucher surfaces.
 * Prefer Tally/item unit; fall back to inventory Default Unit when blank.
 * Never invent a write — Create Item stays manual.
 */
export function displayUnit(
  raw: string | null | undefined,
  defaultUnit?: string | null,
): string {
  const u = String(raw ?? '').trim();
  if (u) return u;
  const d = String(defaultUnit ?? '').trim();
  return d || 'Nos';
}
