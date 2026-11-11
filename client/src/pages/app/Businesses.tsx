/**
 * Module purpose: Lists businesses available to the signed-in user and links to business management screens.
 */
import { Link } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { ROLE_LABEL } from '../../lib/format';
import { Badge, ButtonLink, EmptyState, PageHeader, SkeletonRows } from '../../components/ui';

/**
 * Lists businesses available to the signed-in user and links to business management screens.
 */
export default function Businesses() {
  const { businesses, loading, current, setCurrentId } = useBusiness();
  return (
    <div>
      <PageHeader
        title="Businesses"
        description="Each business gets its own obligations, team and reminders."
        actions={
          <ButtonLink to="/app/businesses/new">
            <Plus className="h-4 w-4" /> Add business
          </ButtonLink>
        }
      />
      <div className="panel">
        {loading && businesses.length === 0 ? (
          <SkeletonRows />
        ) : businesses.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No businesses yet"
            message="Add your business to see which filings apply."
            action={<ButtonLink to="/app/businesses/new">Add business</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {businesses.map((b) => {
              const c = b.compliance;
              return (
                <li key={b._id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/app/businesses/${b._id}`} className="font-bold hover:underline">
                        {b.businessName}
                      </Link>
                      {b.businessStatus !== 'ACTIVE' && <Badge>{b.businessStatus.toLowerCase()}</Badge>}
                      {b.isDemo && <Badge tone="amber">Demo</Badge>}
                      {current?._id === b._id && <Badge tone="green">Current</Badge>}
                    </div>
                    <p className="text-sm text-ink-500">
                      {b.businessType} in {b.state}, {b.employeeCount} staff. You are {ROLE_LABEL[b.myRole ?? '']?.toLowerCase() ?? 'a member'}.
                    </p>
                  </div>
                  {c && (
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="tabular text-xl font-extrabold text-ledger-700">{c.percentage}%</p>
                        <p className="text-xs text-ink-500">compliance</p>
                      </div>
                      <div className="text-right">
                        <p className={`tabular text-xl font-extrabold ${c.overdue ? 'text-signal-600' : 'text-ink-300'}`}>{c.overdue}</p>
                        <p className="text-xs text-ink-500">overdue</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {current?._id !== b._id && (
                      <button onClick={() => setCurrentId(b._id)} className="rounded border border-line px-3 py-1.5 text-sm font-semibold hover:bg-paper">
                        Switch to
                      </button>
                    )}
                    <ButtonLink to={`/app/businesses/${b._id}`} variant="secondary" size="sm">
                      Open
                    </ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
