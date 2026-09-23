// ============================================================
// Typed API errors + auth/network helpers (Phase 1 error foundation)
// ============================================================

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'forbidden'
  | 'validation'
  | 'server'
  | 'unknown';

export class ApiError extends Error {
  status: number | null;
  code: string | null;
  kind: ApiErrorKind;
  raw?: unknown;

  constructor(
    message: string,
    opts: {
      status?: number | null;
      code?: string | null;
      kind?: ApiErrorKind;
      raw?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status ?? null;
    this.code = opts.code ?? null;
    this.kind = opts.kind ?? 'unknown';
    this.raw = opts.raw;
  }

  get isAuth() {
    return this.kind === 'auth' || this.status === 401;
  }
  get isForbidden() {
    return this.kind === 'forbidden' || this.status === 403;
  }
  get isNetwork() {
    return this.kind === 'network' || this.kind === 'timeout';
  }
  get isDeviceNotPaired() {
    return this.code === 'DEVICE_NOT_PAIRED';
  }
  get isCompanyNotSynced() {
    return this.code === 'COMPANY_NOT_SYNCED';
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function errorMessage(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof ApiError) return friendlyUserMessage(err.message, err.code) || fallback;
  if (err instanceof Error) return friendlyUserMessage(err.message) || fallback;
  if (typeof err === 'string') return friendlyUserMessage(err) || fallback;
  return fallback;
}

/**
 * Map raw backend / network copy to on-brand user-facing text.
 * Keeps technical codes out of full-page ErrorState.
 */
export function friendlyUserMessage(
  message?: string | null,
  code?: string | null,
): string {
  const raw = String(message || '').trim();
  const c = String(code || '').toUpperCase();

  if (
    c === 'COMPANY_SCOPE_DENIED'
    || c === 'COMPANY_NOT_IN_WORKSPACE'
    || /company not in (this )?workspace/i.test(raw)
  ) {
    return 'This company is not in the selected workspace. Switch company or workspace, then retry.';
  }
  if (c === 'WORKSPACE_ACCESS_DENIED' || /workspace membership required/i.test(raw)) {
    return 'You do not have access to this workspace. Switch workspace and try again.';
  }
  if (c === 'WORKSPACE_REQUIRED' || /workspace authorization required/i.test(raw)) {
    return 'Workspace is required. Pull to refresh or re-open the app.';
  }
  if (c === 'CAPABILITY_DENIED' || /not allowed\. ask your workspace/i.test(raw)) {
    return 'Not allowed. Ask your Workspace administrator.';
  }
  if (c === 'MEMBERSHIP_SUSPENDED') {
    return 'Your membership in this workspace is suspended.';
  }
  if (!raw) return 'Failed to load data';
  return raw;
}

/** Classify HTTP status + optional backend code into ApiErrorKind. 403 ≠ auth. */
export function kindFromStatus(
  status: number | null,
  code?: string | null,
): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 422 || status === 400 || status === 402 || status === 409) return 'validation';
  if (status != null && status >= 500) return 'server';
  if (code === 'DEVICE_NOT_PAIRED' || code === 'COMPANY_NOT_SYNCED') return 'forbidden';
  return 'unknown';
}

// ── Central 401 handler (AuthContext registers signOut) ───────
type AuthFailureHandler = (err: ApiError) => void;
let authFailureHandler: AuthFailureHandler | null = null;
let authFailureInFlight = false;

export function setAuthFailureHandler(handler: AuthFailureHandler | null) {
  authFailureHandler = handler;
}

export function notifyAuthFailure(err: ApiError) {
  if (err.kind !== 'auth' && err.status !== 401) return;
  // Never treat 403 as logout
  if (err.status === 403 || err.kind === 'forbidden') return;
  if (!authFailureHandler || authFailureInFlight) return;
  authFailureInFlight = true;
  try {
    authFailureHandler(err);
  } finally {
    // Allow a later genuine 401 after re-login
    setTimeout(() => {
      authFailureInFlight = false;
    }, 1500);
  }
}

// ── Device online tracking (simple; no NetInfo dependency) ────
type OnlineListener = (online: boolean) => void;
const onlineListeners = new Set<OnlineListener>();
let deviceOnline = true;

export function getDeviceOnline(): boolean {
  return deviceOnline;
}

export function setDeviceOnline(online: boolean) {
  if (deviceOnline === online) return;
  deviceOnline = online;
  onlineListeners.forEach((cb) => {
    try {
      cb(online);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeDeviceOnline(cb: OnlineListener): () => void {
  onlineListeners.add(cb);
  cb(deviceOnline);
  return () => {
    onlineListeners.delete(cb);
  };
}
