/**
 * WorkspaceContext — active Workspace + RBAS context for Mobile.
 * JWT stays user identity; Workspace rides on X-Workspace-Id via api.ts.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
  listMyWorkspaces,
  getWorkspaceContext,
  listMyInvitations,
  acceptInvitation,
  declineInvitation,
  setActiveWorkspaceId,
  getActiveWorkspaceId,
  renameWorkspace as renameWorkspaceApi,
  ApiError,
} from '../services/api';
import { socketService, isEventForActiveWorkspace } from '../services/socketService';
import Toast from 'react-native-toast-message';
import { wsCompanyKey, wsFyKey } from '../utils/workspaceStorage';
import { normalizeScopes, filterByScopeGuidsOrNames, type ScopeBag } from '../utils/rbasScope';
import { toastRbasError } from '../utils/rbasErrors';
import { setRbasCapabilityChecker, setTallyConnectedChecker } from '../utils/rbasGate';

const STORAGE_KEY = 'active_workspace_id';
/** When set, do not auto-jump away from sticky workspace (user picked it). */
const MANUAL_PIN_KEY = 'active_workspace_manual_pin';

export type EntryMode = 'OPTIONAL_ONLY' | 'REGULAR_ONLY' | 'BOTH';

export interface WorkspaceSummary {
  id: string;
  name: string;
  tallyConnection?: string;
  lifecycleStatus?: string;
  setupGeneration?: number;
  membershipType?: string;
  membershipStatus?: string;
  roleId?: string | null;
  isBase?: boolean;
}

export interface WorkspaceAccess {
  membershipType?: string;
  membershipStatus?: string;
  role?: { id?: string; displayName?: string; systemKey?: string; entryMode?: EntryMode } | null;
  capabilities?: string[];
  entryMode?: EntryMode;
  sensitivePolicies?: Record<string, boolean>;
  scopes?: any;
}

export interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  workspaceId: string | null;
  workspace: WorkspaceSummary | null;
  access: WorkspaceAccess | null;
  pairingStatus: string;
  /** Server-provided Pair/Unpair action flags (backend authoritative). */
  canPair: boolean;
  canUnpair: boolean;
  demoMode: boolean;
  /** True only when workspace tally is CONNECTED (live books). */
  tallyConnected: boolean;
  isOwnerOrAdmin: boolean;
  /** True only for Workspace OWNER (billing / transfer / reset / close). */
  isOwner: boolean;
  capabilities: Set<string>;
  entryMode: EntryMode;
  invitations: any[];
  loading: boolean;
  scopes: ScopeBag;
  sensitivePolicies: Record<string, any> | null;
  refreshWorkspaces: () => Promise<void>;
  refreshContext: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  hasCapability: (key: string) => boolean;
  filterScoped: <T extends Record<string, any>>(
    items: T[],
    kind: 'ledgers' | 'godowns' | 'companies' | 'fys' | 'costCentres'
  ) => T[];
  refreshInvitations: () => Promise<void>;
  acceptInvite: (id: string) => Promise<any>;
  declineInvite: (id: string) => Promise<void>;
  isWorkspaceUnavailable: (w: WorkspaceSummary) => boolean;
}

export type ScopeKind = 'ledgers' | 'godowns' | 'companies' | 'fys' | 'costCentres';

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  workspaceId: null,
  workspace: null,
  access: null,
  pairingStatus: 'UNPAIRED',
  canPair: false,
  canUnpair: false,
  demoMode: true,
  tallyConnected: false,
  isOwnerOrAdmin: false,
  isOwner: false,
  capabilities: new Set(),
  entryMode: 'BOTH',
  invitations: [],
  loading: true,
  scopes: {},
  sensitivePolicies: null,
  refreshWorkspaces: async () => {},
  refreshContext: async () => {},
  switchWorkspace: async () => {},
  renameWorkspace: async () => {},
  hasCapability: () => false,
  filterScoped: (items) => items,
  refreshInvitations: async () => {},
  acceptInvite: async () => ({}),
  declineInvite: async () => {},
  isWorkspaceUnavailable: () => false,
});

function isUnavailableSummary(w: WorkspaceSummary): boolean {
  const life = String(w.lifecycleStatus || '').toUpperCase();
  const mem = String(w.membershipStatus || '').toUpperCase();
  return (
    mem === 'SUSPENDED' ||
    life === 'SUSPENDED' ||
    life === 'CLOSED' ||
    life === 'EXPIRED'
  );
}

function isLiveTallyWs(w: WorkspaceSummary | undefined | null): boolean {
  if (!w) return false;
  const s = String(w.tallyConnection || '').toUpperCase();
  return s === 'CONNECTED' || s === 'RECONNECTING';
}

/**
 * Prefer a Tally-live workspace over sticky Personal/UNPAIRED.
 * Fixes Owner mobile stuck on Personal Demo while Web/HR show the paired WS.
 */
function pickPreferredWorkspaceId(
  list: WorkspaceSummary[],
  stickyId: string | null,
): { id: string | null; autoSwitchedFrom?: string } {
  const available = list.filter((w) => !isUnavailableSummary(w));
  if (!available.length) return { id: null };

  const sticky = stickyId ? available.find((w) => w.id === stickyId) : undefined;
  if (sticky && isLiveTallyWs(sticky)) return { id: sticky.id };

  const liveWs =
    available.find((w) => isLiveTallyWs(w) && !w.isBase) ||
    available.find((w) => isLiveTallyWs(w));

  // Sticky Personal / unpaired while another WS is live → jump to live
  if (liveWs && (!sticky || sticky.isBase || !isLiveTallyWs(sticky))) {
    return {
      id: liveWs.id,
      autoSwitchedFrom: sticky?.name || stickyId || undefined,
    };
  }

  if (sticky) return { id: sticky.id };

  return {
    id:
      available.find((w) => w.isBase && String(w.membershipType || '').toUpperCase() === 'OWNER')?.id ||
      available.find((w) => String(w.membershipType || '').toUpperCase() === 'OWNER')?.id ||
      available.find((w) => w.isBase)?.id ||
      available[0]?.id ||
      null,
  };
}

function normalizeList(raw: any): WorkspaceSummary[] {
  const list = raw?.data ?? raw ?? [];
  if (!Array.isArray(list)) return [];
  return list.map((w: any) => ({
    id: w.id,
    name: w.name,
    tallyConnection: w.tallyConnection || w.tally_connection,
    lifecycleStatus: w.lifecycleStatus || w.lifecycle_status,
    setupGeneration: w.setupGeneration ?? w.setup_generation,
    membershipType: w.membershipType || w.membership_type,
    membershipStatus: w.membershipStatus || w.membership_status,
    roleId: w.roleId ?? w.role_id ?? null,
    isBase: w.isBase ?? w.is_base,
  }));
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    isAuthenticated,
    isLoading: authLoading,
    company,
    setCompany,
    setSelectedFY,
    lastSyncAt,
  } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const [pairingStatus, setPairingStatus] = useState('UNPAIRED');
  const [canPair, setCanPair] = useState(false);
  const [canUnpair, setCanUnpair] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const switchWorkspaceRef = React.useRef<((id: string) => Promise<void>) | null>(null);
  const setCompanyRef = React.useRef(setCompany);
  setCompanyRef.current = setCompany;
  const workspacesRef = React.useRef(workspaces);
  workspacesRef.current = workspaces;
  const accessJsonRef = React.useRef<string>('');
  const refreshInFlightRef = React.useRef(false);
  const pendingRefreshRef = React.useRef(false);
  const liveSwitchToastRef = React.useRef(false);

  /**
   * Bumped on every workspace change. Each async read captures the counter (and
   * the id it was reading for) before its first await and throws its result away
   * if either moved on: pendingRefreshRef only coalesces concurrent calls, it
   * cannot tell a reply for workspace ABC from one for XYZ.
   */
  const wsGenRef = React.useRef(0);
  const isStale = React.useCallback(
    (gen: number, id: string | null) => wsGenRef.current !== gen || getActiveWorkspaceId() !== id,
    []
  );
  const applyActiveWorkspace = React.useCallback((id: string | null) => {
    if (getActiveWorkspaceId() !== id) wsGenRef.current += 1;
    setWorkspaceId(id);
    setActiveWorkspaceId(id);
  }, []);

  const refreshInvitations = useCallback(async () => {
    if (!isAuthenticated) {
      setInvitations([]);
      return [];
    }
    try {
      const res: any = await listMyInvitations();
      const list = res?.data ?? res ?? [];
      const next = Array.isArray(list)
        ? list.map((inv: any) => ({
            id: String(inv?.id || ''),
            workspace_id: inv?.workspace_id || inv?.workspaceId || null,
            workspace_name: String(inv?.workspace_name || inv?.workspaceName || inv?.workspace?.name || 'Workspace'),
            role_display_name: String(
              inv?.role_display_name || inv?.role_name || inv?.roleName
              || inv?.role?.display_name || inv?.role?.displayName || 'Member'
            ),
            status: inv?.status || 'PENDING',
            expires_at: inv?.expires_at,
            created_at: inv?.created_at,
          })).filter((inv: any) => inv.id)
        : [];
      setInvitations(next);
      return next;
    } catch {
      setInvitations([]);
      return [];
    }
  }, [isAuthenticated]);

  const refreshContext = useCallback(async () => {
    if (!isAuthenticated || !workspaceId) {
      setAccess(null);
      accessJsonRef.current = '';
      setPairingStatus('UNPAIRED');
      setCanPair(false);
      setCanUnpair(false);
      return;
    }
    // Prevent overlapping refreshes from stacking into a setState storm
    if (refreshInFlightRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    refreshInFlightRef.current = true;
    const gen = wsGenRef.current;
    const forWorkspaceId = workspaceId;
    try {
      const res: any = await getWorkspaceContext(forWorkspaceId);
      if (isStale(gen, forWorkspaceId)) return;
      const d = res?.data ?? res;
      if (d?.denied) {
        setAccess(null);
        accessJsonRef.current = '';
        return;
      }
      const nextAccess = d?.access || null;
      const accessJson = JSON.stringify(nextAccess);
      if (accessJson !== accessJsonRef.current) {
        accessJsonRef.current = accessJson;
        setAccess(nextAccess);
      }
      const status = d?.pairing?.status || 'UNPAIRED';
      setPairingStatus((prev) => (prev === status ? prev : status));
      const nextCanPair = d?.pairing?.canPair === true;
      const nextCanUnpair = d?.pairing?.canUnpair === true;
      setCanPair(nextCanPair);
      setCanUnpair(nextCanUnpair);

      // CONNECTED → never Demo. UNPAIRED / RECONNECTING → Demo only.
      const cos: any[] = Array.isArray(d?.companies) ? d.companies : [];
      const isDemo = (c: any) => {
        const name = String(c?.name || '').toLowerCase();
        const guid = String(c?.guid || c?.id || '');
        return name.startsWith('demo') || guid.startsWith('dddddddd-dddd-4ddd-8ddd-');
      };
      const connected = status === 'CONNECTED';
      const visible = connected
        ? cos.filter((c) => !isDemo(c) && c.is_active !== false)
        : cos.filter((c) => isDemo(c) && c.is_active !== false);

      if (isStale(gen, forWorkspaceId)) return;
      await setCompanyRef.current((cur: any) => {
        if (visible.length) {
          const currentIsDemo = cur && isDemo(cur);
          const curGuid = String(cur?.guid || cur?.id || '');
          const stillValid =
            !!curGuid &&
            visible.some((c) => String(c.guid || c.id || '') === curGuid) &&
            !(connected && currentIsDemo);
          if (stillValid) return cur;
          const pick = connected
            ? visible[0]
            : (visible.find(isDemo) || visible[0]);
          if (curGuid && curGuid === String(pick.guid || pick.id || '')) return cur;
          return {
            guid: pick.guid || pick.id,
            name: pick.name,
            gstin: pick.gstin ?? null,
          };
        }
        // CONNECTED + zero real companies → clear Demo selection (empty live state)
        if (connected) {
          return null;
        }
        return cur;
      });
    } catch (e) {
      if (e instanceof ApiError && (
        e.code === 'MEMBERSHIP_SUSPENDED' ||
        e.code === 'WORKSPACE_ACCESS_DENIED' ||
        e.code === 'WORKSPACE_SUSPENDED' ||
        e.code === 'WORKSPACE_CLOSED' ||
        e.status === 403
      )) {
        // A denial for a workspace the user already left is not their problem.
        if (isStale(gen, forWorkspaceId)) return;
        setAccess(null);
        accessJsonRef.current = '';
        toastRbasError(e);
        const base = workspacesRef.current.find(
          (w) => w.isBase && String(w.membershipType || '').toUpperCase() === 'OWNER'
        ) || workspacesRef.current.find(
          (w) => String(w.membershipType || '').toUpperCase() === 'OWNER'
        );
        if (base && base.id !== forWorkspaceId) {
          Toast.show({
            type: 'info',
            text1: 'Access unavailable',
            text2: 'Switched to your Personal Workspace',
          });
          await switchWorkspaceRef.current?.(base.id);
        }
      }
    } finally {
      refreshInFlightRef.current = false;
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        refreshContext();
      }
    }
  }, [isAuthenticated, workspaceId, isStale]);

  const refreshWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      applyActiveWorkspace(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // This runs on a 20s timer, so a switch can easily land mid-flight. The id
    // it picked is only valid for the generation it was read in.
    const gen = wsGenRef.current;
    try {
      const res: any = await listMyWorkspaces();
      if (wsGenRef.current !== gen) return;
      const list = normalizeList(res);
      setWorkspaces(list);

      let sticky =
        (await AsyncStorage.getItem(STORAGE_KEY)) ||
        getActiveWorkspaceId() ||
        null;
      if (wsGenRef.current !== gen) return;
      if (sticky && !list.some((w) => w.id === sticky)) sticky = null;
      if (sticky) {
        const pref = list.find((w) => w.id === sticky);
        if (pref && isUnavailableSummary(pref)) sticky = null;
      }

      const manualPin = (await AsyncStorage.getItem(MANUAL_PIN_KEY)) === '1';
      if (wsGenRef.current !== gen) return;
      const stickyRow = sticky ? list.find((w) => w.id === sticky) : undefined;
      // Never stay stuck on Personal Demo while another WS is Tally-live
      const forceLivePrefer = !!stickyRow?.isBase;

      let preferred: string | null = null;
      let autoSwitchedFrom: string | undefined;

      if (forceLivePrefer || !manualPin || !sticky) {
        const picked = pickPreferredWorkspaceId(list, sticky);
        preferred = picked.id;
        autoSwitchedFrom = picked.autoSwitchedFrom;
      } else {
        preferred = sticky;
      }

      if (
        preferred &&
        autoSwitchedFrom &&
        preferred !== sticky &&
        !liveSwitchToastRef.current
      ) {
        liveSwitchToastRef.current = true;
        const liveName = list.find((w) => w.id === preferred)?.name || 'workspace';
        Toast.show({
          type: 'info',
          text1: 'Switched to live workspace',
          text2: `${liveName} is paired with Tally`,
          visibilityTime: 3200,
        });
      }

      if (preferred) {
        // If jumping away from sticky Personal, clear Demo company cache for clean live adopt
        if (sticky && preferred !== sticky) {
          try {
            await setCompanyRef.current(null);
            await setSelectedFY?.(null);
          } catch { /* ignore */ }
          if (wsGenRef.current !== gen) return;
          setAccess(null);
          accessJsonRef.current = '';
          setPairingStatus('UNPAIRED');
          setCanPair(false);
          setCanUnpair(false);
          await AsyncStorage.removeItem(MANUAL_PIN_KEY).catch(() => {});
          if (wsGenRef.current !== gen) return;
        }
        applyActiveWorkspace(preferred);
        await AsyncStorage.setItem(STORAGE_KEY, preferred);
        socketService.setWorkspaceContext?.(preferred);
      } else {
        applyActiveWorkspace(null);
      }
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setSelectedFY, applyActiveWorkspace]);

  const switchWorkspace = useCallback(async (id: string) => {
    // Safe switch (§10): clear in-memory company, restore per-workspace cache if any
    await setCompany(null);
    try {
      await setSelectedFY?.(null);
    } catch { /* ignore */ }
    setAccess(null);
    accessJsonRef.current = '';
    setPairingStatus('UNPAIRED');
    setCanPair(false);
    setCanUnpair(false);
    // From here on the active workspace is `id`; anything still in flight for
    // the previous one is invalidated by the generation bump inside this call.
    applyActiveWorkspace(id);
    const gen = wsGenRef.current;
    await AsyncStorage.setItem(STORAGE_KEY, id);
    // User explicitly chose — don't auto-jump away on next list refresh
    await AsyncStorage.setItem(MANUAL_PIN_KEY, '1');
    if (wsGenRef.current !== gen) return;
    socketService.setWorkspaceContext?.(id);

    try {
      const companyJson = await AsyncStorage.getItem(wsCompanyKey(id));
      if (wsGenRef.current !== gen) return;
      if (companyJson) {
        const c = JSON.parse(companyJson);
        if (c?.guid) await setCompany(c);
      }
      const fyJson = await AsyncStorage.getItem(wsFyKey(id));
      if (wsGenRef.current !== gen) return;
      if (fyJson) {
        try { await setSelectedFY?.(JSON.parse(fyJson)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [setCompany, setSelectedFY, applyActiveWorkspace]);

  switchWorkspaceRef.current = switchWorkspace;

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const trimmed = String(name || '').trim();
    if (trimmed.length < 2) {
      throw new Error('Name must be at least 2 characters');
    }
    const res: any = await renameWorkspaceApi(id, trimmed);
    const nextName = res?.data?.name || trimmed;
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name: nextName } : w)));
    await refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setWorkspaces([]);
      setAccess(null);
      applyActiveWorkspace(null);
      setLoading(false);
      return;
    }
    refreshWorkspaces();
    refreshInvitations();
  }, [isAuthenticated, authLoading, refreshWorkspaces, refreshInvitations, applyActiveWorkspace]);

  // After Desktop sync / pair advances lastSyncAt, re-list workspaces so we can
  // jump Personal → CONNECTED WS (Owner mobile Demo stickiness).
  useEffect(() => {
    if (!isAuthenticated || !lastSyncAt) return;
    refreshWorkspaces();
  }, [lastSyncAt, isAuthenticated, refreshWorkspaces]);

  // Periodic workspace list refresh while app is open (pair may happen on Web)
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setInterval(() => {
      refreshWorkspaces();
    }, 20_000);
    return () => clearInterval(t);
  }, [isAuthenticated, refreshWorkspaces]);

  useEffect(() => {
    if (!workspaceId) return;
    refreshContext();
    socketService.setWorkspaceContext?.(workspaceId);
  }, [workspaceId, refreshContext]);

  // After Desktop sync advances lastSyncAt, re-read pairing (RECONNECTING → CONNECTED)
  useEffect(() => {
    if (!isAuthenticated || !workspaceId || !lastSyncAt) return;
    refreshContext();
  }, [lastSyncAt, isAuthenticated, workspaceId, refreshContext]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = (event: string, payload?: any) => {
      // socketService already drops events for other workspaces; re-checked here
      // because everything below this line mutates the active workspace's state.
      if (!isEventForActiveWorkspace(event, payload)) return;
      if (event === 'invitation_received') {
        refreshInvitations()
          .then((list) => {
            const n = Array.isArray(list) ? list.length : 0;
            Toast.show({
              type: 'info',
              text1: 'Workspace invitation',
              text2: n > 0
                ? 'Open Settings → Invitations to accept'
                : 'Pull to refresh Invitations',
              visibilityTime: 4000,
            });
          })
          .catch(() => {});
        return;
      }
      if (event === 'workspace_access_changed' || event === 'workspace_access_revoked') {
        refreshWorkspaces();
        refreshContext();
        return;
      }
      if (event === 'hard_sync_request') {
        refreshContext();
        Toast.show({
          type: 'info',
          text1: 'Hard Sync requested',
          text2: 'Owner/Admin: Settings → Approvals',
        });
        return;
      }
      if (event === 'tally_connection' || event === 'synced' || event === 'unpaired' || event === 'paired') {
        refreshContext();
        return;
      }
      if (event === 'restore_status' || event === 'restore_request') {
        refreshContext();
        Toast.show({
          type: 'info',
          text1: 'Restore request',
          text2: 'Owner/Admin: Settings → Approvals to pick a backup',
        });
      }
    };
    socketService.setOnWorkspaceEvent?.(handler);
    return () => socketService.setOnWorkspaceEvent?.(null);
  }, [isAuthenticated, refreshInvitations, refreshWorkspaces, refreshContext]);

  const workspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId) || null,
    [workspaces, workspaceId]
  );

  const caps = useMemo(() => {
    const list = access?.capabilities;
    if (Array.isArray(list)) return new Set(list.map(String));
    return new Set<string>();
  }, [access]);

  const membershipType = access?.membershipType || workspace?.membershipType || '';
  const isOwner = membershipType === 'OWNER';
  const roleSystemKey = access?.role?.systemKey || access?.role?.system_key || null;
  const isOwnerOrAdmin = isOwner || roleSystemKey === 'ADMIN';
  const entryMode: EntryMode =
    (access?.entryMode as EntryMode) ||
    (access?.role?.entryMode as EntryMode) ||
    'BOTH';
  const demoMode = pairingStatus === 'UNPAIRED' || pairingStatus === 'RECONNECTING';
  const tallyConnected = pairingStatus === 'CONNECTED';

  const hasCapability = useCallback(
    (key: string) => {
      // Product 2A: Demo Mode never elevates RBAS — use real effective caps
      // Fail closed while caps unknown — empty means deny (except OWNER)
      if (membershipType === 'OWNER') return true;
      if (!caps.size) return false;
      return caps.has(key);
    },
    [caps, membershipType]
  );

  useEffect(() => {
    setRbasCapabilityChecker(hasCapability);
    return () => setRbasCapabilityChecker(null);
  }, [hasCapability]);

  useEffect(() => {
    setTallyConnectedChecker(() => pairingStatus === 'CONNECTED');
    return () => setTallyConnectedChecker(null);
  }, [pairingStatus]);

  const scopes = useMemo(() => normalizeScopes(access?.scopes), [access]);
  const sensitivePolicies = access?.sensitivePolicies || null;

  const filterScoped = useCallback(
    <T extends Record<string, any>>(items: T[], kind: ScopeKind) => {
      // OWNER unrestricted. Demo Mode: Demo Company / FYs are never in member
      // allow-lists — skip those scopes so HR can still use Demo while unpaired.
      if (membershipType === 'OWNER') return items;
      if (demoMode && (kind === 'companies' || kind === 'fys')) return items;
      const allow =
        kind === 'ledgers' ? scopes.ledgers :
        kind === 'godowns' ? scopes.godowns :
        kind === 'companies' ? scopes.companies :
        kind === 'fys' ? scopes.financialYears :
        scopes.costCentres;
      const fields =
        kind === 'fys'
          ? ['label', 'finYear', 'fin_year', 'name', 'id', 'guid', 'startDate', 'begin_date']
          : kind === 'costCentres'
            ? ['guid', 'id', 'name', 'cost_centre', 'costCentre']
            : ['guid', 'id', 'name', 'ledger_name', 'party_name'];
      return filterByScopeGuidsOrNames(items, allow, fields);
    },
    [scopes, membershipType, demoMode]
  );

  const acceptInvite = useCallback(
    async (id: string) => {
      const res: any = await acceptInvitation(id);
      await refreshInvitations();
      await refreshWorkspaces();
      return res?.data ?? res;
    },
    [refreshInvitations, refreshWorkspaces]
  );

  const declineInvite = useCallback(
    async (id: string) => {
      await declineInvitation(id);
      await refreshInvitations();
    },
    [refreshInvitations]
  );

  const value: WorkspaceContextValue = {
    workspaces,
    workspaceId,
    workspace,
    access,
    pairingStatus,
    canPair,
    canUnpair,
    demoMode,
    tallyConnected,
    isOwnerOrAdmin,
    isOwner,
    capabilities: caps,
    entryMode,
    invitations,
    loading,
    scopes,
    sensitivePolicies,
    refreshWorkspaces,
    refreshContext,
    switchWorkspace,
    renameWorkspace,
    hasCapability,
    filterScoped,
    refreshInvitations,
    acceptInvite,
    declineInvite,
    isWorkspaceUnavailable: isUnavailableSummary,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
