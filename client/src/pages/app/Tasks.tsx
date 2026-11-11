/**
 * Module purpose: Searches, filters, and paginates compliance tasks associated with the current business.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useLookups } from '../../hooks/useLookups';
import { get } from '../../lib/api';
import type { Agency, ComplianceTask } from '../../types';
import { EmptyState, ErrorState, Input, PageHeader, Pagination, SearchInput, Select, SkeletonRows, Tabs } from '../../components/ui';
import { TaskList } from '../../components/tasks/TaskList';
import { NoBusiness } from '../../components/business/NoBusiness';

const TABS = [
  { value: 'UPCOMING,PENDING,IN_PROGRESS,OVERDUE', label: 'Open' },
  { value: 'PENDING,IN_PROGRESS', label: 'Due soon' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NOT_APPLICABLE', label: 'Not applicable' },
  { value: '', label: 'All' },
];

/**
 * Searches, filters, and paginates compliance tasks associated with the current business.
 */
export default function Tasks() {
  const { current, loading: loadingBusinesses } = useBusiness();
  const options = useLookups();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? TABS[0].value;
  const [search, setSearch] = useState(params.get('search') ?? '');
  // Debounce typed search terms to avoid requests on every keystroke.
  const q = useDebounce(search);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState(status === 'COMPLETED' ? '-dueDate' : 'dueDate');

  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const agencies = useApi(() => get<Agency[]>('/agencies', { limit: 100, active: 'true' }), []);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, loading, error, reload } = useApi(
    () =>
      get<ComplianceTask[]>('/compliance-tasks', {
        businessId: current!._id,
        status: status || undefined,
        includeNotApplicable: status === '' ? 'true' : undefined,
        search: q,
        category,
        agencyId,
        from,
        to,
        sort,
        page,
        limit: 25,
      }),
    [current?._id, status, q, category, agencyId, from, to, sort, page],
    Boolean(current),
  );

  if (!loadingBusinesses && !current) return <NoBusiness />;

  const setStatus = (value: string) => {
    setPage(1);
    const next = new URLSearchParams(params);
    if (value === TABS[0].value) next.delete('status');
    else next.set('status', value);
    setParams(next, { replace: true });
    setSort(value === 'COMPLETED' ? '-dueDate' : 'dueDate');
  };

  return (
    <div>
      <PageHeader
        title="Obligations"
        description={`Every filing and payment ${current?.businessName ?? 'this business'} owes, generated from its profile.`}
      />
      <Tabs tabs={TABS} value={TABS.some((t) => t.value === status) ? status : TABS[0].value} onChange={setStatus} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr_0.9fr]">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search obligations" />
        <Select aria-label="Agency" value={agencyId} onChange={(e) => { setAgencyId(e.target.value); setPage(1); }} placeholder="All agencies" options={(agencies.data ?? []).map((a) => ({ value: a._id, label: a.acronym }))} />
        <Select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder="All categories" options={options?.categories ?? []} />
        <Input aria-label="Due from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input aria-label="Due to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <Select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          options={[
            { value: 'dueDate', label: 'Soonest first' },
            { value: '-dueDate', label: 'Latest first' },
            { value: 'title', label: 'Name A–Z' },
          ]}
        />
      </div>

      <div className="panel">
        {loading && !data ? (
          <SkeletonRows rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.length > 0 ? (
          <>
            <div className="hidden border-b border-line px-4 py-2 text-xs font-semibold text-ink-500 sm:flex sm:gap-5">
              <span className="w-16 text-right">Days</span>
              <span className="flex-1">Obligation</span>
              <span className="w-28">Due date</span>
              <span className="hidden w-24 md:block">Priority</span>
              <span className="w-28 text-right">Status</span>
            </div>
            <TaskList tasks={data} />
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon={<ListChecks className="h-8 w-8" />}
            title="No obligations match"
            message={q || category || agencyId || from || to ? 'Try clearing a filter.' : 'Nothing in this list right now.'}
          />
        )}
      </div>
    </div>
  );
}
