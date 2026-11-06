// My Access, shared rules with the web portal: every value is a human label (translated), never a raw
// backend key, GUID or status code.

export type Translate = (key: string, options?: Record<string, unknown>) => string;

const K = 'screens.settingsMyAccess.';

/** 'PENDING_APPROVAL' → 'Pending approval'. */
export function sentenceCase(raw: unknown): string {
  const text = String(raw ?? '').replace(/_/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function tallyLabel(pairingStatus: string | null | undefined, t: Translate): string {
  const status = String(pairingStatus || '').toUpperCase();
  if (status === 'CONNECTED') return t(`${K}tallyConnected`);
  if (status === 'RECONNECTING') return t(`${K}tallyWaiting`);
  return t(`${K}tallyNotPaired`);
}

export function dataLabel(demoMode: boolean, t: Translate): string {
  return t(`${K}${demoMode ? 'demoMode' : 'liveData'}`);
}

/** No status reads Active: the server only returns access for a working membership. */
export function membershipStatusLabel(status: string | null | undefined, t: Translate): string {
  const value = String(status || 'ACTIVE');
  const upper = value.toUpperCase();
  if (upper === 'ACTIVE') return t(`${K}statusActive`);
  if (upper === 'SUSPENDED') return t(`${K}statusSuspended`);
  return sentenceCase(value);
}

export function roleLabel(isOwner: boolean, roleDisplayName: string | null | undefined, t: Translate): string {
  if (isOwner) return t(`${K}owner`);
  return roleDisplayName || t(`${K}member`);
}

export function entryModeLabel(mode: string | null | undefined, t: Translate): string {
  const value = String(mode || 'BOTH').toUpperCase();
  if (value === 'BOTH') return t(`${K}entryBoth`);
  if (value === 'REGULAR' || value === 'REGULAR_ONLY') return t(`${K}entryRegularOnly`);
  if (value === 'OPTIONAL' || value === 'OPTIONAL_ONLY') return t(`${K}entryOptionalOnly`);
  if (value === 'NONE') return t(`${K}none`);
  return sentenceCase(value);
}

/** Modules in display order, each opened by its view capability. */
export const ACCESS_MODULES: { cap: string; labelKey: string }[] = [
  { cap: 'dashboard.view', labelKey: 'moduleDashboard' },
  { cap: 'sales.view', labelKey: 'moduleSales' },
  { cap: 'purchase.view', labelKey: 'modulePurchase' },
  { cap: 'vouchers.view', labelKey: 'moduleVouchers' },
  { cap: 'inventory.view', labelKey: 'moduleInventory' },
  { cap: 'expenses.view', labelKey: 'moduleExpenses' },
  { cap: 'financials.view', labelKey: 'moduleFinancials' },
  { cap: 'compliance.view', labelKey: 'moduleCompliance' },
  { cap: 'ledgers.view', labelKey: 'moduleLedgers' },
  { cap: 'audit_trail.view', labelKey: 'moduleAuditTrail' },
  { cap: 'ai_insights.view', labelKey: 'moduleAiInsights' },
];

export type ModuleRow = { cap: string; label: string; open: boolean };

export function moduleRows(isOwner: boolean, can: (cap: string) => boolean, t: Translate): ModuleRow[] {
  return ACCESS_MODULES.map(({ cap, labelKey }) => ({ cap, label: t(`${K}${labelKey}`), open: isOwner || can(cap) }));
}

/** Key in `access.scopes`, prefix of its policy mode and object fields, label. */
const SCOPES: { key: string; prefix: string; labelKey: string }[] = [
  { key: 'companies', prefix: 'company', labelKey: 'scopeCompanies' },
  { key: 'financialYears', prefix: 'fy', labelKey: 'scopeFinancialYears' },
  { key: 'ledgers', prefix: 'ledger', labelKey: 'scopeLedgers' },
  { key: 'godowns', prefix: 'godown', labelKey: 'scopeGodowns' },
  { key: 'costCentres', prefix: 'cost_centre', labelKey: 'scopeCostCentres' },
];

export const SCOPE_CHIP_LIMIT = 12;

/** One listed scope entry; `named` is false when only its id is known. */
export type ScopeChip = { text: string; named: boolean };

export type ScopeRow = {
  key: string;
  label: string;
  /** 'All' or 'None'; null when the names are listed instead. */
  value: string | null;
  names: string[];
  /** '+N more' after the first SCOPE_CHIP_LIMIT names. */
  more: string | null;
  /** Every listed entry, so the app can show a placeholder instead of an id. */
  chips: ScopeChip[];
};

export type CompanyRef = { guid?: string | null; name?: string | null };

function scopeEntry(item: unknown, prefix: string, companyNames: Map<string, string> | null): ScopeChip {
  if (typeof item === 'string' || typeof item === 'number') {
    const text = String(item);
    // Outside the company scope a plain value is its own label (a financial year).
    if (!companyNames) return { text, named: true };
    const name = companyNames.get(text);
    return { text: name || text, named: !!name };
  }
  if (item && typeof item === 'object') {
    const row = item as Record<string, unknown>;
    const id = row[`${prefix}_guid`];
    const name = row[`${prefix}_name`] || row.name || (id ? companyNames?.get(String(id)) : undefined);
    if (name) return { text: String(name), named: true };
    return { text: id ? String(id) : '', named: false };
  }
  return { text: '', named: false };
}

/** Reads the raw `access.scopes` (names and policy modes), not the GUID-only normalised scope bag. */
export function scopeRows(rawScopes: unknown, isOwner: boolean, companies: CompanyRef[], t: Translate): ScopeRow[] {
  const scopes = (rawScopes && typeof rawScopes === 'object' ? rawScopes : {}) as Record<string, any>;
  const policy = (scopes.policy && typeof scopes.policy === 'object' ? scopes.policy : {}) as Record<string, unknown>;
  const companyNames = new Map<string, string>();
  for (const c of companies) {
    if (c?.guid && c?.name) companyNames.set(String(c.guid), String(c.name));
  }
  return SCOPES.map(({ key, prefix, labelKey }) => {
    const items: unknown[] = Array.isArray(scopes[key]) ? scopes[key] : [];
    const entries = items
      .map((item) => scopeEntry(item, prefix, key === 'companies' ? companyNames : null))
      .filter((entry) => entry.text);
    const names = entries.map((entry) => entry.text);
    const mode = String(policy[`${prefix}_mode`] || '').toUpperCase();
    let value: string | null = null;
    if (isOwner || mode === 'ALL' || (!mode && !names.length)) value = t(`${K}all`);
    else if (mode === 'NONE' || !names.length) value = t(`${K}none`);
    const listed = value ? [] : names;
    return {
      key,
      label: t(`${K}${labelKey}`),
      value,
      names: listed.slice(0, SCOPE_CHIP_LIMIT),
      more: listed.length > SCOPE_CHIP_LIMIT ? t(`${K}moreCount`, { count: listed.length - SCOPE_CHIP_LIMIT }) : null,
      chips: value ? [] : entries,
    };
  });
}

/** Known policies in display order; any other key follows alphabetically. */
const SENSITIVE_POLICIES: [string, string][] = [
  ['cost_price', 'sensitiveCostPrice'],
  ['inventory_valuation', 'sensitiveInventoryValuation'],
  ['margin', 'sensitiveMargin'],
  ['bank_balance', 'sensitiveBankBalance'],
  ['cash_balance', 'sensitiveCashBalance'],
  ['credit_limit', 'sensitiveCreditLimit'],
  ['tax_identity', 'sensitiveTaxIdentity'],
  ['purchase_values', 'sensitivePurchaseValues'],
];

export type LabelValue = { key: string; label: string; value: string };

/** 'default' is the one summary row shown when the role sets no per-field policy. */
export type SensitiveLevel = 'visible' | 'masked' | 'hidden' | 'default';
export type SensitiveRow = LabelValue & { level: SensitiveLevel };

function visibilityLevel(raw: unknown): Exclude<SensitiveLevel, 'default'> {
  if (raw === true || raw === 'VISIBLE') return 'visible';
  if (raw === 'MASKED') return 'masked';
  return 'hidden';
}

function sensitiveRow(key: string, label: string, raw: unknown, t: Translate): SensitiveRow {
  const level = visibilityLevel(raw);
  return { key, label, value: t(`${K}${level}`), level };
}

export function sensitivePolicyRows(
  policies: Record<string, unknown> | null | undefined,
  isOwnerOrAdmin: boolean,
  t: Translate,
): SensitiveRow[] {
  const all = policies || {};
  const present = Object.keys(all);
  if (!present.length) {
    return [{
      key: 'default',
      label: t(`${K}sensitiveFields`),
      value: t(`${K}${isOwnerOrAdmin ? 'visibleDefault' : 'followsRolePolicy'}`),
      level: 'default',
    }];
  }
  const known = new Set(SENSITIVE_POLICIES.map(([key]) => key));
  return [
    ...SENSITIVE_POLICIES
      .filter(([key]) => present.includes(key))
      .map(([key, labelKey]) => sensitiveRow(key, t(`${K}${labelKey}`), all[key], t)),
    ...present
      .filter((key) => !known.has(key))
      .sort()
      .map((key) => sensitiveRow(key, sentenceCase(key), all[key], t)),
  ];
}

export type MyAccessInput = {
  isOwner: boolean;
  isOwnerOrAdmin: boolean;
  workspaceName?: string | null;
  companyName?: string | null;
  pairingStatus?: string | null;
  demoMode: boolean;
  membershipStatus?: string | null;
  roleDisplayName?: string | null;
  entryMode?: string | null;
  can: (cap: string) => boolean;
  /** Raw `access.scopes` from the workspace context. */
  scopes?: unknown;
  /** Companies the app knows, to show company scope GUIDs by name. */
  companies?: CompanyRef[];
  sensitivePolicies?: Record<string, unknown> | null;
};

export type MyAccessView = {
  workspace: LabelValue[];
  role: LabelValue[];
  roleHint: string;
  modules: ModuleRow[];
  scopes: ScopeRow[];
  sensitive: SensitiveRow[];
  sensitiveHint: string;
  footnote: string;
};

export function buildMyAccessView(input: MyAccessInput, t: Translate): MyAccessView {
  const { isOwner, isOwnerOrAdmin } = input;
  return {
    workspace: [
      { key: 'name', label: t(`${K}name`), value: input.workspaceName || '—' },
      { key: 'company', label: t(`${K}company`), value: input.companyName || '—' },
      { key: 'tally', label: 'Tally', value: tallyLabel(input.pairingStatus, t) },
      { key: 'data', label: t(`${K}data`), value: dataLabel(input.demoMode, t) },
      { key: 'status', label: t(`${K}status`), value: membershipStatusLabel(input.membershipStatus, t) },
    ],
    role: [
      { key: 'role', label: t(`${K}role`), value: roleLabel(isOwner, input.roleDisplayName, t) },
      { key: 'entryMode', label: t(`${K}entryMode`), value: entryModeLabel(input.entryMode, t) },
      ...(isOwner ? [] : [{ key: 'creditsBilling', label: t(`${K}creditsBilling`), value: t(`${K}managedByOwner`) }]),
    ],
    roleHint: t(`${K}${isOwnerOrAdmin ? 'ownerHint' : 'memberHint'}`),
    modules: moduleRows(isOwner, input.can, t),
    scopes: scopeRows(input.scopes, isOwner, input.companies || [], t),
    sensitive: sensitivePolicyRows(input.sensitivePolicies, isOwnerOrAdmin, t),
    sensitiveHint: t(`${K}sensitiveHint`),
    footnote: t(`${K}${isOwner ? 'footnoteOwner' : 'footnoteMember'}`),
  };
}
