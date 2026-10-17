// Desktop removal of a company or year (DC-15): every open form closes, the app returns
// Home and tells the user the data was refreshed. An ordinary sync leaves forms alone.
// No React Native imports: the root layout injects navigation, loading and toasts.

export const DATA_REFRESHED_MESSAGE = 'Data has been refreshed';
export const NO_DATA_MESSAGE = 'No data available';

export type ScopeRemovedPayload = {
  companyGuid?: string;
  reason?: string;
  removedGuids?: string[];
  workspaceId?: string;
  held?: HeldEntries[];
};

type Listener = (payload: ScopeRemovedPayload) => void;
const listeners = new Set<Listener>();

export function isRemovalSync(payload: ScopeRemovedPayload | null | undefined): boolean {
  return payload?.reason === 'companies_removed';
}

export function onScopeRemoved(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyScopeRemoved(payload: ScopeRemovedPayload): void {
  for (const listener of [...listeners]) {
    try { listener(payload); } catch { /* one screen must not stop the others */ }
  }
}

export type HeldEntries = { companyGuid?: string; count: number; mode?: string; purgeDueAt: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Seconds since epoch → "9 Nov 2026" in India time. */
export function formatDeadline(epochSeconds: number): string {
  const d = new Date(Number(epochSeconds) * 1000 + 330 * 60 * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** What happens to entries that were queued for a removed company. */
export function heldEntriesNote(held: HeldEntries[] | undefined, nowMs = Date.now()): string {
  if (!Array.isArray(held) || !held.length) return '';
  return held.map((h) => {
    const n = Number(h.count) || 0;
    const entries = `${n} queued ${n === 1 ? 'entry' : 'entries'}`;
    if (h.mode === 'complete' || Number(h.purgeDueAt) * 1000 <= nowMs) {
      return `${entries} for a removed company can no longer be sent to Tally.`;
    }
    return `${entries} will be sent only if the company is selected and synced again before ${formatDeadline(h.purgeDueAt)}.`;
  }).join(' ');
}

/** Draft keys of one workspace: td:u:<user>:ws:<workspace>:co:<company>:<kind>_draft */
export function isWorkspaceDraftKey(key: string, workspaceId: string | null | undefined): boolean {
  if (!workspaceId) return false;
  return key.startsWith('td:u:') && key.includes(`:ws:${workspaceId}:co:`) && key.endsWith('_draft');
}

export function refreshedMessage(remaining: unknown, held?: HeldEntries[], nowMs = Date.now()): string {
  const base = Array.isArray(remaining) && remaining.length > 0 ? DATA_REFRESHED_MESSAGE : NO_DATA_MESSAGE;
  const note = heldEntriesNote(held, nowMs);
  return note ? `${base}. ${note}` : base;
}

export type ScopeRemovedDeps = {
  closeForms: () => void;
  /** Forms closed by a removal must not come back as drafts (DC-21). */
  clearDrafts?: () => Promise<unknown> | void;
  goHome: () => void;
  loadCompanies: () => Promise<unknown[]>;
  toast: (message: string) => void;
  held?: HeldEntries[];
};

/** Close forms and go Home first; the message reflects what is left after reloading. */
export async function handleScopeRemoved(deps: ScopeRemovedDeps): Promise<string> {
  try { deps.closeForms(); } catch { /* nothing to dismiss */ }
  try { await deps.clearDrafts?.(); } catch { /* storage unavailable */ }
  deps.goHome();
  let remaining: unknown[] = [];
  try { remaining = await deps.loadCompanies(); } catch { remaining = []; }
  const message = refreshedMessage(remaining, deps.held);
  deps.toast(message);
  return message;
}
