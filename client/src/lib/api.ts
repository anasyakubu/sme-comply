/**
 * Module purpose: Central HTTP client. Attaches short-lived access tokens, refreshes the session after a 401 response, and normalizes API results and errors.
 */
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type { ApiEnvelope, User } from '../types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';

/**
 * The access token lives only in memory. The refresh token is an httpOnly cookie
 * the browser sends to /auth/refresh, so a page reload restores the session
 * without exposing tokens to JavaScript storage.
 */
let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

export const api = axios.create({ baseURL: API_URL, withCredentials: true });

// Attach the short-lived token automatically to normal API calls.
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

/**
 * Uses the server-managed refresh cookie to obtain a new in-memory access token without exposing the refresh token.
 */
export async function refreshSession(): Promise<{ user: User; accessToken: string } | null> {
  try {
    const res = await axios.post<ApiEnvelope<{ user: User; accessToken: string }>>(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
    setAccessToken(res.data.data.accessToken);
    return res.data.data;
  } catch {
    setAccessToken(null);
    return null;
  }
}

// A single refresh attempt is shared across simultaneous unauthorized responses.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      // Share one refresh between concurrent failing requests.
      refreshing = refreshing ?? refreshSession().then((s) => s?.accessToken ?? null).finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      }
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

/** Unwraps the { success, data, meta } envelope. */
export async function get<T>(url: string, params?: Record<string, unknown>) {
  const res = await api.get<ApiEnvelope<T>>(url, { params: clean(params) });
  return res.data;
}
export async function post<T>(url: string, body?: unknown) {
  return (await api.post<ApiEnvelope<T>>(url, body)).data;
}
export async function patch<T>(url: string, body?: unknown) {
  return (await api.patch<ApiEnvelope<T>>(url, body)).data;
}
export async function put<T>(url: string, body?: unknown) {
  return (await api.put<ApiEnvelope<T>>(url, body)).data;
}
export async function del<T>(url: string) {
  return (await api.delete<ApiEnvelope<T>>(url)).data;
}

/** Downloads a file from an authenticated endpoint. */
export async function download(url: string, params: Record<string, unknown>, fallbackName: string) {
  const res = await api.get(url, { params: clean(params), responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}

function clean(params?: Record<string, unknown>) {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

/** Human-readable message from an API error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Cannot reach the server. Check your connection and try again.';
    const data = err.response.data as Partial<ApiEnvelope<unknown>> | undefined;
    return data?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Field errors from a 400 response, keyed by path. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {};
  const data = err.response?.data as Partial<ApiEnvelope<unknown>> | undefined;
  return Object.fromEntries((data?.errors ?? []).map((e) => [e.path, e.message]));
}
