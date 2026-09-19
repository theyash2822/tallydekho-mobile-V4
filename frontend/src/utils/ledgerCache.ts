const _ledgerCache: Record<string, { data: any[]; total: number; ts: number }> = {};

export function getLedgerListCache() {
  return _ledgerCache;
}

export function ledgerCacheKey(
  workspaceId: string | null | undefined,
  companyGuid: string,
  lastSyncAt: string | number | null | undefined,
  fyStart: string | null | undefined,
) {
  return `v2:${workspaceId ?? 'no-ws'}:${companyGuid}:${lastSyncAt ?? ''}:${fyStart ?? ''}`;
}

export function clearLedgerCache() {
  Object.keys(_ledgerCache).forEach((k) => delete _ledgerCache[k]);
}
