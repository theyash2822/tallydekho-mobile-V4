/** companies.guid = Tally identity. companies.id = internal DB id. Never compare them as equals. */

export function companyGuid(c: { guid?: string | null; id?: string | number | null } | null | undefined): string {
  const g = String(c?.guid ?? '').trim();
  return g;
}

export function companyInternalId(c: { id?: string | number | null } | null | undefined): string {
  if (c?.id == null || c.id === '') return '';
  return String(c.id).trim();
}

/** External identity for selection/cache. Prefer guid; fall back to id only when guid is absent. */
export function companyExternalId(c: { guid?: string | null; id?: string | number | null } | null | undefined): string {
  return companyGuid(c) || companyInternalId(c);
}

export function sameCompany(
  a: { guid?: string | null; id?: string | number | null } | null | undefined,
  b: { guid?: string | null; id?: string | number | null } | null | undefined,
): boolean {
  if (!a || !b) return false;
  const ga = companyGuid(a);
  const gb = companyGuid(b);
  if (ga && gb) return ga === gb;
  if (ga && !gb) return ga === companyInternalId(b);
  if (!ga && gb) return companyInternalId(a) === gb;
  const ia = companyInternalId(a);
  const ib = companyInternalId(b);
  return !!ia && ia === ib;
}

export function companyInList(
  current: { guid?: string | null; id?: string | number | null } | null | undefined,
  list: { guid?: string | null; id?: string | number | null }[],
): boolean {
  if (!current) return false;
  return (list || []).some((row) => sameCompany(current, row));
}

export function toAuthCompany(c: any): { guid: string; name: string; gstin?: string | null; is_demo?: boolean } | null {
  const guid = companyExternalId(c);
  if (!guid) return null;
  return {
    guid,
    name: String(c?.name || ''),
    gstin: c?.gstin ?? null,
    is_demo: c?.is_demo === true || c?.isDemo === true,
  };
}
