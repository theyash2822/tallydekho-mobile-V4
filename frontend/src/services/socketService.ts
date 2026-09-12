/**
 * socketService.ts
 * Manages a single Socket.io connection to the backend.
 * Connects after login with the user's JWT token.
 * Emits `synced` event → onSynced callback → screens auto-refresh.
 */
import { io, Socket } from 'socket.io-client';

type SyncedCallback = (companyGuid: string) => void;
type VoucherSyncedCallback = (data: { tdkRef: string; tallyVoucherNo: string }) => void;
type WorkspaceEventCallback = (event: string, payload?: any) => void;

let socket: Socket | null = null;
let onSyncedCallback: SyncedCallback | null = null;
let onVoucherSyncedCallback: VoucherSyncedCallback | null = null;
let onWorkspaceEventCallback: WorkspaceEventCallback | null = null;
let currentBaseUrl: string = '';
let _pendingWorkspaceId: string | null = null;

function emitWorkspaceEvent(event: string, payload?: any) {
  console.log(`[Socket] ${event}`);
  onWorkspaceEventCallback?.(event, payload);
}

export const socketService = {
  connect(baseUrl: string, token: string) {
    // Already connected to same server — skip
    if (socket?.connected && currentBaseUrl === baseUrl) return;

    // Disconnect any stale connection
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    currentBaseUrl = baseUrl;
    socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[Socket] connected:', socket?.id);
      // Register as mobile client with JWT token
      socket?.emit('register', { token, type: 'mobile' });
    });

    socket.on('registered', ({ status }: { status: boolean }) => {
      console.log('[Socket] registered, status:', status);
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
    socket.on('synced', ({ companyGuid }: { companyGuid: string; syncedAt: string }) => {
      console.log('[Socket] synced event for company:', companyGuid);
      onSyncedCallback?.(companyGuid);
    });

    // 🧾 Voucher number reconciled: backend fires after ingestProcessor matches TDK ref
    socket.on('voucher:tallySynced', (payload: any) => {
      const tdkRef: string = payload.tdkRef ?? payload.tdkReferenceNo ?? '';
      const tallyVoucherNo: string = payload.tallyVoucherNo ?? '';
      onVoucherSyncedCallback?.({ tdkRef, tallyVoucherNo });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] connect error:', err.message);
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
