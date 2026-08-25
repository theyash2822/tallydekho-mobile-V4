/**
 * Client-side fallback when API returns blank nature
 * (mirrors td-backend/src/utils/ledgerNature.js reserved-group map).
 */
const RULES: Array<{ nature: 'Assets' | 'Liabilities' | 'Income' | 'Expense'; keys: string[] }> = [
  {
    nature: 'Assets',
    keys: [
      'current assets', 'fixed assets', 'investments', 'misc. expenses (asset)',
      'stock-in-hand', 'cash-in-hand', 'bank accounts', 'bank account',
      'deposits (asset)', 'loans & advances (asset)', 'sundry debtors',
      'branch / divisions', 'debtor',
    ],
  },
  {
    nature: 'Liabilities',
    keys: [
      'current liabilities', 'loans (liability)', 'capital account',
      'reserves & surplus', 'duties & taxes', 'provisions', 'sundry creditors',
      'bank od', 'secured loans', 'unsecured loans', 'suspense a/c',
      'creditor', 'liabilit', 'capital',
    ],
  },
  {
    nature: 'Income',
    keys: ['sales accounts', 'sales account', 'direct incomes', 'direct income', 'indirect incomes', 'indirect income', 'income', 'revenue'],
  },
  {
    nature: 'Expense',
    keys: ['purchase accounts', 'purchase account', 'direct expenses', 'direct expense', 'indirect expenses', 'indirect expense', 'expense', 'purchase'],
  },
];

function norm(s: string) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function inferNatureFromGroup(groupName: string, storedNature?: string | null): string {
  const stored = String(storedNature || '').trim();
  if (stored) {
    const n = stored.toLowerCase();
    if (n.startsWith('asset')) return 'Assets';
    if (n.startsWith('liab')) return 'Liabilities';
    if (n.startsWith('income')) return 'Income';
    if (n.startsWith('expense')) return 'Expense';
    return stored;
  }
  const g = norm(groupName);
  if (!g) return '';
  for (const rule of RULES) {
    if (rule.keys.some(k => g === k || g.includes(k))) return rule.nature;
  }
  return '';
}
