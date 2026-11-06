/**
 * What waits for the signed-in user, in one place: Hard Sync and restore requests of the active workspace
 * (for the Owner, Admins and members with tally.restore_replace) and invitations to join other workspaces.
 * The bell, the Home banners, Settings and Settings → Requests all read this one store, so the approvals
 * endpoint is asked once however many of them are on screen, and polling stops while the app is in the
 * background.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useWorkspace } from '../context/WorkspaceContext';
import { getWorkspaceApprovals } from '../services/api';
import {
  captureWorkspaceGeneration, getWorkspaceGeneration, isCurrentWorkspaceGeneration,
} from '../utils/workspaceGeneration';

export type RequestsTab = 'approvals' | 'invitations';

/** Settings → Requests, opened on `tab` when one is given. */
export function requestsHref(tab?: RequestsTab | null) {
  return tab ? (`/settings/requests?tab=${tab}` as const) : ('/settings/requests' as const);
}

/** Home (bell and banners) asks for approvals this often while it is on screen. */
export const HOME_POLL_MS = 30_000;
/** An answer younger than this is shared instead of asking again (screen focus, a second reader). */
const FRESH_MS = 10_000;
const INVITATIONS_FRESH_MS = 30_000;

export type ApprovalsData = {
  hardSync: any[];
  restoreRequests: any[];
  backups: any[];
  canApproveRestore: boolean;
  activeDesktop: { name: string } | null;
};

export const NO_APPROVALS: ApprovalsData = {
  hardSync: [], restoreRequests: [], backups: [], canApproveRestore: false, activeDesktop: null,
};
const NO_ROWS: any[] = [];

type Snapshot = {
  workspaceId: string | null;
  /** Workspace generation the answer belongs to: a switch, a sign-out and a sign-in each start a new one. */
  gen: number;
  data: ApprovalsData;
  /** When the last good answer arrived; 0 until one has. Expiry countdowns run from it. */
  fetchedAt: number;
  /** Set when nothing could be loaded for this workspace yet ('' when the error had no message). */
  error: string | null;
};

const EMPTY: Snapshot = { workspaceId: null, gen: -1, data: NO_APPROVALS, fetchedAt: 0, error: null };

let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();
let requestSeq = 0;
let appliedSeq = 0;
let inFlight: { workspaceId: string; gen: number; promise: Promise<void> } | null = null;

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** An answer for another workspace, or from before a sign-out, is never shown. */
function getSnapshot(): Snapshot {
  return snapshot.gen === getWorkspaceGeneration() ? snapshot : EMPTY;
}

function toApprovals(res: any): ApprovalsData {
  const d = res?.data ?? res;
  return {
    hardSync: Array.isArray(d?.hardSync) ? d.hardSync : [],
    restoreRequests: Array.isArray(d?.restoreRequests) ? d.restoreRequests : [],
    backups: Array.isArray(d?.backups) ? d.backups : [],
    canApproveRestore: !!d?.canApproveRestore,
    activeDesktop: d?.activeDesktop || null,
  };
}

/**
 * Asks for the workspace's approvals. `maxAgeMs` reuses an answer that young; `shared` joins a request
 * already on its way (after a decision it is false, so the answer is newer than the decision).
 * Rejects when the request failed.
 */
function loadApprovals(
  workspaceId: string,
  { maxAgeMs = 0, shared = true }: { maxAgeMs?: number; shared?: boolean } = {},
): Promise<void> {
  const gen = getWorkspaceGeneration();
  const shown = getSnapshot();
  if (maxAgeMs && shown.workspaceId === workspaceId && shown.fetchedAt && Date.now() - shown.fetchedAt < maxAgeMs) {
    return Promise.resolve();
  }
  if (shared && inFlight && inFlight.workspaceId === workspaceId && inFlight.gen === gen) return inFlight.promise;
  const seq = ++requestSeq;
  const promise = getWorkspaceApprovals(workspaceId)
    .then(
      (res: any) => {
        // Answers can cross: only one newer than what is shown, for the workspace still open, is kept.
        if (seq < appliedSeq || !isCurrentWorkspaceGeneration(gen, workspaceId)) return;
        appliedSeq = seq;
        publish({ workspaceId, gen, data: toApprovals(res), fetchedAt: Date.now(), error: null });
      },
      (e: any) => {
        // A failed refresh keeps the list on screen; only a first load with nothing to show is an error.
        const now = getSnapshot();
        if (isCurrentWorkspaceGeneration(gen, workspaceId) && !(now.workspaceId === workspaceId && now.fetchedAt)) {
          publish({ workspaceId, gen, data: NO_APPROVALS, fetchedAt: 0, error: String(e?.message || '') });
        }
        throw e;
      },
    )
    .finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
  inFlight = { workspaceId, gen, promise };
  return promise;
}

/** The Retry of the error state: back to the skeleton, then ask again. */
function retryApprovals(workspaceId: string): Promise<void> {
  const shown = getSnapshot();
  if (shown.workspaceId === workspaceId && shown.error !== null) publish({ ...shown, error: null });
  return loadApprovals(workspaceId);
}

let seenSignal = 0;
/** Restore and Hard Sync socket events bump restoreSignal; the first reader to see a new value asks again. */
function noteSignal(signal: number, workspaceId: string) {
  if (signal === seenSignal) return;
  seenSignal = signal;
  loadApprovals(workspaceId).catch(() => {});
}

let invitationsAskedAt = 0;
function refreshInvitationsIfStale(refresh: () => Promise<unknown>) {
  if (Date.now() - invitationsAskedAt < INVITATIONS_FRESH_MS) return;
  invitationsAskedAt = Date.now();
  refresh().catch(() => {});
}

// ── Polling: one timer for every focused reader, at the shortest interval asked, foreground only ──

type Poller = { workspaceId: string | null; everyMs: number; refreshInvitations: () => Promise<unknown> };
const pollers = new Map<number, Poller>();
let pollerSeq = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let timerEveryMs = 0;
let appStateSub: { remove: () => void } | null = null;

const inForeground = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';

function pollApprovals(maxAgeMs: number) {
  const active = captureWorkspaceGeneration().workspaceId;
  for (const p of pollers.values()) {
    if (p.workspaceId && p.workspaceId === active) {
      loadApprovals(p.workspaceId, { maxAgeMs }).catch(() => {});
      return;
    }
  }
}

function syncTimer() {
  const intervals = [...pollers.values()].filter((p) => p.workspaceId).map((p) => p.everyMs);
  const everyMs = intervals.length && inForeground() ? Math.min(...intervals) : 0;
  if (everyMs === timerEveryMs) return;
  if (timer) clearInterval(timer);
  timer = everyMs ? setInterval(() => pollApprovals(everyMs / 2), everyMs) : null;
  timerEveryMs = everyMs;
}

function onAppStateChange(state: AppStateStatus) {
  if (state === 'active') {
    // Back from the background: catch up on what arrived meanwhile, then keep polling.
    pollApprovals(FRESH_MS);
    const first = pollers.values().next().value;
    if (first) refreshInvitationsIfStale(first.refreshInvitations);
  }
  syncTimer();
}

function addPoller(poller: Poller): () => void {
  const id = ++pollerSeq;
  pollers.set(id, poller);
  if (!appStateSub) appStateSub = AppState.addEventListener('change', onAppStateChange);
  syncTimer();
  return () => {
    pollers.delete(id);
    syncTimer();
    if (!pollers.size && appStateSub) {
      appStateSub.remove();
      appStateSub = null;
    }
  };
}

/** Seconds or milliseconds since the epoch, or an ISO date, in milliseconds; 0 when absent. */
export function toMs(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Expired invitations stay listed (they can still be declined) but no longer count as waiting. */
export function isOpenInvitation(inv: any): boolean {
  const expiresAt = toMs(inv?.expires_at);
  const seenAt = Number(inv?.fetched_at) || 0;
  return !expiresAt || !seenAt || expiresAt > seenAt;
}

export type PendingRequests = {
  /** Owner, Admin or tally.restore_replace: who may decide Hard Sync and restore requests. */
  canActOnApprovals: boolean;
  approvals: ApprovalsData;
  approvalsLoaded: boolean;
  approvalsError: string | null;
  approvalsFetchedAt: number;
  hardSync: any[];
  /** Restore requests this user may approve (the server's canApproveRestore). */
  restores: any[];
  /** Invitations still open. */
  invitations: any[];
  counts: { hardSync: number; restores: number; approvals: number; invitations: number; total: number };
  /** The tab with something waiting, approvals first; null when nothing waits. */
  firstTab: RequestsTab | null;
  /** Asks again now (pull-to-refresh, after a decision); rejects when the request failed. */
  reloadApprovals: () => Promise<void>;
  retryApprovals: () => Promise<void>;
};

/**
 * `pollMs` keeps asking for approvals while the screen is focused and the app is in the foreground;
 * without it the store is refreshed on focus only, when its answer is older than 10 seconds.
 */
export function usePendingRequests({ pollMs = 0 }: { pollMs?: number } = {}): PendingRequests {
  const { workspaceId, isOwnerOrAdmin, hasCapability, invitations, restoreSignal, refreshInvitations } = useWorkspace();
  // Hard Sync approval is the tally.restore_replace permission (Owner, and Admins by default).
  const canActOnApprovals = isOwnerOrAdmin || hasCapability('tally.restore_replace');
  const approvalsFor = canActOnApprovals ? workspaceId : null;
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const mine = !!approvalsFor && snap.workspaceId === approvalsFor;
  const approvals = mine ? snap.data : NO_APPROVALS;
  const hardSync = approvals.hardSync;
  const restores = approvals.canApproveRestore ? approvals.restoreRequests : NO_ROWS;
  const open = invitations.filter(isOpenInvitation);

  useFocusEffect(
    useCallback(() => {
      if (approvalsFor) loadApprovals(approvalsFor, { maxAgeMs: FRESH_MS }).catch(() => {});
      refreshInvitationsIfStale(refreshInvitations);
      if (!pollMs) return undefined;
      return addPoller({ workspaceId: approvalsFor, everyMs: pollMs, refreshInvitations });
    }, [approvalsFor, pollMs, refreshInvitations])
  );

  useEffect(() => {
    if (approvalsFor) noteSignal(restoreSignal, approvalsFor);
  }, [restoreSignal, approvalsFor]);

  const reloadApprovals = useCallback(
    () => (approvalsFor ? loadApprovals(approvalsFor, { shared: false }) : Promise.resolve()),
    [approvalsFor],
  );
  const retry = useCallback(
    () => (approvalsFor ? retryApprovals(approvalsFor) : Promise.resolve()),
    [approvalsFor],
  );

  const approvalsCount = hardSync.length + restores.length;
  return {
    canActOnApprovals,
    approvals,
    approvalsLoaded: mine && snap.fetchedAt > 0,
    approvalsError: mine ? snap.error : null,
    approvalsFetchedAt: mine ? snap.fetchedAt : 0,
    hardSync,
    restores,
    invitations: open,
    counts: {
      hardSync: hardSync.length,
      restores: restores.length,
      approvals: approvalsCount,
      invitations: open.length,
      total: approvalsCount + open.length,
    },
    firstTab: approvalsCount ? 'approvals' : open.length ? 'invitations' : null,
    reloadApprovals,
    retryApprovals: retry,
  };
}
