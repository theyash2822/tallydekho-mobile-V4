/**
 * Which socket events belong to one workspace, and whether a given payload is
 * addressed to the workspace the user currently has open.
 *
 * Deliberately free of any React Native / Expo import so it can be exercised
 * directly by scripts/verify-workspace-isolation.mjs.
 */

/**
 * Events that describe the state of a single workspace. A user who owns
 * workspace ABC and is a member of workspace XYZ receives both, so applying one
 * without checking which workspace it came from flips pairing state, purges the
 * wrong company cache and raises toasts on the tenant the user is not viewing.
 *
 * `invitation_received` is intentionally absent: an invitation is addressed to
 * the user for a workspace they have not joined, so it can never match the
 * active workspace id and must not be filtered by it.
 */
export const WORKSPACE_SCOPED_EVENTS: ReadonlySet<string> = new Set([
  'synced',
  'paired',
  'unpaired',
  'tally_connection',
  'workspace_access_changed',
  'workspace_access_revoked',
  'hard_sync_request',
  'hard_sync_status',
  'restore_request',
  'restore_status',
]);

/** Accepts the camelCase the backend emits plus the snake_case variants. */
export function workspaceIdFromPayload(payload: any): string | null {
  const raw = payload?.workspaceId ?? payload?.workspace_id ?? payload?.workspace?.id;
  return raw == null || raw === '' ? null : String(raw);
}

/**
 * True when the event may be applied to the active workspace.
 *
 * An unattributed workspace-scoped event (no workspaceId at all) is rejected:
 * these events all mutate workspace state, and guessing that they belong to
 * whichever workspace happens to be selected is the cross-tenant bleed itself.
 */
export function isEventForWorkspace(
  event: string,
  payload: any,
  activeWorkspaceId: string | null,
): boolean {
  if (!WORKSPACE_SCOPED_EVENTS.has(event)) return true;
  const eventWorkspaceId = workspaceIdFromPayload(payload);
  if (!activeWorkspaceId || !eventWorkspaceId) return false;
  return eventWorkspaceId === activeWorkspaceId;
}
