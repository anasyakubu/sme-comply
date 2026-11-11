/**
 * Module purpose: Owns the current session and user identity. It restores sessions through the API, exposes login/logout actions, and clears local state when authorization expires.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, refreshSession, setAccessToken, setSessionExpiredHandler } from '../lib/api';
import type { User } from '../types';

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Makes account identity and authentication actions available to all child pages. Session restoration runs when the provider mounts.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Restore the session once on mount and register a callback for expired credentials.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAccessToken(null);
      setUser(null);
    });
    refreshSession()
      .then((s) => setUser(s?.user ?? null))
      .finally(() => setInitializing(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await post<{ user: User; accessToken: string }>('/auth/login', { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await post<{ user: User; accessToken: string }>('/auth/register', input);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('smec.currentBusiness');
  }, []);

  const reloadUser = useCallback(async () => {
    const res = await get<User>('/users/me');
    setUser(res.data);
  }, []);

  // Share a stable context object so consumers only update when authentication state changes.
  const value = useMemo(
    () => ({ user, initializing, login, register, logout, reloadUser, setUser }),
    [user, initializing, login, register, logout, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads the shared authentication context; throws outside the provider to catch incorrect component placement.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
