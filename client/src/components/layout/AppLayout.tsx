/**
 * Module purpose: Provides the authenticated business workspace, including navigation, business switching, and unread-notification feedback.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Building2, CalendarDays, ChevronDown, FileCheck2, FolderOpen, LayoutDashboard, ListChecks, LogOut, Menu,
  PieChart, Settings, ShieldCheck, UserRound, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { get } from '../../lib/api';
import { isAdmin } from '../../lib/permissions';
import { ROLE_LABEL } from '../../lib/format';
import { Logo } from './Logo';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/tasks', label: 'Obligations', icon: ListChecks },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/filings', label: 'Filing records', icon: FileCheck2 },
  { to: '/app/documents', label: 'Documents', icon: FolderOpen },
  { to: '/app/reports', label: 'Reports', icon: PieChart },
  { to: '/app/businesses', label: 'Businesses', icon: Building2 },
];

/**
 * Allows the user to switch the active business used by the surrounding dashboard and task pages.
 */
function BusinessSwitcher() {
  const { businesses, current, setCurrentId } = useBusiness();
  if (businesses.length === 0) return null;
  return (
    <div className="relative">
      <label htmlFor="business-switcher" className="sr-only">
        Current business
      </label>
      <select
        id="business-switcher"
        value={current?._id ?? ''}
        onChange={(e) => setCurrentId(e.target.value)}
        className="w-full appearance-none rounded border border-white/15 bg-white/5 py-2 pl-3 pr-8 text-sm font-semibold text-white focus:border-ledger-500 focus:outline-none"
      >
        {businesses.map((b) => (
          <option key={b._id} value={b._id} className="text-ink-900">
            {b.businessName}
            {b.businessStatus === 'CLOSED' ? ' (closed)' : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
    </div>
  );
}

/**
 * Shows the unread notification count and links to the notifications inbox.
 */
function NotificationBell() {
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    let alive = true;
    const load = () => get<{ count: number }>('/notifications/unread-count').then((r) => alive && setCount(r.data.count)).catch(() => undefined);
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [location.pathname]);
  return (
    <Link to="/app/notifications" className="relative rounded p-2 text-ink-700 hover:bg-ink-900/5" aria-label={`Notifications, ${count} unread`}>
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="tabular absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-signal-600 px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

/**
 * Renders authenticated business navigation and the nested page outlet.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const { current } = useBusiness();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [location.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900 px-3 py-4 text-white">
      <div className="px-2">
        <Logo to="/app" inverse />
      </div>
      <div className="mt-6 px-1">
        <BusinessSwitcher />
        {current?.myRole && <p className="mt-1.5 px-1 text-xs text-white/55">You are {ROLE_LABEL[current.myRole]?.toLowerCase()}</p>}
      </div>
      <nav className="mt-6 flex-1 space-y-0.5" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-white text-ink-900' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-white/10 pt-3">
        {isAdmin(user?.role) && (
          <NavLink to="/admin" className="flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Admin panel
          </NavLink>
        )}
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded px-3 py-2 text-sm font-medium ${isActive ? 'bg-white text-ink-900' : 'text-white/75 hover:bg-white/10 hover:text-white'}`
          }
        >
          <Settings className="h-4 w-4" aria-hidden />
          Settings
        </NavLink>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="no-print sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative h-full w-72">{sidebar}</div>
          <button className="absolute right-3 top-3 rounded bg-white p-2" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur lg:px-8">
          <button className="rounded p-2 hover:bg-ink-900/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm text-ink-500 lg:block">{current ? `${current.businessName}, ${current.state}` : ''}</div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-ink-900/5"
                aria-haspopup="menu"
                aria-expanded={menu}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ledger-600 text-xs font-bold text-white">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </span>
                <span className="hidden text-sm font-medium sm:inline">{user?.firstName}</span>
                <ChevronDown className="h-4 w-4 text-ink-500" aria-hidden />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 mt-1 w-56 rounded-lg border border-line bg-white py-1 shadow-raise">
                  <div className="border-b border-line px-3 py-2">
                    <p className="text-sm font-semibold">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="truncate text-xs text-ink-500">{user?.email}</p>
                  </div>
                  <Link role="menuitem" to="/app/profile" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-paper">
                    <UserRound className="h-4 w-4" aria-hidden /> Profile
                  </Link>
                  <button
                    role="menuitem"
                    onClick={async () => {
                      await logout();
                      navigate('/login');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper"
                  >
                    <LogOut className="h-4 w-4" aria-hidden /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
        <footer className="no-print border-t border-line px-4 py-4 text-xs text-ink-500 lg:px-8">
          SME Comply records and reminds; it does not submit filings to government agencies. Verify requirements with the relevant authority.
        </footer>
      </div>
    </div>
  );
}
