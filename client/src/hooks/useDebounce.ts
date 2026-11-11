/**
 * Module purpose: Delays changing a search/filter value so typing does not trigger an API request for every keypress.
 */
import { useEffect, useState } from 'react';

/**
 * Publishes the input only after it stops changing for the configured delay, reducing unnecessary searches.
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
