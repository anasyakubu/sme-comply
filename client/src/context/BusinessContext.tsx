/**
 * Module purpose: Tracks accessible businesses and the selected business. Business permissions are derived from membership and platform role, not from a hard-coded UI flag.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get } from '../lib/api';
import { permissionsFor } from '../lib/permissions';
import type { Business, Permission } from '../types';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'smec.currentBusiness';

interface BusinessContextValue {
  businesses: Business[];
  current: Business | null;
  loading: boolean;
  setCurrentId: (id: string) => void;
  reload: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

/**
 * Fetches the user’s businesses, remembers the selected business, and exposes permission checks to child pages.
 */
export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await get<Business[]>('/businesses', { limit: 100, businessStatus: undefined });
      setBusinesses(res.data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Refetch business memberships after login; clear stale businesses after logout.
  useEffect(() => {
    if (user) void reload();
    else setBusinesses([]);
  }, [user, reload]);

  const setCurrentId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setCurrentIdState(id);
  }, []);

  // If the saved selection is unavailable, fall back to an open business.
  const current = useMemo(() => {
    const open = businesses.filter((b) => b.businessStatus !== 'CLOSED');
    return businesses.find((b) => b._id === currentId) ?? open[0] ?? businesses[0] ?? null;
  }, [businesses, currentId]);

  // Use the selected business membership to decide which buttons the UI should offer.
  const can = useCallback(
    (permission: Permission) => permissionsFor(current?.myRole ?? null, user?.role).includes(permission),
    [current, user],
  );

  const value = useMemo(() => ({ businesses, current, loading, setCurrentId, reload, can }), [businesses, current, loading, setCurrentId, reload, can]);
  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

/**
 * Provides the current business and membership permissions to the business workspace.
 */
export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used inside BusinessProvider');
  return ctx;
}
