import { StockItem } from '../data/stockData';

const _stockCache: Record<string, { data: StockItem[]; ts: number }> = {};

export function getStockListCache() {
  return _stockCache;
}

/** Clear Total Stock list cache — call after transfer/adjust/sync. */
export function clearStockListCache() {
  Object.keys(_stockCache).forEach(k => delete _stockCache[k]);
}
