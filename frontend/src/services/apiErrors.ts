// ============================================================
// Typed API errors + auth/network helpers (Phase 1 error foundation)
// ============================================================

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'forbidden'
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
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err;
  return fallback;
}

/** Classify HTTP status + optional backend code into ApiErrorKind. 403 ≠ auth. */
export function kindFromStatus(
  status: number | null,
  code?: string | null,
): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
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
