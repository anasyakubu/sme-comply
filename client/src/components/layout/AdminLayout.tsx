/**
 * Module purpose: Provides the shared Super Admin/Admin navigation and page layout. The available links depend on the signed-in administrator role.
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Building2, Gauge, Landmark, ListTree, LogOut, Mail, Menu, ScrollText, Settings2, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABEL } from '../../lib/format';
import { Logo } from './Logo';

const NAV = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/agencies', label: 'Agencies', icon: Landmark },
  { to: '/admin/requirements', label: 'Requirements', icon: ListTree },
  { to: '/admin/businesses', label: 'Businesses', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/emails', label: 'Email history', icon: Mail, superOnly: true },
  { to: '/admin/audit-logs', label: 'Audit log', icon: ScrollText },
  { to: '/admin/settings', label: 'Dropdown values', icon: Settings2 },
];

/**
 * Renders the admin sidebar and page outlet, with role-appropriate navigation.
 */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col border-r border-line bg-white px-3 py-4">
      <div className="px-2">
        <Logo to="/admin" />
        <p className="mt-1 px-0.5 text-xs font-semibold text-ledger-700">Admin panel</p>
      </div>
      <nav className="mt-6 flex-1 space-y-0.5" aria-label="Admin">
        {NAV.filter((item) => !('superOnly' in item && item.superOnly) || user?.role === 'SUPER_ADMIN').map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded px-3 py-2 text-sm font-medium ${isActive ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-paper'}`
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-line pt-3">
        <NavLink to="/app" className="flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-ink-700 hover:bg-paper">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to app
        </NavLink>
        <button
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm font-medium text-ink-700 hover:bg-paper"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
        <p className="px-3 pt-2 text-xs text-ink-500">
          Signed in as {user?.firstName} ({ROLE_LABEL[user?.role ?? '']?.toLowerCase()})
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative h-full w-72">{sidebar}</div>
          <button className="absolute right-3 top-3 rounded bg-white p-2" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="min-w-0">
        <header className="flex h-14 items-center border-b border-line bg-paper px-4 lg:hidden">
          <button className="rounded p-2 hover:bg-ink-900/5" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 font-semibold">Admin</span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
