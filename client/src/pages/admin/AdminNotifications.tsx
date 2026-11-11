/**
 * Module purpose: Lets administrators review platform notifications with filtering and pagination.
 */
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { fmtDateTime, fullName, titleCase } from '../../lib/format';
import type { AppNotification, PageMeta } from '../../types';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, Select, SkeletonRows, Table, Td } from '../../components/ui';

const TYPES = ['REMINDER', 'DUE_TODAY', 'OVERDUE', 'TASK_COMPLETED', 'FILING_RECORDED', 'INVITATION', 'SYSTEM'];

/**
 * Lets administrators review platform notifications with filtering and pagination.
 */
export default function AdminNotifications() {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{ items: AppNotification[]; meta?: PageMeta; byType: Array<{ _id: string; count: number }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/notifications', { params: { type: type || undefined, page, limit: 25 } });
      setState({ items: res.data.data, meta: res.data.meta, byType: res.data.byType });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [type, page]);

  return (
    <div>
      <PageHeader title="Notifications" description="Reminders and updates sent across the platform." />
      {state && (
        <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {state.byType.map((t) => (
            <div key={t._id} className="flex gap-2">
              <dt className="text-ink-500">{titleCase(t._id)}</dt>
              <dd className="tabular font-semibold">{t.count}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mb-4 max-w-xs">
        <Select aria-label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} placeholder="All types" options={TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
      </div>
      <div className="panel">
        {loading && !state ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : state?.items.length ? (
          <>
            <Table head={['Notification', 'Recipient', 'Business', 'Email', 'Sent']}>
              {state.items.map((n) => (
                <tr key={n._id} className="block py-2 md:table-row md:py-0">
                  <Td>
                    <span className="font-semibold">{n.title}</span>
                    <span className="block text-xs text-ink-500">{titleCase(n.type)}</span>
                  </Td>
                  <Td label="To">{fullName(n.userId)}</Td>
                  <Td label="Business">{n.businessId?.businessName ?? '—'}</Td>
                  <Td>{n.emailSent ? <Badge tone="green">Emailed</Badge> : <Badge>In app</Badge>}</Td>
                  <Td label="Sent" className="tabular">{fmtDateTime(n.createdAt)}</Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={state.meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState title="No notifications" />
        )}
      </div>
    </div>
  );
}
