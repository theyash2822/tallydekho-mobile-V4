/**
 * Company data revision seen by this app. The backend sends `X-Data-Revision` on company reads and
 * `revision` on `synced`; a screen assembled from responses of different revisions mixes data from
 * before and after a sync, so:
 *  - a response older than one already seen is fetched again once;
 *  - a newer revision means everything on screen is stale → listeners refresh it.
 */
export const DATA_REVISION_HEADER = 'X-Data-Revision';

export type RevisionOutcome = 'first' | 'same' | 'older' | 'newer';
type NewerRevision = { workspaceId: string | null; companyGuid: string; revision: number };

const seen = new Map<string, number>();
const listeners = new Set<(e: NewerRevision) => void>();

const keyOf = (workspaceId: string | null, companyGuid: string) => `${workspaceId || ''}::${companyGuid}`;

export function parseRevision(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** Records the highest revision seen. `silent` skips listeners (the caller already refreshes). */
export function noteRevision(
  workspaceId: string | null,
  companyGuid: string | null | undefined,
  revision: unknown,
  { silent = false }: { silent?: boolean } = {},
): RevisionOutcome {
  const rev = parseRevision(revision);
  if (!companyGuid || rev == null) return 'same';
  const key = keyOf(workspaceId, companyGuid);
  const prev = seen.get(key);
  if (prev == null) {
    seen.set(key, rev);
    return 'first';
  }
  if (rev === prev) return 'same';
  if (rev < prev) return 'older';
  seen.set(key, rev);
  if (silent) return 'newer';
  for (const fn of [...listeners]) {
    try { fn({ workspaceId, companyGuid, revision: rev }); } catch { /* a listener must not break the request */ }
  }
  return 'newer';
}

export function onNewerRevision(fn: (e: NewerRevision) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function companyGuidOf(endpoint: string): string | null {
  const q = String(endpoint || '').split('?')[1];
  if (!q) return null;
  return new URLSearchParams(q).get('companyGuid') || null;
}

export function resetDataRevisions() {
  seen.clear();
}
