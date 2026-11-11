/**
 * Module purpose: Displays a platform-wide overview and provides entry points to administrator tasks and communication tools.
 */
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../../hooks/useApi';
import { errorMessage, get, post } from '../../lib/api';
import { fmtDateTime, fullName, titleCase } from '../../lib/format';
import type { AuditEntry } from '../../types';
import { Button, ButtonLink, ErrorState, PageHeader, SkeletonRows } from '../../components/ui';

interface Overview {
  users: number;
  activeUsers: number;
  businesses: number;
  agencies: number;
  requirements: number;
  notifications: number;
  tasks: Record<string, number>;
  platformCompliance: number;
  recentAudit: AuditEntry[];
  businessesByState: Array<{ state: string; count: number }>;
}

/**
 * Displays a platform-wide overview and provides entry points to administrator tasks and communication tools.
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, loading, error, reload } = useApi(() => get<Overview>('/admin/overview'), []);
  const [running, setRunning] = useState<string | null>(null);

  const run = async (job: 'reminders' | 'generate-tasks') => {
    setRunning(job);
    try {
      const res = await post<Record<string, unknown>>(`/admin/jobs/${job}`);
      toast.success(res.message);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunning(null);
    }
  };

  if (loading && !data) return <SkeletonRows rows={8} />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load overview'} onRetry={reload} />;

  const stats: Array<[string, number | string, string?]> = [
    ['Users', data.users, `${data.activeUsers} active`],
    ['Businesses', data.businesses],
    ['Active requirements', data.requirements, `${data.agencies} agencies`],
    ['Platform compliance', `${data.platformCompliance}%`],
    ['Overdue obligations', data.tasks.OVERDUE ?? 0],
    ['Notifications sent', data.notifications],
  ];

  return (
    <div>
      <PageHeader
        title="Platform overview"
        actions={
          <>
            {user?.role === 'SUPER_ADMIN' && (
              <>
                <ButtonLink to="/admin/emails/new?type=GENERAL" variant="secondary">Send Email</ButtonLink>
                <ButtonLink to="/admin/emails/new?type=MANUAL_REMINDER" variant="secondary">Send Reminder</ButtonLink>
              </>
            )}
            <Button variant="secondary" loading={running === 'generate-tasks'} onClick={() => run('generate-tasks')}>
              Regenerate all obligations
            </Button>
            <Button loading={running === 'reminders'} onClick={() => run('reminders')}>
              Run reminder job now
            </Button>
          </>
        }
      />
      <section className="panel grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="border-b border-r border-line p-4 last:border-r-0">
            <p className="tabular text-2xl font-extrabold">{value}</p>
            <p className="text-sm font-medium text-ink-700">{label}</p>
            {hint && <p className="text-xs text-ink-500">{hint}</p>}
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="font-bold">Obligations by status</h2>
          <div className="mt-3 h-60">
            <ResponsiveContainer>
              <BarChart data={Object.entries(data.tasks).map(([status, count]) => ({ status: titleCase(status), count }))}>
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#5B6676' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5B6676' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={{ fill: '#F6F7F5' }} />
                <Bar dataKey="count" name="Obligations" fill="#14233B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-4">
          <h2 className="font-bold">Businesses by state</h2>
          <ul className="mt-3 space-y-2">
            {data.businessesByState.map((s) => (
              <li key={s.state} className="flex items-center gap-3 text-sm">
                <span className="w-28 truncate">{s.state}</span>
                <span className="h-2 rounded bg-ledger-600" style={{ width: `${(s.count / Math.max(...data.businessesByState.map((x) => x.count))) * 70}%` }} aria-hidden />
                <span className="tabular text-ink-500">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel mt-6">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-bold">Recent activity</h2>
          <Link to="/admin/audit-logs" className="link text-sm">Full audit log</Link>
        </div>
        <ul className="divide-y divide-line">
          {data.recentAudit.map((a) => (
            <li key={a._id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <strong>{titleCase(a.action)}</strong> <span className="text-ink-500">by {a.user ? fullName(a.user) : 'system'}</span>
              </span>
              <span className="tabular text-ink-500">{fmtDateTime(a.timestamp)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
