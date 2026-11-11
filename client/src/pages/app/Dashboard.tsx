/**
 * Module purpose: Shows compliance progress, upcoming deadlines, and task summaries for the currently selected business.
 */
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parse } from 'date-fns';
import { useBusiness } from '../../context/BusinessContext';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { get } from '../../lib/api';
import { fmtAgo, fmtDate, fmtDue, fullName } from '../../lib/format';
import type { AppNotification, ComplianceTask, Filing } from '../../types';
import { ButtonLink, DueCountdown, EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import { TaskList } from '../../components/tasks/TaskList';
import { NoBusiness } from '../../components/business/NoBusiness';

interface DashboardData {
  stats: { total: number; completed: number; pending: number; inProgress: number; overdue: number; dueSoon: number; compliancePercentage: number };
  upcoming: ComplianceTask[];
  overdue: ComplianceTask[];
  recentFilings: Filing[];
  notifications: AppNotification[];
  byCategory: Array<{ category: string; total: number; completed: number; overdue: number }>;
  monthly: Array<{ month: string; due: number; completed: number; overdue: number }>;
}

const COLORS = { completed: '#1E6B4A', overdue: '#B42318', open: '#A9B1BC' };

/**
 * Shows compliance progress, upcoming deadlines, and task summaries for the currently selected business.
 */
export default function Dashboard() {
  const { current, loading: loadingBusinesses } = useBusiness();
  const { user } = useAuth();
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, loading, error, reload } = useApi(
    () => get<DashboardData>(`/businesses/${current!._id}/dashboard`),
    [current?._id],
    Boolean(current),
  );

  if (!loadingBusinesses && !current) return <NoBusiness />;

  const next = data?.overdue[0] ?? data?.upcoming[0];

  return (
    <div>
      <PageHeader
        title={current?.businessName ?? 'Dashboard'}
        description={`Welcome back, ${user?.firstName}. Here is where ${current?.businessName ?? 'your business'} stands today.`}
        actions={<ButtonLink to="/app/tasks" variant="secondary">View all obligations</ButtonLink>}
      />

      {error && (
        <div className="panel">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {loading && !data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-72 lg:col-span-2" />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            {/* Next deadline — the most important thing on the page */}
            <section className={`panel p-5 ${next?.status === 'OVERDUE' ? 'border-signal-100 bg-signal-50/40' : ''}`} aria-labelledby="next-heading">
              <h2 id="next-heading" className="text-sm font-semibold text-ink-500">
                {next?.status === 'OVERDUE' ? 'Most overdue' : 'Next deadline'}
              </h2>
              {next ? (
                <div className="mt-3 flex items-start gap-5">
                  <DueCountdown dueDate={next.dueDate} status={next.status} size="lg" />
                  <div className="min-w-0">
                    <Link to={`/app/tasks/${next._id}`} className="text-lg font-bold hover:underline">
                      {next.title}
                    </Link>
                    <p className="text-sm text-ink-500">
                      {next.agencyId?.acronym}, {next.periodLabel}. Due {fmtDue(next.dueDate)}.
                    </p>
                    <ButtonLink to={`/app/tasks/${next._id}`} size="sm" className="mt-3">
                      Open obligation
                    </ButtonLink>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-500">Nothing is due. New periods appear automatically.</p>
              )}
            </section>

            <section className="panel grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x" aria-label="Summary">
              <Stat label="Compliance rate" value={`${data.stats.compliancePercentage}%`} hint="Completed of all that have fallen due" strong />
              <Stat label="Overdue" value={data.stats.overdue} tone={data.stats.overdue ? 'red' : undefined} to="/app/tasks?status=OVERDUE" />
              <Stat label="Due in 14 days" value={data.stats.dueSoon} tone={data.stats.dueSoon ? 'amber' : undefined} to="/app/tasks?status=PENDING,IN_PROGRESS" />
              <Stat label="Completed" value={data.stats.completed} to="/app/tasks?status=COMPLETED" />
            </section>
          </div>

          {data.overdue.length > 0 && (
            <section className="panel" aria-labelledby="overdue-heading">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 id="overdue-heading" className="font-bold text-signal-700">
                  Overdue
                </h2>
                <Link to="/app/tasks?status=OVERDUE" className="link text-sm">
                  See all
                </Link>
              </div>
              <TaskList tasks={data.overdue} />
            </section>
          )}

          <section className="panel" aria-labelledby="upcoming-heading">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 id="upcoming-heading" className="font-bold">
                Coming up
              </h2>
              <Link to="/app/calendar" className="link text-sm">
                Open calendar
              </Link>
            </div>
            {data.upcoming.length ? <TaskList tasks={data.upcoming} /> : <EmptyState title="Nothing coming up" message="All open obligations are done." />}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel p-4" aria-labelledby="month-heading">
              <h2 id="month-heading" className="font-bold">
                Obligations by month
              </h2>
              <p className="mb-3 text-sm text-ink-500">Six months back, six ahead.</p>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={data.monthly.map((m) => ({ ...m, label: format(parse(m.month, 'yyyy-MM', new Date()), 'MMM yy'), open: m.due - m.completed - m.overdue }))}>
                    <CartesianGrid vertical={false} stroke="#EEF0EC" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5B6676' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5B6676' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip cursor={{ fill: '#F6F7F5' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill={COLORS.completed} />
                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill={COLORS.overdue} />
                    <Bar dataKey="open" name="Open" stackId="a" fill={COLORS.open} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel p-4" aria-labelledby="cat-heading">
              <h2 id="cat-heading" className="font-bold">
                By category
              </h2>
              <p className="mb-3 text-sm text-ink-500">Where your obligations come from.</p>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart layout="vertical" data={data.byCategory.map((c) => ({ ...c, open: c.total - c.completed - c.overdue }))} margin={{ left: 12 }}>
                    <CartesianGrid horizontal={false} stroke="#EEF0EC" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#5B6676' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: '#14233B' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip cursor={{ fill: '#F6F7F5' }} />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill={COLORS.completed} />
                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill={COLORS.overdue} />
                    <Bar dataKey="open" name="Open" stackId="a" fill={COLORS.open} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel" aria-labelledby="filings-heading">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 id="filings-heading" className="font-bold">
                  Recent filings
                </h2>
                <Link to="/app/filings" className="link text-sm">
                  All filings
                </Link>
              </div>
              {data.recentFilings.length ? (
                <ul className="divide-y divide-line">
                  {data.recentFilings.map((f) => (
                    <li key={f._id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{typeof f.taskId === 'object' ? f.taskId.title : 'Filing'}</p>
                        <p className="text-ink-500">
                          {fmtDate(f.filingDate)} by {fullName(f.filedBy)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-ink-700">{f.status.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No filings recorded yet" message="Record a filing from any obligation once you've submitted it." />
              )}
            </section>

            <section className="panel" aria-labelledby="notif-heading">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 id="notif-heading" className="font-bold">
                  Latest reminders
                </h2>
                <Link to="/app/notifications" className="link text-sm">
                  All notifications
                </Link>
              </div>
              {data.notifications.length ? (
                <ul className="divide-y divide-line">
                  {data.notifications.map((n) => (
                    <li key={n._id} className="px-4 py-3 text-sm">
                      <p className={`font-semibold ${n.read ? 'text-ink-700' : ''}`}>{n.title}</p>
                      <p className="text-ink-500">{fmtAgo(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No reminders yet" />
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a dashboard metric as a consistent card, optionally linking to filtered tasks.
 */
function Stat({ label, value, hint, tone, to, strong }: { label: string; value: string | number; hint?: string; tone?: 'red' | 'amber'; to?: string; strong?: boolean }) {
  const colour = tone === 'red' ? 'text-signal-600' : tone === 'amber' ? 'text-due-600' : strong ? 'text-ledger-700' : 'text-ink-900';
  const body = (
    <>
      <p className={`tabular text-3xl font-extrabold ${colour}`}>{value}</p>
      <p className="mt-1 text-sm font-medium text-ink-700">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="block border-b border-line p-5 hover:bg-paper sm:border-b-0">
      {body}
    </Link>
  ) : (
    <div className="border-b border-line p-5 sm:border-b-0">{body}</div>
  );
}

