/** '2025-26' / 'FY 2025-26' → '2025-2026' for backend fy= queries (web portal parity). */
export function normalizeFinYearLabel(fyParam: string | null | undefined): string | null {
  if (!fyParam) return null;
  let s = String(fyParam).trim().replace(/^FY\s*/i, '');
  const full = s.match(/^(\d{4})-(\d{4})$/);
  if (full) return `${full[1]}-${full[2]}`;
  const short = s.match(/^(\d{4})-(\d{2})$/);
  if (short) {
    const y1 = parseInt(short[1], 10);
    const y2 = parseInt(short[2], 10);
    const endYear = y2 >= 100 ? y2 : (y2 < 50 ? 2000 + y2 : 1900 + y2);
    return endYear === y1 + 1 ? `${y1}-${endYear}` : `${y1}-${y1 + 1}`;
  }
  return s;
}
