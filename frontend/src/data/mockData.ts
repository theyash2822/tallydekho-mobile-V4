// ============================================================
// TallyDekho — Single Source of Truth for Mock / Static Data
// When API is available, this file is auto-bypassed by api.ts
// ============================================================

export const MOCK_USER = {
  id: 'user_001',
  name: 'Ashish Agarwal',
  phone: '+91 96722 22367',
  company: 'YK Industries Pvt. Ltd.',
  gstin: '27ABCDE1234F1Z5',
  fyYear: 'FY 2025-26',
};

export const MOCK_COMPANIES = [
  { id: 'c1', name: 'YK Industries Pvt. Ltd.',        gstin: '27ABCDE1234F1Z5', active: true  },
  { id: 'c2', name: 'Maaruji Technologies Pvt. Ltd.', gstin: '08AAFCM1234G1Z5', active: false },
  { id: 'c3', name: 'Demo India Trading Co.',         gstin: '07XXXXX1234X1Z1', active: false },
];

export const MOCK_STOCK_DASHBOARD = {
  totalQty: '3,24,666',
  totalValue: '₹13,00,000',
  warehouses: { total: 5, utilization: 76 },
  lowStockCount: 12,
  agedInventory: { value: '₹12,500', days: 90 },
  fastMovingCount: 130,
  reorderQueueCount: 8,
};

export const MOCK_KPI_STRIP = [
  { id: 'cash', label: 'Cash In Hand', amount: '₹10,00,000', icon: 'cash-outline', route: '/kpi/cash-in-hand' },
  { id: 'bank', label: 'Bank Balance', amount: '₹8,00,000', icon: 'card-outline', route: '/kpi/bank-balance' },
  { id: 'receivable', label: 'Receivables', amount: '₹3,50,000', icon: 'arrow-down-circle-outline', route: '/kpi/receivables' },
  { id: 'payable', label: 'Payables', amount: '₹5,61,500', icon: 'arrow-up-circle-outline', route: '/kpi/payables' },
  { id: 'loans', label: 'Loans & ODs', amount: '₹1,62,500', icon: 'git-merge-outline', route: '/kpi/loans-ods' },
  { id: 'payments', label: 'Payments', amount: '₹1,36,000', icon: 'send-outline', route: '/kpi/payments' },
  { id: 'receipts', label: 'Receipts', amount: '₹36,000', icon: 'download-outline', route: '/kpi/receipts' },
];

export const MOCK_METRICS = [
  { id: 'expenses', label: 'Expenses', amount: '₹1,42,000', change: 12.0, positive: false, icon: 'trending-up-outline', route: '/expenses' },
  { id: 'sales', label: 'Sales', amount: '₹92,000', change: 5.1, positive: true, icon: 'stats-chart-outline', route: '/sales/register' },
  { id: 'purchases', label: 'Purchases', amount: '₹74,500', change: 8.7, positive: true, icon: 'cart-outline', route: '/purchase/register' },
];

export const MOCK_CASHFLOW = {
  netCash: 20830,
  grossCash: 606.21,
  netRealisableBalance: 20021,
  grossProfit: 470999,
  netProfit: 130999,
  incomePercentage: 68,
  updatedAt: '5 mins. ago',
};

export const MOCK_RECENT_ACTIVITY = [
  { id: '1', type: 'invoice', description: 'You created INV-30975.', time: '5m ago', isUser: true },
  { id: '2', type: 'invoice', description: 'You created INV-30975', time: '5m ago', isUser: true },
  { id: '3', type: 'invoice', description: 'You created INV-30975', time: '5m ago', isUser: true },
  { id: '4', type: 'irn', description: 'Rajesh generated 14 IRNs', time: '5m ago', isUser: false, avatar: 'R' },
  { id: '5', type: 'invoice', description: 'You created INV-30971', time: '12m ago', isUser: true },
  { id: '6', type: 'payment', description: 'Payment received from Raj Enterprises', time: '1h ago', isUser: false, avatar: 'RE' },
];

export const MOCK_STOCKS = {
  totalValue: '₹6,06,210',
  totalSKUs: 56,
  totalWarehouses: 3,
  lowStockCount: 8,
  items: [
    { id: 'STK001', name: 'Black JBL Portable Bluetooth Speaker', sku: 'PRD-1002-ABC', price: '₹34,000', stock: 8, status: 'in_stock', warehouse: 'Miami' },
    { id: 'STK002', name: 'Samsung Galaxy J1 Bluetooth', sku: 'PRD-1003-DEF', price: '₹34,000', stock: 0, status: 'out_of_stock', warehouse: 'Los Angeles' },
    { id: 'STK003', name: 'Lycan Wireless Headphone', sku: 'LWH-789', price: '₹34,000', stock: 2828, status: 'low_stock', warehouse: 'Miami' },
    { id: 'STK004', name: 'JBL Wired Speaker', sku: 'JWS-456', price: '₹34,000', stock: 8, status: 'in_stock', warehouse: 'Deltamas' },
    { id: 'STK005', name: 'Sony WH-1000XM5', sku: 'SNY-001', price: '₹28,000', stock: 5, status: 'low_stock', warehouse: 'Miami' },
  ],
};

export const MOCK_LEDGERS = [
  { id: 'LED001', name: 'Indian Export House', group: 'Sundry Creditor', balance: '₹34,000', type: 'credit', lastUpdated: '08/28' },
  { id: 'LED002', name: 'Raj Enterprises', group: 'Sundry Debtor', balance: '₹12,500', type: 'debit', lastUpdated: '08/25' },
  { id: 'LED003', name: 'ABC Traders', group: 'Sundry Creditor', balance: '₹34,000', type: 'credit', lastUpdated: '08/20' },
  { id: 'LED004', name: 'Kumar & Sons', group: 'Sundry Debtor', balance: '₹8,000', type: 'debit', lastUpdated: '08/18' },
  { id: 'LED005', name: 'Sharma Electronics', group: 'Capital Account', balance: '₹5,00,000', type: 'credit', lastUpdated: '08/15' },
  { id: 'LED006', name: 'Delhi Suppliers', group: 'Sundry Creditor', balance: '₹22,000', type: 'credit', lastUpdated: '08/10' },
];

export const MOCK_REPORTS = {
  salesSummary: { today: '₹92,000', mtd: '₹1.27M', ytd: '₹7.4M', avgTicket: '₹14,350', creditNotes: 3, outstanding: '₹812K' },
  ewayBills: { generated: 265, pending: 33, errors: 9, expiring: 12 },
  gst: { igst: '₹1,82,000', cgst: '₹90,000', sgst: '₹90,000', totalTaxCollected: '₹3,62,000' },
};

export const MOCK_MONTHLY_REVENUE = [
  { month: 'Jun', sales: 4.2, purchases: 2.8 },
  { month: 'Jul', sales: 5.6, purchases: 3.5 },
  { month: 'Aug', sales: 4.9, purchases: 3.1 },
  { month: 'Sep', sales: 7.3, purchases: 4.8 },
  { month: 'Oct', sales: 6.8, purchases: 4.2 },
  { month: 'Nov', sales: 8.1, purchases: 5.0 },
  { month: 'Dec', sales: 10.4, purchases: 6.2 },
  { month: 'Jan', sales: 7.8, purchases: 4.9 },
  { month: 'Feb', sales: 9.2, purchases: 5.8 },
  { month: 'Mar', sales: 8.5, purchases: 5.3 },
  { month: 'Apr', sales: 11.1, purchases: 6.8 },
  { month: 'May', sales: 9.7, purchases: 6.1 },
];

export const MOCK_NOTIFICATIONS = [
  { id: 'N001', type: 'warning', title: 'Budget Overspend Warning', message: "Budget Alert: You've exceeded your monthly marketing budget by ₹2,000. Tap to adjust your plan!", time: '5 mins.', actionLabel: 'Adjust plan' },
  { id: 'N002', type: 'urgent', title: 'Daily Summary Alert', message: "Your daily financial summary is ready! Tap to review today's income, expenses, and cash flow insights.", time: '12:02 PM' },
  { id: 'N003', type: 'info', title: 'Goal Progress Update', message: "Great news! You're 75% closer to your savings goal for this month. Keep up the momentum!", time: 'Jan 20, 2025' },
];

// ── Sales Register ──────────────────────────────────────────────────────────
export const MOCK_SALES_REGISTER = {
  summary: { total: '₹12,74,560', tax: '₹1,38,240', avg: '₹14,380', docs: 34 },
  invoices: [
    { id: 'INV-30978', party: 'ABC Traders',          date: '11/01/25', time: '09:00 AM', amount: '₹42,500', status: 'paid' },
    { id: 'INV-30977', party: 'PQR Exports',          date: '11/01/25', time: '09:00 AM', amount: '₹28,000', status: 'unpaid' },
    { id: 'INV-30976', party: 'XYZ Retail',           date: '11/01/25', time: '10:00 AM', amount: '₹15,000', status: 'paid' },
    { id: 'INV-30975', party: 'ABC Traders',          date: '11/01/25', time: '09:00 AM', amount: '₹42,500', status: 'paid' },
    { id: 'INV-30974', party: 'Kumar & Sons',         date: '10/01/25', time: '11:30 AM', amount: '₹35,000', status: 'unpaid' },
    { id: 'CN-00712',  party: 'ABC Traders',          date: '10/01/25', time: '09:00 AM', amount: '₹3,200',  status: 'credit_note' },
    { id: 'INV-30973', party: 'Sharma Electronics',   date: '10/01/25', time: '08:00 AM', amount: '₹62,000', status: 'paid' },
    { id: 'INV-30972', party: 'Delhi Suppliers',      date: '09/01/25', time: '02:00 PM', amount: '₹18,500', status: 'irm' },
  ],
};

// ── E-Way Bills ──────────────────────────────────────────────────────────────
export const MOCK_EWAYBILLS = {
  pending: 17,
  cancelled: 17,
  generated: 265,
  bills: [
    { id: 'EWB-10045678', company: 'Maaruji Technologies Pvt Ltd', generatedAt: '12 Jul 23:59', date: '10 Jul', status: 'generated' },
    { id: 'EWB-10045677', company: 'Rahul Enterprises',            generatedAt: '10 Jul 14:00', date: '09 Jul', status: 'generated' },
    { id: 'EWB-10045676', company: 'ABC Traders',                  generatedAt: '09 Jul 10:30', date: '08 Jul', status: 'pending' },
    { id: 'EWB-10045675', company: 'PQR Exports Ltd',              generatedAt: '08 Jul 08:00', date: '07 Jul', status: 'cancelled' },
    { id: 'EWB-10045674', company: 'Kumar & Sons',                 generatedAt: '07 Jul 16:00', date: '06 Jul', status: 'generated' },
    { id: 'EWB-10045673', company: 'Sharma Electronics',           generatedAt: '06 Jul 12:00', date: '05 Jul', status: 'generated' },
  ],
};

// ── Purchase Register ────────────────────────────────────────────────────────
export const MOCK_PURCHASE_REGISTER = {
  summary: { total: '₹12,74,560', tax: '₹1,38,240', avg: '₹14,380', docs: 34 },
  invoices: [
    { id: 'INV-30978', vendor: 'ABC Traders',     date: '11/01/25', time: '09:00 AM', amount: '₹42,500', status: 'paid' },
    { id: 'INV-30977', vendor: 'ABC Traders',     date: '11/01/25', time: '09:00 AM', amount: '₹42,500', status: 'unpaid' },
    { id: 'INV-30976', vendor: 'PQR Exports',     date: '11/01/25', time: '09:00 AM', amount: '₹42,500', status: 'irm' },
    { id: 'INV-30975', vendor: 'ABC Traders',     date: '11/01/25', time: '09:00 AM', amount: '₹42,500', status: 'paid' },
    { id: 'INV-30974', vendor: 'Kumar & Sons',    date: '10/01/25', time: '11:30 AM', amount: '₹35,000', status: 'unpaid' },
    { id: 'INV-30973', vendor: 'PQR Exports',     date: '10/01/25', time: '09:00 AM', amount: '₹28,000', status: 'paid' },
    { id: 'INV-30972', vendor: 'Delhi Suppliers', date: '09/01/25', time: '02:00 PM', amount: '₹18,500', status: 'irm' },
  ],
};

// ── Sales Orders ─────────────────────────────────────────────────────────────
export const MOCK_SALES_ORDERS = {
  summary: { total: '₹8,45,200', pending: 12, confirmed: 28, docs: 40 },
  orders: [
    { id: 'SO-00245', party: 'ABC Traders',       date: '11/01/25', time: '10:00 AM', amount: '₹52,000', status: 'confirmed' },
    { id: 'SO-00244', party: 'PQR Exports',        date: '11/01/25', time: '09:00 AM', amount: '₹34,000', status: 'pending' },
    { id: 'SO-00243', party: 'Kumar & Sons',       date: '10/01/25', time: '02:00 PM', amount: '₹28,500', status: 'confirmed' },
    { id: 'SO-00242', party: 'XYZ Retail',         date: '10/01/25', time: '11:00 AM', amount: '₹18,000', status: 'cancelled' },
    { id: 'SO-00241', party: 'Sharma Electronics', date: '09/01/25', time: '09:30 AM', amount: '₹65,000', status: 'confirmed' },
    { id: 'SO-00240', party: 'Delhi Suppliers',    date: '09/01/25', time: '04:00 PM', amount: '₹22,000', status: 'pending' },
  ],
};

// ── Quotations ────────────────────────────────────────────────────────────────
export const MOCK_QUOTATIONS = {
  summary: { total: '₹5,20,000', accepted: 8, pending: 14, docs: 22 },
  items: [
    { id: 'QT-00156', party: 'XYZ Retail',         date: '10/01/25', time: '11:00 AM', amount: '₹28,000', status: 'accepted' },
    { id: 'QT-00155', party: 'ABC Traders',         date: '10/01/25', time: '09:00 AM', amount: '₹45,000', status: 'pending' },
    { id: 'QT-00154', party: 'Kumar & Sons',        date: '09/01/25', time: '03:00 PM', amount: '₹32,000', status: 'accepted' },
    { id: 'QT-00153', party: 'PQR Exports',         date: '09/01/25', time: '10:00 AM', amount: '₹18,500', status: 'expired' },
    { id: 'QT-00152', party: 'Sharma Electronics',  date: '08/01/25', time: '02:00 PM', amount: '₹55,000', status: 'pending' },
    { id: 'QT-00151', party: 'Delhi Suppliers',     date: '08/01/25', time: '11:30 AM', amount: '₹12,000', status: 'accepted' },
  ],
};

// ── Credit Notes ──────────────────────────────────────────────────────────────
export const MOCK_CREDIT_NOTES = {
  summary: { total: '₹42,500', count: 8, docs: 8 },
  notes: [
    { id: 'CN-00712', party: 'ABC Traders',   date: '10/01/25', time: '09:00 AM', amount: '₹3,200',  status: 'issued',  ref: 'INV-30978' },
    { id: 'CN-00711', party: 'PQR Exports',   date: '09/01/25', time: '02:00 PM', amount: '₹8,500',  status: 'settled', ref: 'INV-30955' },
    { id: 'CN-00710', party: 'Kumar & Sons',  date: '08/01/25', time: '11:00 AM', amount: '₹12,000', status: 'issued',  ref: 'INV-30943' },
    { id: 'CN-00709', party: 'XYZ Retail',    date: '07/01/25', time: '10:30 AM', amount: '₹5,800',  status: 'settled', ref: 'INV-30930' },
    { id: 'CN-00708', party: 'Sharma Elec.',  date: '06/01/25', time: '03:00 PM', amount: '₹13,000', status: 'issued',  ref: 'INV-30921' },
  ],
};

// ── Delivery Notes ────────────────────────────────────────────────────────────
export const MOCK_DELIVERY_NOTES = {
  summary: { delivered: 28, in_transit: 6, pending: 4, docs: 38 },
  notes: [
    { id: 'DN-00234', party: 'Kumar & Sons',   date: '11/01/25', time: '10:30 AM', amount: '₹35,000', status: 'delivered' },
    { id: 'DN-00233', party: 'ABC Traders',    date: '11/01/25', time: '08:00 AM', amount: '₹42,500', status: 'in_transit' },
    { id: 'DN-00232', party: 'PQR Exports',    date: '10/01/25', time: '03:00 PM', amount: '₹28,000', status: 'delivered' },
    { id: 'DN-00231', party: 'XYZ Retail',     date: '10/01/25', time: '10:00 AM', amount: '₹15,000', status: 'pending' },
    { id: 'DN-00230', party: 'Sharma Elec.',   date: '09/01/25', time: '02:30 PM', amount: '₹62,000', status: 'delivered' },
    { id: 'DN-00229', party: 'Delhi Suppliers',date: '09/01/25', time: '09:00 AM', amount: '₹18,500', status: 'in_transit' },
  ],
};

// ── Purchase Orders ───────────────────────────────────────────────────────────
export const MOCK_PURCHASE_ORDERS = {
  summary: { total: '₹6,32,000', pending: 9, confirmed: 23, docs: 32 },
  orders: [
    { id: 'PO-00189', vendor: 'ABC Traders',      date: '11/01/25', time: '09:00 AM', amount: '₹45,000', status: 'confirmed' },
    { id: 'PO-00188', vendor: 'PQR Exports',       date: '11/01/25', time: '08:00 AM', amount: '₹32,000', status: 'pending' },
    { id: 'PO-00187', vendor: 'Kumar & Sons',      date: '10/01/25', time: '02:00 PM', amount: '₹28,500', status: 'received' },
    { id: 'PO-00186', vendor: 'XYZ Retail',        date: '10/01/25', time: '11:00 AM', amount: '₹18,000', status: 'confirmed' },
    { id: 'PO-00185', vendor: 'Sharma Electronics',date: '09/01/25', time: '10:00 AM', amount: '₹75,000', status: 'pending' },
    { id: 'PO-00184', vendor: 'Delhi Suppliers',   date: '09/01/25', time: '04:00 PM', amount: '₹22,000', status: 'received' },
  ],
};

// ── Debit Notes ───────────────────────────────────────────────────────────────
export const MOCK_DEBIT_NOTES = {
  summary: { total: '₹28,000', count: 5, docs: 5 },
  notes: [
    { id: 'DBN-00045', vendor: 'PQR Exports',     date: '10/01/25', time: '10:00 AM', amount: '₹8,500',  status: 'issued',  ref: 'INV-30977' },
    { id: 'DBN-00044', vendor: 'Delhi Suppliers',  date: '09/01/25', time: '03:00 PM', amount: '₹5,200',  status: 'settled', ref: 'INV-30960' },
    { id: 'DBN-00043', vendor: 'Kumar & Sons',     date: '08/01/25', time: '11:30 AM', amount: '₹7,300',  status: 'issued',  ref: 'INV-30948' },
    { id: 'DBN-00042', vendor: 'ABC Traders',      date: '07/01/25', time: '02:00 PM', amount: '₹7,000',  status: 'settled', ref: 'INV-30935' },
  ],
};

// ── Payment Vouchers ──────────────────────────────────────────────────────────
export const MOCK_PAYMENT_VOUCHERS = {
  summary: { total: '₹3,45,000', docs: 18 },
  items: [
    { id: 'PMT-00234', party: 'ABC Traders',     date: '11/01/25', time: '10:00 AM', amount: '₹45,000', method: 'NEFT',   status: 'cleared' },
    { id: 'PMT-00233', party: 'PQR Exports',     date: '11/01/25', time: '09:00 AM', amount: '₹28,000', method: 'RTGS',   status: 'cleared' },
    { id: 'PMT-00232', party: 'Kumar & Sons',    date: '10/01/25', time: '02:00 PM', amount: '₹15,000', method: 'Cash',   status: 'cleared' },
    { id: 'PMT-00231', party: 'Sharma Elec.',    date: '10/01/25', time: '11:00 AM', amount: '₹62,000', method: 'Cheque', status: 'pending' },
    { id: 'PMT-00230', party: 'Delhi Suppliers', date: '09/01/25', time: '03:00 PM', amount: '₹18,500', method: 'NEFT',   status: 'cleared' },
  ],
};

// ── Receipt Vouchers ──────────────────────────────────────────────────────────
export const MOCK_RECEIPT_VOUCHERS = {
  summary: { total: '₹5,20,000', docs: 24 },
  items: [
    { id: 'RCT-00312', party: 'Kumar & Sons',   date: '11/01/25', time: '11:00 AM', amount: '₹52,000', method: 'Cash',   status: 'received' },
    { id: 'RCT-00311', party: 'ABC Traders',    date: '11/01/25', time: '10:00 AM', amount: '₹42,500', method: 'NEFT',   status: 'received' },
    { id: 'RCT-00310', party: 'PQR Exports',    date: '10/01/25', time: '02:00 PM', amount: '₹28,000', method: 'Cheque', status: 'pending' },
    { id: 'RCT-00309', party: 'XYZ Retail',     date: '10/01/25', time: '11:30 AM', amount: '₹15,000', method: 'Cash',   status: 'received' },
    { id: 'RCT-00308', party: 'Sharma Elec.',   date: '09/01/25', time: '03:30 PM', amount: '₹62,000', method: 'RTGS',   status: 'received' },
  ],
};

// ── Journal Vouchers ──────────────────────────────────────────────────────────
export const MOCK_JOURNAL_VOUCHERS = {
  summary: { total: '₹1,28,000', docs: 12 },
  items: [
    { id: 'JNL-00089', narration: 'Depreciation entry - Jan 2025',  date: '11/01/25', time: '09:00 AM', debit: '₹15,000', credit: '₹15,000', status: 'posted' },
    { id: 'JNL-00088', narration: 'Interest accrual - Bank loan',   date: '10/01/25', time: '11:00 AM', debit: '₹8,200',  credit: '₹8,200',  status: 'posted' },
    { id: 'JNL-00087', narration: 'Prepaid expense adjustment',     date: '09/01/25', time: '02:00 PM', debit: '₹22,000', credit: '₹22,000', status: 'posted' },
    { id: 'JNL-00086', narration: 'Provision for bad debts',        date: '08/01/25', time: '10:30 AM', debit: '₹5,000',  credit: '₹5,000',  status: 'posted' },
    { id: 'JNL-00085', narration: 'Outstanding salary payable',     date: '08/01/25', time: '09:00 AM', debit: '₹48,000', credit: '₹48,000', status: 'posted' },
  ],
};

// ── Contra Vouchers ───────────────────────────────────────────────────────────
export const MOCK_CONTRA_VOUCHERS = {
  summary: { total: '₹80,000', docs: 6 },
  items: [
    { id: 'CTR-00023', narration: 'Cash to HDFC Bank transfer',     date: '10/01/25', time: '02:00 PM', amount: '₹20,000', from: 'Cash',      to: 'HDFC Bank', status: 'cleared' },
    { id: 'CTR-00022', narration: 'SBI to HDFC inter-bank',         date: '09/01/25', time: '11:00 AM', amount: '₹30,000', from: 'SBI',       to: 'HDFC Bank', status: 'cleared' },
    { id: 'CTR-00021', narration: 'Bank to cash withdrawal',        date: '08/01/25', time: '10:00 AM', amount: '₹10,000', from: 'HDFC Bank', to: 'Cash',      status: 'cleared' },
    { id: 'CTR-00020', narration: 'Cash deposit to SBI Current',    date: '07/01/25', time: '03:00 PM', amount: '₹20,000', from: 'Cash',      to: 'SBI',       status: 'cleared' },
  ],
};

// ── FY-Specific Dashboard Data ────────────────────────────────────────────────
export const FY_DASHBOARD: Record<string, {
  kpi: typeof MOCK_KPI_STRIP;
  metrics: typeof MOCK_METRICS;
  cashflow: typeof MOCK_CASHFLOW;
}> = {
  'FY 2025-26': {
    kpi: MOCK_KPI_STRIP,
    metrics: MOCK_METRICS,
    cashflow: MOCK_CASHFLOW,
  },
  'FY 2024-25': {
    kpi: [
      { id: 'cash',       label: 'Cash In Hand', amount: '₹8,20,000',  icon: 'cash-outline',             route: '/cash' },
      { id: 'bank',       label: 'Bank Balance', amount: '₹6,40,000',  icon: 'card-outline',             route: '/bank' },
      { id: 'receivable', label: 'Receivables',  amount: '₹2,80,000',  icon: 'arrow-down-circle-outline',route: '/receivables' },
      { id: 'payable',    label: 'Payables',     amount: '₹4,12,000',  icon: 'arrow-up-circle-outline',  route: '/payables' },
      { id: 'loans',      label: 'Loans & ODs',  amount: '₹2,10,000',  icon: 'git-merge-outline',        route: '/loans' },
      { id: 'payments',   label: 'Payments',     amount: '₹1,08,000',  icon: 'send-outline',             route: '/payments' },
      { id: 'receipts',   label: 'Receipts',     amount: '₹28,500',    icon: 'download-outline',         route: '/receipts' },
    ],
    metrics: [
      { id: 'expenses', label: 'Expenses', amount: '₹108.00',  change: 9.2,  positive: false, icon: 'trending-up-outline',  route: null },
      { id: 'sales',    label: 'Sales',    amount: '₹74,500',  change: 3.8,  positive: true,  icon: 'stats-chart-outline',   route: '/sales/register' },
      { id: 'purchases',label: 'Purchases',amount: '₹60,200',  change: 6.2,  positive: true,  icon: 'cart-outline',          route: '/purchase/register' },
    ],
    cashflow: { netCash: 16800, grossCash: 480.50, netRealisableBalance: 16200, grossProfit: 382000, netProfit: 104000, incomePercentage: 58, updatedAt: 'FY 2024-25' },
  },
  'FY 2023-24': {
    kpi: [
      { id: 'cash',       label: 'Cash In Hand', amount: '₹6,50,000',  icon: 'cash-outline',             route: '/cash' },
      { id: 'bank',       label: 'Bank Balance', amount: '₹5,10,000',  icon: 'card-outline',             route: '/bank' },
      { id: 'receivable', label: 'Receivables',  amount: '₹2,10,000',  icon: 'arrow-down-circle-outline',route: '/receivables' },
      { id: 'payable',    label: 'Payables',     amount: '₹3,20,000',  icon: 'arrow-up-circle-outline',  route: '/payables' },
      { id: 'loans',      label: 'Loans & ODs',  amount: '₹2,80,000',  icon: 'git-merge-outline',        route: '/loans' },
      { id: 'payments',   label: 'Payments',     amount: '₹82,000',    icon: 'send-outline',             route: '/payments' },
      { id: 'receipts',   label: 'Receipts',     amount: '₹22,000',    icon: 'download-outline',         route: '/receipts' },
    ],
    metrics: [
      { id: 'expenses', label: 'Expenses', amount: '₹85.00',   change: 7.1,  positive: false, icon: 'trending-up-outline',  route: null },
      { id: 'sales',    label: 'Sales',    amount: '₹58,000',  change: 2.4,  positive: true,  icon: 'stats-chart-outline',   route: '/sales/register' },
      { id: 'purchases',label: 'Purchases',amount: '₹46,500',  change: 4.1,  positive: true,  icon: 'cart-outline',          route: '/purchase/register' },
    ],
    cashflow: { netCash: 12400, grossCash: 366.80, netRealisableBalance: 12000, grossProfit: 298000, netProfit: 82000, incomePercentage: 48, updatedAt: 'FY 2023-24' },
  },
  'FY 2022-23': {
    kpi: [
      { id: 'cash',       label: 'Cash In Hand', amount: '₹4,80,000',  icon: 'cash-outline',             route: '/cash' },
      { id: 'bank',       label: 'Bank Balance', amount: '₹3,90,000',  icon: 'card-outline',             route: '/bank' },
      { id: 'receivable', label: 'Receivables',  amount: '₹1,60,000',  icon: 'arrow-down-circle-outline',route: '/receivables' },
      { id: 'payable',    label: 'Payables',     amount: '₹2,40,000',  icon: 'arrow-up-circle-outline',  route: '/payables' },
      { id: 'loans',      label: 'Loans & ODs',  amount: '₹3,20,000',  icon: 'git-merge-outline',        route: '/loans' },
      { id: 'payments',   label: 'Payments',     amount: '₹62,000',    icon: 'send-outline',             route: '/payments' },
      { id: 'receipts',   label: 'Receipts',     amount: '₹16,000',    icon: 'download-outline',         route: '/receipts' },
    ],
    metrics: [
      { id: 'expenses', label: 'Expenses', amount: '₹62.00',   change: 5.0,  positive: false, icon: 'trending-up-outline',  route: null },
      { id: 'sales',    label: 'Sales',    amount: '₹44,500',  change: 1.2,  positive: true,  icon: 'stats-chart-outline',   route: '/sales/register' },
      { id: 'purchases',label: 'Purchases',amount: '₹35,000',  change: 3.0,  positive: true,  icon: 'cart-outline',          route: '/purchase/register' },
    ],
    cashflow: { netCash: 9200, grossCash: 280.40, netRealisableBalance: 8900, grossProfit: 228000, netProfit: 62000, incomePercentage: 40, updatedAt: 'FY 2022-23' },
  },
};

export const QUICK_ACTIONS = [
  {
    id: 'sales',
    label: 'Sales',
    icon: 'trending-up',
    items: [
      { id: 'create_invoice',      label: 'Create Invoice',      route: '/sales/create-invoice' },
      { id: 'create_quotation',    label: 'Create Quotation',    route: '/sales/create-quotation' },
      { id: 'create_sales_order',  label: 'Create Sales Order',  route: '/sales/create-order' },
      { id: 'create_delivery_note',label: 'Create Delivery Note',route: '/sales/create-delivery-note' },
      { id: 'credit_note',         label: 'Credit Note',         route: '/sales/create-credit-note' },
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: 'cart',
    items: [
      { id: 'purchase_invoice', label: 'Purchase Invoice', route: '/purchase/create-invoice' },
      { id: 'purchase_order',   label: 'Purchase Order',   route: '/purchase/create-order' },
      { id: 'debit_note',       label: 'Debit Note',       route: '/purchase/create-debit-note' },
    ],
  },
  {
    id: 'voucher',
    label: 'Voucher',
    icon: 'card',
    items: [
      { id: 'payment_voucher', label: 'Payment Voucher', route: '/voucher/create?type=payment' },
      { id: 'receipt_voucher', label: 'Receipt Voucher', route: '/voucher/create?type=receipt' },
      { id: 'contra_voucher',  label: 'Contra Voucher',  route: '/voucher/create?type=contra' },
      { id: 'journal_voucher', label: 'Journal Voucher', route: '/voucher/create?type=journal' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'cube',
    items: [
      { id: 'stock_adjustment', label: 'Stock Adjustment', route: '/stocks/create-adjustment' },
      { id: 'stock_transfer',   label: 'Stock Transfer',   route: '/stocks/create-transfer' },
      { id: 'add_item',         label: 'Add Item',          route: '/stocks/create-item' },
      { id: 'add_warehouse',    label: 'Add Warehouse',     route: '/stocks/create-warehouse' },
    ],
  },
  {
    id: 'ledgers',
    label: 'Ledgers',
    icon: 'journal',
    items: [
      { id: 'sundry_creditors', label: 'Sundry Creditors', route: '/ledger/create?type=sundry_creditor' },
      { id: 'sundry_debtors',   label: 'Sundry Debtors',   route: '/ledger/create?type=sundry_debtor' },
      { id: 'duties_taxes',     label: 'Duties & Taxes',   route: '/ledger/create?type=duties_taxes' },
      { id: 'custom_groups',    label: 'Custom Groups',     route: '/ledger/create?type=custom' },
    ],
  },
];
