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
  ApiError,
} from '../services/api';
import { socketService } from '../services/socketService';
import Toast from 'react-native-toast-message';
import { wsCompanyKey, wsFyKey } from '../utils/workspaceStorage';
import { normalizeScopes, filterByScopeGuidsOrNames, type ScopeBag } from '../utils/rbasScope';
import { toastRbasError } from '../utils/rbasErrors';

const STORAGE_KEY = 'active_workspace_id';

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
  demoMode: boolean;
  isOwnerOrAdmin: boolean;
  capabilities: Set<string>;
  entryMode: EntryMode;
  invitations: any[];
  loading: boolean;
  scopes: ScopeBag;
  sensitivePolicies: Record<string, any> | null;
  refreshWorkspaces: () => Promise<void>;
  refreshContext: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  hasCapability: (key: string) => boolean;
  filterScoped: <T extends Record<string, any>>(items: T[], kind: 'ledgers' | 'godowns' | 'companies') => T[];
  refreshInvitations: () => Promise<void>;
  acceptInvite: (id: string) => Promise<any>;
  declineInvite: (id: string) => Promise<void>;
  isWorkspaceUnavailable: (w: WorkspaceSummary) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  workspaceId: null,
  workspace: null,
  access: null,
  pairingStatus: 'UNPAIRED',
  demoMode: true,
  isOwnerOrAdmin: false,
  capabilities: new Set(),
  entryMode: 'BOTH',
  invitations: [],
  loading: true,
  scopes: {},
  sensitivePolicies: null,
  refreshWorkspaces: async () => {},
  refreshContext: async () => {},
  switchWorkspace: async () => {},
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
  const { isAuthenticated, isLoading: authLoading, company, setCompany, setSelectedFY } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const [pairingStatus, setPairingStatus] = useState('UNPAIRED');
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const switchWorkspaceRef = React.useRef<((id: string) => Promise<void>) | null>(null);

  const refreshInvitations = useCallback(async () => {
    if (!isAuthenticated) {
      setInvitations([]);
      return;
    }
    try {
      const res: any = await listMyInvitations();
      const list = res?.data ?? res ?? [];
      setInvitations(Array.isArray(list) ? list : []);
    } catch {
      setInvitations([]);
    }
  }, [isAuthenticated]);

  const refreshContext = useCallback(async () => {
    if (!isAuthenticated || !workspaceId) {
      setAccess(null);
      setPairingStatus('UNPAIRED');
      return;
    }
    try {
      const res: any = await getWorkspaceContext(workspaceId);
      const d = res?.data ?? res;
      if (d?.denied) {
        setAccess(null);
        return;
      }
      setAccess(d?.access || null);
      const status = d?.pairing?.status || 'UNPAIRED';
      setPairingStatus(status);

      // If cached company is missing/unauthorized, pick a workspace company.
      // CONNECTED → prefer live Tally company (skip Demo*). UNPAIRED → prefer Demo.
      const cos: any[] = Array.isArray(d?.companies) ? d.companies : [];
      const active = cos.filter((c) => c.is_active !== false);
      if (active.length) {
        const stillValid = company?.guid && active.some((c) => c.guid === company.guid);
        if (!stillValid) {
          const isDemo = (c: any) => String(c.name || '').toLowerCase().startsWith('demo');
          const connected = status === 'CONNECTED' || status === 'RECONNECTING';
          const pick = connected
            ? (active.find((c) => !isDemo(c)) || active[0])
            : (active.find(isDemo) || active[0]);
          await setCompany({
            guid: pick.guid,
            name: pick.name,
            gstin: pick.gstin ?? null,
          });
        }
      }
    } catch (e) {
      if (e instanceof ApiError && (
        e.code === 'MEMBERSHIP_SUSPENDED' ||
        e.code === 'WORKSPACE_ACCESS_DENIED' ||
        e.code === 'WORKSPACE_SUSPENDED' ||
        e.code === 'WORKSPACE_CLOSED' ||
        e.status === 403
      )) {
        setAccess(null);
        toastRbasError(e);
        // Fallback to Personal (base) workspace — never global logout
        const base = workspaces.find((w) => w.isBase);
        if (base && base.id !== workspaceId) {
          Toast.show({
            type: 'info',
            text1: 'Access unavailable',
            text2: 'Switched to your Personal Workspace',
          });
          await switchWorkspaceRef.current?.(base.id);
        }
      }
    }
  }, [isAuthenticated, workspaceId, company?.guid, setCompany, workspaces]);

  const refreshWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setWorkspaceId(null);
      setActiveWorkspaceId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res: any = await listMyWorkspaces();
      const list = normalizeList(res);
      setWorkspaces(list);

      let preferred =
        (await AsyncStorage.getItem(STORAGE_KEY)) ||
        getActiveWorkspaceId() ||
        null;
      if (preferred && !list.some((w) => w.id === preferred)) preferred = null;
      // If remembered WS is suspended/closed → Personal base
      if (preferred) {
        const pref = list.find((w) => w.id === preferred);
        if (pref && isUnavailableSummary(pref)) preferred = null;
      }
      if (!preferred && list.length) {
        preferred =
          list.find((w) => w.isBase && !isUnavailableSummary(w))?.id ||
          list.find((w) => !isUnavailableSummary(w))?.id ||
          list.find((w) => w.isBase)?.id ||
          list[0].id;
      }
      if (preferred) {
        setWorkspaceId(preferred);
        setActiveWorkspaceId(preferred);
        await AsyncStorage.setItem(STORAGE_KEY, preferred);
      } else {
        setWorkspaceId(null);
        setActiveWorkspaceId(null);
      }
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const switchWorkspace = useCallback(async (id: string) => {
    // Safe switch (§10): clear in-memory company, restore per-workspace cache if any
    await setCompany(null);
    try {
      await setSelectedFY?.(null);
    } catch { /* ignore */ }
    setAccess(null);
    setPairingStatus('UNPAIRED');
    setWorkspaceId(id);
    setActiveWorkspaceId(id);
    await AsyncStorage.setItem(STORAGE_KEY, id);
    socketService.setWorkspaceContext?.(id);

    try {
      const companyJson = await AsyncStorage.getItem(wsCompanyKey(id));
      if (companyJson) {
        const c = JSON.parse(companyJson);
        if (c?.guid) await setCompany(c);
      }
      const fyJson = await AsyncStorage.getItem(wsFyKey(id));
      if (fyJson) {
        try { await setSelectedFY?.(JSON.parse(fyJson)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [setCompany, setSelectedFY]);

  switchWorkspaceRef.current = switchWorkspace;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setWorkspaces([]);
      setWorkspaceId(null);
      setAccess(null);
      setActiveWorkspaceId(null);
      setLoading(false);
      return;
    }
    refreshWorkspaces();
    refreshInvitations();
  }, [isAuthenticated, authLoading, refreshWorkspaces, refreshInvitations]);

  useEffect(() => {
    if (!workspaceId) return;
    refreshContext();
    socketService.setWorkspaceContext?.(workspaceId);
  }, [workspaceId, refreshContext]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = (event: string) => {
      if (event === 'invitation_received') {
        refreshInvitations();
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
  const isOwnerOrAdmin = membershipType === 'OWNER' || membershipType === 'ADMIN';
  const entryMode: EntryMode =
    (access?.entryMode as EntryMode) ||
    (access?.role?.entryMode as EntryMode) ||
    'BOTH';
  const demoMode = pairingStatus === 'UNPAIRED' || pairingStatus === 'RECONNECTING';

  const hasCapability = useCallback(
    (key: string) => {
      if (membershipType === 'OWNER') return true;
      if (!caps.size && isOwnerOrAdmin) return true;
      return caps.has(key);
    },
    [caps, membershipType, isOwnerOrAdmin]
  );

  const scopes = useMemo(() => normalizeScopes(access?.scopes), [access]);
  const sensitivePolicies = access?.sensitivePolicies || null;

  const filterScoped = useCallback(
    <T extends Record<string, any>>(items: T[], kind: 'ledgers' | 'godowns' | 'companies') => {
      if (membershipType === 'OWNER') return items;
      const allow =
        kind === 'ledgers' ? scopes.ledgers :
        kind === 'godowns' ? scopes.godowns :
        scopes.companies;
      return filterByScopeGuidsOrNames(items, allow);
    },
    [scopes, membershipType]
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
    demoMode,
    isOwnerOrAdmin,
    capabilities: caps,
    entryMode,
    invitations,
    loading,
    scopes,
    sensitivePolicies,
    refreshWorkspaces,
    refreshContext,
    switchWorkspace,
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
