/**
 * Module purpose: Reusable asynchronous data hook. Tracks loading/errors and ignores stale requests when inputs change quickly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageMeta } from '../types';
import { errorMessage } from '../lib/api';

interface State<T> {
  data: T | null;
  meta?: PageMeta;
  loading: boolean;
  error: string | null;
}

/**
 * Runs an async loader whenever `deps` change and exposes loading/error state.
 * Stale responses from earlier calls are ignored.
 */
export function useApi<T>(loader: () => Promise<{ data: T; meta?: PageMeta }>, deps: unknown[], enabled = true) {
  const [state, setState] = useState<State<T>>({ data: null, loading: enabled, error: null });
  const callId = useRef(0);

  const run = useCallback(async () => {
    // Each request gets a sequence number; only the newest completion may update the UI.
    const id = ++callId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await loader();
      if (id === callId.current) setState({ data: res.data, meta: res.meta, loading: false, error: null });
    } catch (err) {
      if (id === callId.current) setState((s) => ({ ...s, loading: false, error: errorMessage(err) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (enabled) void run();
  }, [run, enabled]);

  return { ...state, reload: run, setData: (data: T) => setState((s) => ({ ...s, data })) };
}
