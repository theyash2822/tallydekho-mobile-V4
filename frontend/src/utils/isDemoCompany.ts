/** Backend `companies.is_demo` is the only Demo authority. Names are never used. */
export function isDemoCompany(c: { is_demo?: boolean; isDemo?: boolean } | null | undefined): boolean {
  if (!c) return false;
  return c.is_demo === true || c.isDemo === true;
}

export function filterCompaniesForPairing<T extends { is_demo?: boolean; isDemo?: boolean; is_active?: boolean }>(
  list: T[],
  pairingStatus: string,
): T[] {
  const rows = Array.isArray(list) ? list : [];
  const status = String(pairingStatus || '').toUpperCase();
  const unpaired = status === 'UNPAIRED' || status === '' || status === 'PENDING';
  return rows.filter((c) => {
    if (c.is_active === false) return false;
    return unpaired ? isDemoCompany(c) : !isDemoCompany(c);
  });
}

/** Demo Mode = unpaired workspace only. RECONNECTING stays on real books. */
export function isDemoMode(pairingStatus: string | null | undefined): boolean {
  const status = String(pairingStatus || '').toUpperCase();
  return status === 'UNPAIRED' || status === '' || status === 'PENDING';
}

export function isLiveBooksStatus(pairingStatus: string | null | undefined): boolean {
  const status = String(pairingStatus || '').toUpperCase();
  return status === 'CONNECTED' || status === 'RECONNECTING';
}
