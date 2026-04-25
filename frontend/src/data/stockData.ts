// ─── STOCK SCREEN: Shared types, constants, and mock data ────────────────────

export type StockItem = {
  id: string; name: string; sku: string; category: string;
  group: string; warehouse: string; qty: number; value: string;
  icon: string; iconColor: string; iconBg: string;
};

export const STOCK_ITEMS: StockItem[] = [
  { id: 'SI01', name: 'Black JBL Speaker',      sku: 'PRD-1002-ABC', category: 'Audio',       group: 'Consumer Electronics', warehouse: 'WH01', qty: 85,  value: '₹4,200',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI02', name: 'USB-C Cable 3A',          sku: 'USB-3A-1M',   category: 'Accessories', group: 'Mobile Accessories',   warehouse: 'WH01', qty: 320, value: '₹450',    icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI03', name: 'Wireless Mouse M220',     sku: 'LOG-M220',    category: 'Peripherals', group: 'Office Peripherals',   warehouse: 'WH02', qty: 64,  value: '₹2,800',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI04', name: 'HDMI Cable 1.5m',         sku: 'HDM-1.5',     category: 'Accessories', group: 'Mobile Accessories',   warehouse: 'WH02', qty: 140, value: '₹780',    icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI05', name: 'Laptop Stand Adjustable', sku: 'LST-ADJ01',   category: 'Furniture',   group: 'Office Supplies',      warehouse: 'WH01', qty: 28,  value: '₹5,400',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI06', name: 'Mechanical Keyboard',     sku: 'LOG-MK235',   category: 'Peripherals', group: 'Office Peripherals',   warehouse: 'WH03', qty: 42,  value: '₹6,900',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI07', name: 'Power Bank 20000mAh',     sku: 'AMZ-PB20K',   category: 'Mobiles',     group: 'Mobile Accessories',   warehouse: 'WH03', qty: 95,  value: '₹1,800',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI08', name: 'Monitor 27" IPS',         sku: 'BNQ-27IPS',   category: 'Electronics', group: 'Consumer Electronics', warehouse: 'WH01', qty: 12,  value: '₹21,000', icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI09', name: 'TWS Earbuds Pro',          sku: 'TWS-PRO-01',  category: 'Audio',       group: 'Consumer Electronics', warehouse: 'WH02', qty: 58,  value: '₹2,200',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
  { id: 'SI10', name: 'Type-C Hub 7-in-1',        sku: 'USB-C71',     category: 'Accessories', group: 'Mobile Accessories',   warehouse: 'WH04', qty: 76,  value: '₹1,600',  icon: 'cube-outline', iconColor: '#1A1A1A', iconBg: '#E8E7E1' },
];

export const ALL_WAREHOUSES = [
  { id: 'WH01', label: 'WH01 – Mumbai' },
  { id: 'WH02', label: 'WH02 – Delhi' },
  { id: 'WH03', label: 'WH03 – Bangalore' },
  { id: 'WH04', label: 'WH04 – Hyderabad' },
];

export const ALL_CATEGORIES = ['Audio', 'Accessories', 'Peripherals', 'Furniture', 'Mobiles', 'Electronics'];

export const ALL_GROUPS = ['Consumer Electronics', 'Mobile Accessories', 'Office Peripherals', 'Office Supplies'];

export const ALL_UNITS = [
  { id: 'pcs',   label: 'pcs' },
  { id: 'kg',    label: 'kg' },
  { id: 'box',   label: 'box' },
  { id: 'set',   label: 'set' },
  { id: 'litre', label: 'litre' },
];

export const ALL_TAX_RATES = [
  { id: 'none', label: 'None (0%)' },
  { id: '5',    label: '5%' },
  { id: '12',   label: '12%' },
  { id: '18',   label: '18%' },
  { id: '28',   label: '28%' },
];

export const RACK_OPTIONS = [
  { id: 'A-07', label: 'Rack A-07' },
  { id: 'B-12', label: 'Rack B-12' },
  { id: 'C-01', label: 'Rack C-01' },
  { id: 'D-05', label: 'Rack D-05' },
];

export const ADJ_REASONS = [
  { id: 'damage',  label: 'Damage' },
  { id: 'theft',   label: 'Theft' },
  { id: 'count',   label: 'Count Correction' },
  { id: 'opening', label: 'Opening Balance' },
  { id: 'other',   label: 'Other' },
];

export const LOW_STOCK_QTY = 30;
