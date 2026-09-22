/**
 * Tenant-owned AsyncStorage keys.
 * A Tally GUID is unique only inside a workspace — never key business data by GUID alone.
 */
export type TenantKeyParts = {
  userId?: string | number | null;
  workspaceId?: string | null;
  companyGuid?: string | null;
  feature: string;
};

export function tenantKey({ userId, workspaceId, companyGuid, feature }: TenantKeyParts): string {
  const u = userId != null && String(userId) !== '' ? String(userId) : 'anon';
  const w = workspaceId ? String(workspaceId) : 'no-ws';
  const c = companyGuid ? String(companyGuid) : 'no-co';
  return `td:u:${u}:ws:${w}:co:${c}:${feature}`;
}

export const TENANT_KEY_PREFIX = /^td:u:/;

/** Legacy keys that must still be swept on logout. Never adopt as current-tenant state. */
export const LEGACY_TENANT_KEY_PATTERNS: RegExp[] = [
  /^ws:/,
  /^company_/,
  /_prefill_/,
  /^draft_/,
  /_draft_/,
  /^tdk_/,
  /^tdinvoice_/,
  /^tdproforma_/,
  /^tdso_/,
  /^tdpo_/,
  /^tdprf_/,
  /^userSettings$/,
  /^voucherConfig$/,
  /^cashflow_period$/,
  /^td_help_chat_/,
  /^selected_fy$/,
  /^pre_auth_token$/,
];

export const LOGOUT_ALWAYS_REMOVE = [
  'auth_token',
  'user_data',
  'is_paired',
  'user_info',
  'active_workspace_id',
  'active_workspace_manual_pin',
  'company_data',
  'pre_auth_token',
];

export function isTenantStorageKey(key: string): boolean {
  if (TENANT_KEY_PREFIX.test(key)) return true;
  return LEGACY_TENANT_KEY_PATTERNS.some((re) => re.test(key));
}

/** GUID-only drafts that cannot be attributed to a workspace. */
export function isAmbiguousLegacyDraftKey(key: string): boolean {
  if (TENANT_KEY_PREFIX.test(key)) return false;
  return /^(tdinvoice_draft_|tdproforma_draft_)/.test(key) || /_draft_[0-9a-f-]{8}/i.test(key);
}

export function draftFeature(kind: 'invoice' | 'proforma'): string {
  return kind === 'proforma' ? 'proforma_draft' : 'invoice_draft';
}

export function logoFeature(): string {
  return 'company_logo';
}

export function prefillFeature(kind: 'tdso' | 'tdpo' | 'tdprf'): string {
  return `${kind}_to_invoice_prefill`;
}

/** Low Stock screen → Purchase Order line prefill (qty 0, rate from stock). */
export function lowStockToPoPrefillFeature(): string {
  return 'low_stock_to_po_prefill';
}

export function fyFeature(): string {
  return 'selected_fy';
}

export function companySelectionFeature(): string {
  return 'company_data';
}

let _ctxUserId: string | number | null = null;
let _ctxWorkspaceId: string | null = null;

export function setTenantKeyContext(
  userId?: string | number | null,
  workspaceId?: string | null,
  mode: 'both' | 'user' | 'workspace' = 'both',
) {
  if (mode === 'both' || mode === 'user') _ctxUserId = userId ?? null;
  if (mode === 'both' || mode === 'workspace') _ctxWorkspaceId = workspaceId ?? null;
}

export function currentTenantKey(companyGuid: string | null | undefined, feature: string): string {
  return tenantKey({
    userId: _ctxUserId,
    workspaceId: _ctxWorkspaceId,
    companyGuid,
    feature,
  });
}

export function wouldSweepKey(key: string): boolean {
  return LOGOUT_ALWAYS_REMOVE.includes(key) || isTenantStorageKey(key) || isAmbiguousLegacyDraftKey(key);
}

export async function dropLegacyKeys(keys: string[]): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length) await AsyncStorage.multiRemove(unique);
}
