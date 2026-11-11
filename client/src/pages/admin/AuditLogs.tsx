/**
 * Module purpose: Displays who performed sensitive actions and when, supporting administrative accountability and troubleshooting.
 */
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { fmtDateTime, fullName, titleCase } from '../../lib/format';
import type { AuditEntry, PageMeta } from '../../types';
import { EmptyState, ErrorState, Input, PageHeader, Pagination, Select, SkeletonRows, Table, Td } from '../../components/ui';

/**
 * Displays who performed sensitive actions and when, supporting administrative accountability and troubleshooting.
 */
export default function AuditLogs() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{ items: AuditEntry[]; meta?: PageMeta; actions: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/audit-logs', { params: { action: action || undefined, from: from || undefined, to: to ? `${to}T23:59:59` : undefined, page, limit: 30 } });
      setState({ items: res.data.data, meta: res.data.meta, actions: res.data.actions });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [action, from, to, page]);

  return (
    <div>
      <PageHeader title="Audit log" description="Sign-ins, changes to businesses and regulatory data, filings and uploads." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
        <Select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="All actions" options={(state?.actions ?? []).map((a) => ({ value: a, label: titleCase(a) }))} />
        <Input aria-label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input aria-label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>
      <div className="panel">
        {loading && !state ? (
          <SkeletonRows rows={10} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : state?.items.length ? (
          <>
            <Table head={['When', 'Action', 'By', 'Record', 'Details']}>
              {state.items.map((a) => (
                <tr key={a._id} className="block py-2 align-top md:table-row md:py-0">
                  <Td className="tabular whitespace-nowrap">{fmtDateTime(a.timestamp)}</Td>
                  <Td className="font-semibold">{titleCase(a.action)}</Td>
                  <Td label="By">
                    {a.user ? fullName(a.user) : 'System'}
                    {a.ip && <span className="block text-xs text-ink-500">{a.ip}</span>}
                  </Td>
                  <Td label="Record">
                    {a.entity}
                    {a.businessId?.businessName && <span className="block text-xs text-ink-500">{a.businessId.businessName}</span>}
                  </Td>
                  <Td label="Details">
                    {a.metadata && Object.keys(a.metadata).length > 0 ? (
                      <code className="block max-w-xs overflow-x-auto whitespace-pre text-xs text-ink-700">{JSON.stringify(a.metadata, null, 1)}</code>
                    ) : (
                      '—'
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={state.meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState title="No entries match" />
        )}
      </div>
    </div>
  );
}
