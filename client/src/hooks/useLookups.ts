/**
 * Module purpose: Loads shared options such as business types and industries for consistent select menus.
 */
import { useEffect, useState } from 'react';
import { get } from '../lib/api';
import type { LookupOptions } from '../types';

let cache: LookupOptions | null = null;

export function useLookups() {
  const [options, setOptions] = useState<LookupOptions | null>(cache);
  useEffect(() => {
    if (cache) return;
    get<LookupOptions>('/lookups/options')
      .then((r) => {
        cache = r.data;
        setOptions(r.data);
      })
      .catch(() => undefined);
  }, []);
  return options;
}
