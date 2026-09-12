/**
 * Client-side scope filters for pickers (backend remains authority).
 */
export type ScopeBag = {
  companies?: string[];
  financialYears?: string[];
  ledgers?: string[];
  godowns?: string[];
  costCentres?: string[];
};

function asList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'object') {
    // shapes: { guids: [] } | { allow: [] } | { names: [] }
    const nested = raw.guids || raw.allow || raw.names || raw.ids || [];
    return Array.isArray(nested) ? nested.map(String).filter(Boolean) : [];
  }
  return [];
}

export function normalizeScopes(scopes: any): ScopeBag {
  if (!scopes || typeof scopes !== 'object') return {};
  return {
    companies: asList(scopes.companies || scopes.companyGuids),
    financialYears: asList(scopes.financialYears || scopes.fys || scopes.fy),
    ledgers: asList(scopes.ledgers || scopes.ledgerGuids || scopes.parties),
    godowns: asList(scopes.godowns || scopes.godownGuids || scopes.warehouses),
    costCentres: asList(scopes.costCentres || scopes.cost_centres),
  };
}

/** Empty allow-list means unrestricted (Owner / no scope rows). */
export function filterByScopeGuidsOrNames<T extends Record<string, any>>(
  items: T[],
  allow: string[] | undefined,
  fields: string[] = ['guid', 'id', 'name', 'ledger_name', 'party_name']
): T[] {
  if (!allow || allow.length === 0) return items;
  const set = new Set(allow.map((x) => String(x).toLowerCase()));
  return items.filter((item) =>
    fields.some((f) => {
      const v = item?.[f];
      return v != null && set.has(String(v).toLowerCase());
    })
  );
}
