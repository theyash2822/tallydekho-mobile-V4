import { StockItem } from '../data/stockData';
import { getActiveWorkspaceId } from '../services/api';

const _stockCache: Record<string, { data: StockItem[]; ts: number }> = {};

export function getStockListCache() {
  return _stockCache;
}

/**
 * Cache key for one company's stock list.
 *
 * The workspace is part of the key because a Tally GUID is unique only within a
 * workspace: two tenants can legitimately sync the same Tally company, and a
 * GUID-only key made them share this cache, so switching workspace could show
 * the other tenant's stock until the entry expired.
 */
export function stockCacheKey(companyGuid: string, lastSyncAt: string | number | null | undefined) {
  return `${getActiveWorkspaceId() ?? 'no-ws'}:${companyGuid}:${lastSyncAt ?? ''}`;
}

/** Clear Total Stock list cache — call after transfer/adjust/sync, and on logout. */
export function clearStockListCache() {
  Object.keys(_stockCache).forEach(k => delete _stockCache[k]);
}
