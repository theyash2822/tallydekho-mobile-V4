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

export function useApiData<T>(
  fetcher: () => Promise<any>,
  deps: any[] = [],
  options?: {
    enabled?: boolean;
    transform?: (raw: any) => T;
    emptyCheck?: (data: T) => boolean;
  }
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const enabled = options?.enabled !== false;

  const load = useCallback(async () => {
    if (!enabled) { setStatus('idle'); return; }
    setStatus('loading');
    setError(null);
    try {
      const raw = await fetcher();
      if (!mountedRef.current) return;
      const result = options?.transform ? options.transform(raw) : (raw?.data ?? raw);
      const isEmpty = options?.emptyCheck
        ? options.emptyCheck(result as T)
        : (Array.isArray(result) ? result.length === 0 : result == null);
      setData(result as T);
      setStatus(isEmpty ? 'empty' : 'success');
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err?.message || 'Failed to load data';
      setError(msg);
      setStatus('error');
      setData(null);
      console.error('[useApiData]', msg);
    }
  }, [enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return {
    data,
    status,
    loading: status === 'loading' || status === 'idle',
    error,
    isEmpty: status === 'empty',
    reload: load,
  };
}
