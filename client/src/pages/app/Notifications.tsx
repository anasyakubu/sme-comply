/**
 * Module purpose: Shows in-app notifications and allows the current user to mark or delete their own items.
 */
import { ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlarmClock, AlertOctagon, Bell, CheckCircle2, FileCheck2, Info, Trash2, UserPlus } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { del, errorMessage, get, patch, post } from '../../lib/api';
import { fmtAgo } from '../../lib/format';
import type { AppNotification } from '../../types';
import { Button, EmptyState, ErrorState, PageHeader, Pagination, SkeletonRows, Tabs } from '../../components/ui';

const ICONS: Record<AppNotification['type'], ReactElement> = {
  REMINDER: <AlarmClock className="h-5 w-5 text-due-600" />,
  DUE_TODAY: <AlarmClock className="h-5 w-5 text-due-700" />,
  OVERDUE: <AlertOctagon className="h-5 w-5 text-signal-600" />,
  TASK_COMPLETED: <CheckCircle2 className="h-5 w-5 text-ledger-600" />,
  FILING_RECORDED: <FileCheck2 className="h-5 w-5 text-ledger-600" />,
  DOCUMENT_UPLOADED: <FileCheck2 className="h-5 w-5 text-ink-500" />,
  INVITATION: <UserPlus className="h-5 w-5 text-ink-700" />,
  SYSTEM: <Info className="h-5 w-5 text-ink-500" />,
};

/**
 * Shows in-app notifications and allows the current user to mark or delete their own items.
 */
export default function Notifications() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, loading, error, reload, setData } = useApi(
    () => get<AppNotification[]>('/notifications', { read: filter === 'unread' ? 'false' : undefined, page, limit: 25 }),
    [filter, page],
  );

  const markRead = async (n: AppNotification) => {
    if (n.read) return;
    setData((data ?? []).map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    await patch(`/notifications/${n._id}/read`).catch(() => undefined);
  };

  const markAll = async () => {
    try {
      await post('/notifications/read-all');
      toast.success('All notifications marked as read');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (id: string) => {
    try {
      await del(`/notifications/${id}`);
      setData((data ?? []).filter((x) => x._id !== id));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Reminders about upcoming and overdue obligations, and updates from your team."
        actions={
          <Button variant="secondary" onClick={markAll}>
            Mark all as read
          </Button>
        }
      />
      <Tabs
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
        ]}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
      />
      <div className="panel">
        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.length ? (
          <>
            <ul className="divide-y divide-line">
              {data.map((n) => (
                <li key={n._id} className={`flex gap-3 px-4 py-3.5 ${n.read ? '' : 'bg-ledger-50/50'}`}>
                  <span className="mt-0.5 shrink-0" aria-hidden>
                    {ICONS[n.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    {n.relatedTaskId ? (
                      <Link to={`/app/tasks/${n.relatedTaskId}`} onClick={() => markRead(n)} className="font-semibold hover:underline">
                        {n.title}
                      </Link>
                    ) : (
                      <p className="font-semibold">{n.title}</p>
                    )}
                    <p className="text-sm text-ink-700">{n.message}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {fmtAgo(n.createdAt)}
                      {n.businessId?.businessName ? `, ${n.businessId.businessName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {!n.read && (
                      <button onClick={() => markRead(n)} className="rounded px-2 py-1 text-xs font-semibold text-ledger-700 hover:bg-ledger-50">
                        Mark read
                      </button>
                    )}
                    <button onClick={() => remove(n._id)} className="rounded p-1.5 text-ink-400 hover:bg-paper hover:text-signal-600" aria-label="Delete notification">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState icon={<Bell className="h-8 w-8" />} title={filter === 'unread' ? "You're all caught up" : 'No notifications yet'} message="Reminders appear here as deadlines approach." />
        )}
      </div>
    </div>
  );
}
