// ─── STOCK SCREEN: Shared types and form constants ────────────────────

export type StockItem = {
  id: string; name: string; sku: string; category: string;
  group: string; warehouse: string; warehouseId?: string; qty: number; value: string;
  icon: string; iconColor: string; iconBg: string;
  unit?: string; reorderLevel?: number; status?: string;
  /** GST HSN/SAC from stock master (not SKU/alias) */
  hsn?: string;
  /** Exact Tally stock item name for Alter XML (may differ from display name) */
  tallyName?: string;
};

export const ALL_TAX_RATES = [
  { id: 'none', label: 'None (0%)' },
  { id: '5',    label: '5%' },
  { id: '12',   label: '12%' },
  { id: '18',   label: '18%' },
  { id: '28',   label: '28%' },
];

export const LOW_STOCK_QTY = 30;
