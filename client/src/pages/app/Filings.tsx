/**
 * Module purpose: Displays recorded submissions and their status so users can track evidence of regulatory filing.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { get } from '../../lib/api';
import { fmtDate, fullName, naira } from '../../lib/format';
import type { Filing } from '../../types';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, SkeletonRows, Table, Td } from '../../components/ui';
import { NoBusiness } from '../../components/business/NoBusiness';

/**
 * Displays recorded submissions and their status so users can track evidence of regulatory filing.
 */
export default function Filings() {
  const { current, loading: loadingBusinesses } = useBusiness();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, loading, error, reload } = useApi(
    () => get<Filing[]>('/filings', { businessId: current!._id, search: q, status, page, limit: 20 }),
    [current?._id, q, status, page],
    Boolean(current),
  );
  if (!loadingBusinesses && !current) return <NoBusiness />;

  return (
    <div>
      <PageHeader title="Filing records" description="What was submitted, when, and the reference numbers to prove it." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by reference number" />
        <Select
          aria-label="Status"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          placeholder="All statuses"
          options={[
            { value: 'SUBMITTED', label: 'Submitted' },
            { value: 'ACCEPTED', label: 'Accepted' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
        />
      </div>
      <div className="panel">
        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.length ? (
          <>
            <Table head={['Obligation', 'Filed on', 'Reference', 'Amount', 'Recorded by', 'Status']}>
              {data.map((f) => {
                const task = typeof f.taskId === 'object' ? f.taskId : null;
                return (
                  <tr key={f._id} className="block py-2 md:table-row md:py-0">
                    <Td>
                      {task ? (
                        <Link to={`/app/tasks/${task._id}`} className="font-semibold hover:underline">
                          {task.title}
                        </Link>
                      ) : (
                        '—'
                      )}
                      <span className="block text-xs text-ink-500">{task?.periodLabel}</span>
                    </Td>
                    <Td label="Filed" className="tabular">{fmtDate(f.filingDate)}</Td>
                    <Td label="Ref">{f.referenceNumber || '—'}</Td>
                    <Td label="Amount" className="tabular">{f.amountPaid ? naira(f.amountPaid) : '—'}</Td>
                    <Td label="By">{fullName(f.filedBy)}</Td>
                    <Td>
                      <Badge tone={f.status === 'ACCEPTED' ? 'green' : f.status === 'REJECTED' ? 'red' : 'neutral'}>{f.status.toLowerCase()}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </Table>
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon={<FileCheck2 className="h-8 w-8" />}
            title="No filings recorded"
            message="Open an obligation and choose Record filing after you submit it to the agency."
          />
        )}
      </div>
    </div>
  );
}
