// useApiData — universal hook for API calls with loading/error/empty state management
// V2: No mock/fallback data. Errors surface to the user.
import { useState, useEffect, useCallback, useRef } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'empty';

interface UseApiDataResult<T> {
  data: T | null;
  status: Status;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  reload: () => void;
}

type ApiDataOptions<T> = {
  enabled?: boolean;
  transform?: (raw: any) => T;
  emptyCheck?: (data: T) => boolean;
};

function sameDeps(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

export function useApiData<T>(
  fetcher: () => Promise<any>,
  deps: any[] = [],
  options?: ApiDataOptions<T>
): UseApiDataResult<T> {
  const enabled = options?.enabled !== false;

  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<Status>(enabled ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Snapshot of the inputs captured whenever `enabled` or any dep changes,
  // so fetches keep the same closure semantics as `useCallback(fn, [enabled, ...deps])`.
  const [snapshot, setSnapshot] = useState(() => ({ fetcher, options, enabled, deps }));
  if (snapshot.enabled !== enabled || !sameDeps(snapshot.deps, deps)) {
    setSnapshot({ fetcher, options, enabled, deps });
    if (enabled) {
      setStatus('loading');
      setError(null);
    } else {
      setStatus('idle');
    }
  }

  const runFetch = useCallback((): Promise<void> => {
    const { fetcher: fetchFn, options: opts } = snapshot;
    return new Promise<any>((resolve) => resolve(fetchFn()))
      .then((raw) => {
        if (!mountedRef.current) return;
        const result = opts?.transform ? opts.transform(raw) : (raw?.data ?? raw);
        const isEmpty = opts?.emptyCheck
          ? opts.emptyCheck(result as T)
          : (Array.isArray(result) ? result.length === 0 : result == null);
        setData(result as T);
        setStatus(isEmpty ? 'empty' : 'success');
      })
      .catch((err: any) => {
        if (!mountedRef.current) return;
        const msg = err?.message || 'Failed to load data';
        setError(msg);
        setStatus('error');
        setData(null);
        console.error('[useApiData]', msg);
      });
  }, [snapshot]);

  const load = useCallback(async () => {
    if (!snapshot.enabled) { setStatus('idle'); return; }
    setStatus('loading');
    setError(null);
    await runFetch();
  }, [snapshot, runFetch]);

  useEffect(() => {
    mountedRef.current = true;
    if (snapshot.enabled) runFetch();
    return () => { mountedRef.current = false; };
  }, [snapshot, runFetch]);

  return {
    data,
    status,
    loading: status === 'loading' || status === 'idle',
    error,
    isEmpty: status === 'empty',
    reload: load,
  };
}
