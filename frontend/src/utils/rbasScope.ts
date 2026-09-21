/**
 * Client-side scope filters for pickers (backend remains authority).
 */
export type ScopeBag = {
  companies?: string[];
  financialYears?: string[];
  ledgers?: string[];
  godowns?: string[];
  costCentres?: string[];
  /** When set, ALL → unrestricted; NONE → deny all; SELECTED → allow-list. */
  modes?: {
    companies?: string;
    financialYears?: string;
    ledgers?: string;
    godowns?: string;
    costCentres?: string;
  };
};

function tokenFromEntry(entry: any): string | null {
  if (entry == null) return null;
  if (typeof entry === 'string' || typeof entry === 'number') {
    const s = String(entry).trim();
    return s && s !== '[object Object]' ? s : null;
  }
  if (typeof entry === 'object') {
    const v =
      entry.guid ??
      entry.id ??
      entry.ledger_guid ??
      entry.ledgerGuid ??
      entry.godown_guid ??
      entry.godownGuid ??
      entry.cost_centre_guid ??
      entry.costCentreGuid ??
      entry.company_guid ??
      entry.companyGuid ??
      entry.fy_key ??
      entry.fyKey ??
      entry.ledger_name ??
      entry.ledgerName ??
      entry.godown_name ??
      entry.godownName ??
      entry.cost_centre_name ??
      entry.costCentreName ??
      entry.name ??
      entry.label;
    if (v == null) return null;
    const s = String(v).trim();
    return s && s !== '[object Object]' ? s : null;
  }
  return null;
}

function asList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(tokenFromEntry).filter((x): x is string => !!x);
  }
  if (typeof raw === 'object') {
    // shapes: { guids: [] } | { allow: [] } | { names: [] } | single row object
    const nested = raw.guids || raw.allow || raw.names || raw.ids;
    if (Array.isArray(nested)) {
      return nested.map(tokenFromEntry).filter((x): x is string => !!x);
    }
    const one = tokenFromEntry(raw);
    return one ? [one] : [];
  }
  return [];
}

function modeOf(policy: any, key: string): string {
  const m = String(policy?.[key] || '').toUpperCase();
  return m === 'ALL' || m === 'NONE' || m === 'SELECTED' ? m : '';
}

export function normalizeScopes(scopes: any): ScopeBag {
  if (!scopes || typeof scopes !== 'object') return {};
  const policy = scopes.policy || {};
  return {
    companies: asList(scopes.companies || scopes.companyGuids),
    financialYears: asList(scopes.financialYears || scopes.fys || scopes.fy),
    ledgers: asList(scopes.ledgers || scopes.ledgerGuids || scopes.parties),
    godowns: asList(scopes.godowns || scopes.godownGuids || scopes.warehouses),
    costCentres: asList(scopes.costCentres || scopes.cost_centres),
    modes: {
      companies: modeOf(policy, 'company_mode'),
      financialYears: modeOf(policy, 'fy_mode'),
      ledgers: modeOf(policy, 'ledger_mode'),
      godowns: modeOf(policy, 'godown_mode'),
      costCentres: modeOf(policy, 'cost_centre_mode'),
    },
  };
}

/** Empty allow-list means unrestricted (Owner / ALL mode / no scope rows). */
export function filterByScopeGuidsOrNames<T extends Record<string, any>>(
  items: T[],
  allow: string[] | undefined,
  fields: string[] = ['guid', 'id', 'name', 'ledger_name', 'party_name'],
  mode?: string
): T[] {
  const m = String(mode || '').toUpperCase();
  if (m === 'ALL') return items;
  if (m === 'NONE') return [];
  if (!allow || allow.length === 0) return items; // SELECTED with no rows, or legacy
  const set = new Set(allow.map((x) => String(x).toLowerCase()));
  return items.filter((item) =>
    fields.some((f) => {
      const v = item?.[f];
      return v != null && set.has(String(v).toLowerCase());
    })
  );
}
