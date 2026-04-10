// ============================================================
// TallyDekho — Single Source of Truth for Mock / Static Data
// When API is available, this file is auto-bypassed by api.ts
// ============================================================

export const MOCK_USER = {
  id: 'user_001',
  name: 'Ashish Agarwal',
  phone: '+91 96722 22367',
  company: 'The Y.K Industries Private Limited',
  gstin: '27ABCDE1234F1Z5',
  fyYear: 'FY 2025-26',
};

export const MOCK_KPI_STRIP = [
  { id: 'cash', label: 'Cash In Hand', amount: '₹10,00,000', icon: 'cash-outline', route: '/cash' },
  { id: 'bank', label: 'Bank Balance', amount: '₹8,00,000', icon: 'card-outline', route: '/bank' },
  { id: 'receivable', label: 'Receivables', amount: '₹3,50,000', icon: 'arrow-down-circle-outline', route: '/receivables' },
  { id: 'payable', label: 'Payables', amount: '₹5,61,500', icon: 'arrow-up-circle-outline', route: '/payables' },
  { id: 'loans', label: 'Loans & ODs', amount: '₹1,62,500', icon: 'git-merge-outline', route: '/loans' },
  { id: 'payments', label: 'Payments', amount: '₹1,36,000', icon: 'send-outline', route: '/payments' },
  { id: 'receipts', label: 'Receipts', amount: '₹36,000', icon: 'download-outline', route: '/receipts' },
];

export const MOCK_METRICS = [
  { id: 'expenses', label: 'Expenses', amount: '₹130.00', change: 12.0, positive: false, icon: 'trending-up-outline' },
  { id: 'sales', label: 'Sales', amount: '₹130.00', change: 5.1, positive: true, icon: 'stats-chart-outline' },
  { id: 'purchases', label: 'Purchases', amount: '₹130.00', change: 8.7, positive: true, icon: 'people-outline' },
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

export const QUICK_ACTIONS = [
  {
    id: 'sales',
    label: 'Sales',
    icon: 'trending-up',
    items: [
      { id: 'create_invoice', label: 'Create Invoice', route: '/sales/invoice' },
      { id: 'create_quotation', label: 'Create Quotation', route: '/sales/quotation' },
      { id: 'create_sales_order', label: 'Create Sales Orders', route: '/sales/order' },
      { id: 'create_delivery_note', label: 'Create Delivery Note', route: '/sales/delivery-note' },
      { id: 'credit_note', label: 'Credit Note', route: '/sales/credit-note' },
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: 'cart',
    items: [
      { id: 'purchase_invoice', label: 'Purchase Invoice', route: '/purchase/invoice' },
      { id: 'purchase_order', label: 'Purchase Order', route: '/purchase/order' },
      { id: 'debit_note', label: 'Debit Note', route: '/purchase/debit-note' },
    ],
  },
  {
    id: 'voucher',
    label: 'Voucher',
    icon: 'card',
    items: [
      { id: 'payment_voucher', label: 'Payment Voucher', route: '/voucher/payment' },
      { id: 'receipt_voucher', label: 'Receipt Voucher', route: '/voucher/receipt' },
      { id: 'contra_voucher', label: 'Contra Voucher', route: '/voucher/contra' },
      { id: 'journal_voucher', label: 'Journal Voucher', route: '/voucher/journal' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'cube',
    items: [
      { id: 'stock_adjustment', label: 'Stock Adjustment', route: '/inventory/adjustment' },
      { id: 'stock_transfer', label: 'Stock Transfer', route: '/inventory/transfer' },
      { id: 'add_item', label: 'Add Item', route: '/inventory/add-item' },
      { id: 'add_warehouse', label: 'Add Warehouse', route: '/inventory/add-warehouse' },
    ],
  },
  {
    id: 'ledgers',
    label: 'Ledgers',
    icon: 'journal',
    items: [
      { id: 'sundry_creditors', label: 'Sundry Creditors', route: '/ledger/creditors' },
      { id: 'sundry_debtors', label: 'Sundry Debtors', route: '/ledger/debtors' },
      { id: 'duties_taxes', label: 'Duties & Taxes', route: '/ledger/duties' },
      { id: 'custom_groups', label: 'Custom Groups', route: '/ledger/custom' },
    ],
  },
];
