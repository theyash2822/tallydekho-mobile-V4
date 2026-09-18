/**
 * socketService.ts
 * Manages a single Socket.io connection to the backend.
 * Connects after login with the user's JWT token.
 * Emits `synced` event → onSynced callback → screens auto-refresh.
 */
import { io, Socket } from 'socket.io-client';
import { getActiveWorkspaceId } from './api';
import { isEventForWorkspace, workspaceIdFromPayload } from './workspaceEventScope';

type SyncedCallback = (companyGuid: string) => void;
type VoucherSyncedCallback = (data: { tdkRef: string; tallyVoucherNo: string }) => void;
type WorkspaceEventCallback = (event: string, payload?: any) => void;

let socket: Socket | null = null;
let onSyncedCallback: SyncedCallback | null = null;
let onVoucherSyncedCallback: VoucherSyncedCallback | null = null;
let onWorkspaceEventCallback: WorkspaceEventCallback | null = null;
let currentBaseUrl: string = '';
let currentToken: string = '';
let _pendingWorkspaceId: string | null = null;
let _lastConnectErrorAt = 0;

/**
 * True when this event may be applied to the workspace the user currently has
 * open. The active id is read here, at delivery time, rather than captured when
 * the listener was installed — a captured id goes stale the moment the user
 * switches workspace, which is the whole problem being fixed.
 */
export function isEventForActiveWorkspace(event: string, payload?: any): boolean {
  return isEventForWorkspace(event, payload, getActiveWorkspaceId());
}

function emitWorkspaceEvent(event: string, payload?: any) {
  if (!isEventForActiveWorkspace(event, payload)) {
    if (__DEV__) {
      console.log(`[Socket] ignored ${event} for workspace ${workspaceIdFromPayload(payload) ?? 'unknown'}`);
    }
    return;
  }
  if (__DEV__) console.log(`[Socket] ${event}`);
  onWorkspaceEventCallback?.(event, payload);
}

export const socketService = {
  connect(baseUrl: string, token: string) {
    // Already connected to same server with same token — skip
    if (socket?.connected && currentBaseUrl === baseUrl && currentToken === token) return;

    // Disconnect any stale connection
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    currentBaseUrl = baseUrl;
    currentToken = token;
    socket = io(baseUrl, {
      // RN often fails pure websocket on flaky LAN — allow polling fallback
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      auth: { token },
      query: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
      timeout: 15000,
      forceNew: true,
    });

    socket.on('connect', () => {
      if (__DEV__) console.log('[Socket] connected:', socket?.id);
      // Register as mobile client with JWT token
      socket?.emit('register', { token, type: 'mobile' });
    });

    socket.on('registered', ({ status }: { status: boolean }) => {
      if (__DEV__) console.log('[Socket] registered, status:', status);
      if (_pendingWorkspaceId) {
        socket?.emit('workspace:register', { workspaceId: _pendingWorkspaceId });
      }
    });

    socket.on('workspace_access_revoked', (payload?: any) => {
      emitWorkspaceEvent('workspace_access_revoked', payload);
    });
    socket.on('workspace_access_changed', (payload?: any) => {
      emitWorkspaceEvent('workspace_access_changed', payload);
    });
    // Suspend/remove also emit these (parity with web)
    socket.on('membership_revoked', (payload?: any) => {
      emitWorkspaceEvent('workspace_access_revoked', payload);
    });
    socket.on('access_revoked', (payload?: any) => {
      emitWorkspaceEvent('workspace_access_revoked', payload);
    });
    socket.on('invitation_received', (payload?: any) => {
      emitWorkspaceEvent('invitation_received', payload);
    });
    socket.on('hard_sync_request', (payload?: any) => {
      emitWorkspaceEvent('hard_sync_request', payload);
    });
    socket.on('hard_sync_status', (payload?: any) => {
      emitWorkspaceEvent('hard_sync_status', payload);
    });
    socket.on('restore_request', (payload?: any) => {
      emitWorkspaceEvent('restore_request', payload);
    });
    socket.on('restore_status', (payload?: any) => {
      emitWorkspaceEvent('restore_status', payload);
    });

    // 🔄 Key event: backend fires this after every sync
    socket.on('synced', (payload: { companyGuid: string; syncedAt: string; workspaceId?: string }) => {
      // Gated here as well as in emitWorkspaceEvent: onSyncedCallback bumps
      // lastSyncAt, which makes every open screen refetch.
      if (!isEventForActiveWorkspace('synced', payload)) return;
      if (__DEV__) console.log('[Socket] synced event for company:', payload?.companyGuid);
      onSyncedCallback?.(payload?.companyGuid);
      emitWorkspaceEvent('synced', payload);
    });

    socket.on('tally_connection', (payload?: any) => {
      if (!isEventForActiveWorkspace('tally_connection', payload)) return;
      emitWorkspaceEvent('tally_connection', payload);
      if (String(payload?.status || '').toUpperCase() === 'CONNECTED') {
        onSyncedCallback?.(payload?.companyGuid || '');
      }
    });

    socket.on('unpaired', (payload?: any) => {
      emitWorkspaceEvent('unpaired', payload);
    });

    socket.on('paired', (payload?: any) => {
      emitWorkspaceEvent('paired', payload);
    });

    // 🧾 Voucher number reconciled: backend fires after ingestProcessor matches TDK ref
    socket.on('voucher:tallySynced', (payload: any) => {
      const tdkRef: string = payload.tdkRef ?? payload.tdkReferenceNo ?? '';
      const tallyVoucherNo: string = payload.tallyVoucherNo ?? '';
      onVoucherSyncedCallback?.({ tdkRef, tallyVoucherNo });
    });

    socket.on('disconnect', (reason) => {
      if (__DEV__) console.log('[Socket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      // Throttle — never LogBox-spam; RN treats console.warn as yellow box
      const now = Date.now();
      if (__DEV__ && now - _lastConnectErrorAt > 30_000) {
        _lastConnectErrorAt = now;
        console.log('[Socket] connect retry:', err?.message || 'network');
      }
    });
  },

  disconnect() {
    if (socket) {
      socket.emit('client-disconnect');
      socket.disconnect();
      socket = null;
    }
    onSyncedCallback = null;
    currentBaseUrl = '';
    currentToken = '';
    _pendingWorkspaceId = null;
  },

  setWorkspaceContext(workspaceId: string | null) {
    _pendingWorkspaceId = workspaceId;
    if (socket?.connected && workspaceId) {
      socket.emit('workspace:register', { workspaceId });
    }
  },

  setOnSynced(cb: SyncedCallback | null) {
    onSyncedCallback = cb;
  },

  setOnVoucherSynced(cb: VoucherSyncedCallback | null) {
    onVoucherSyncedCallback = cb;
  },

  setOnWorkspaceEvent(cb: WorkspaceEventCallback | null) {
    onWorkspaceEventCallback = cb;
  },

  isConnected(): boolean {
    return socket?.connected ?? false;
  },
};

// Expose raw socket for direct event listening (e.g. invoice_posting_updated)
export const getSocket = () => socket;
