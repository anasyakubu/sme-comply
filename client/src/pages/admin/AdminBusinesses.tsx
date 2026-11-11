/**
 * Module purpose: Allows administrators to search and inspect businesses registered in the platform.
 */
import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useLookups } from '../../hooks/useLookups';
import { get } from '../../lib/api';
import { fmtDate, fullName } from '../../lib/format';
import type { Business, Ref } from '../../types';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, SkeletonRows, Table, Td } from '../../components/ui';

/**
 * Allows administrators to search and inspect businesses registered in the platform.
 */
export default function AdminBusinesses() {
  const options = useLookups();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, loading, error, reload } = useApi(() => get<Business[]>('/admin/businesses', { search: q, state, page, limit: 20, sort: '-createdAt' }), [q, state, page]);

  return (
    <div>
      <PageHeader title="Businesses" description="All businesses on the platform with their compliance position." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or RC number" />
        <Select aria-label="State" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} placeholder="All states" options={options?.states ?? []} />
      </div>
      <div className="panel">
        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data?.length ? (
          <>
            <Table head={['Business', 'Owner', 'Location', 'Compliance', 'Overdue', 'Added']}>
              {data.map((b) => (
                <tr key={b._id} className="block py-2 md:table-row md:py-0">
                  <Td>
                    <span className="font-semibold">{b.businessName}</span>
                    {b.businessStatus !== 'ACTIVE' && <span className="ml-2"><Badge>{b.businessStatus.toLowerCase()}</Badge></span>}
                    <span className="block text-xs text-ink-500">{b.businessType}, {b.industry}</span>
                  </Td>
                  <Td label="Owner">{fullName(b.owner as Ref)}</Td>
                  <Td label="Location">{b.state}</Td>
                  <Td label="Compliance" className="tabular font-semibold">{b.compliance?.percentage ?? 100}%</Td>
                  <Td label="Overdue" className={`tabular ${b.compliance?.overdue ? 'font-semibold text-signal-600' : ''}`}>{b.compliance?.overdue ?? 0}</Td>
                  <Td label="Added" className="tabular">{fmtDate(b.createdAt)}</Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState title="No businesses match" />
        )}
      </div>
    </div>
  );
}
