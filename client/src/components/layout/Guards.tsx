/**
 * Module purpose: Enforces route-level access in the browser. Server middleware separately verifies every protected API request; hiding a route alone is not security.
 */
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../lib/permissions';
import { FullPageLoader } from '../ui';

/**
 * Requires a signed-in account before rendering the protected workspace.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/**
 * Restricts the admin workspace to ADMIN or SUPER_ADMIN platform roles.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

/**
 * Keeps signed-in users from reopening login/registration pages.
 */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return <FullPageLoader />;
  if (user) return <Navigate to={isAdmin(user.role) ? '/admin' : '/app'} replace />;
  return <>{children}</>;
}

/** Extra UI boundary; the API repeats this check on every email endpoint. */
export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
