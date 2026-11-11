/**
 * Module purpose: Lists registered users and supports administrator-approved account changes and individual communication actions.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, get, patch } from '../../lib/api';
import { fmtDate, fullName, ROLE_LABEL } from '../../lib/format';
import type { User } from '../../types';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, SkeletonRows, Table, Td } from '../../components/ui';

const ROLES = ['OWNER', 'ACCOUNTANT', 'COMPLIANCE_OFFICER', 'ADMIN', 'SUPER_ADMIN'];

/**
 * Lists registered users and supports administrator-approved account changes and individual communication actions.
 */
export default function Users() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, loading, error, reload } = useApi(() => get<User[]>('/admin/users', { search: q, role, page, limit: 20 }), [q, role, page]);
  const [confirm, setConfirm] = useState<User | null>(null);

  const update = async (u: User, body: Partial<User>, message: string) => {
    try {
      await patch(`/admin/users/${u._id}`, body);
      toast.success(message);
      setConfirm(null);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const assignable = me?.role === 'SUPER_ADMIN' ? ROLES : ROLES.filter((r) => !['ADMIN', 'SUPER_ADMIN'].includes(r));

  return (
    <div>
      <PageHeader title="Users" description="Everyone with an account. Deactivated users can't sign in." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or email" />
        <Select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} placeholder="All roles" options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
      </div>
      <div className="panel">
        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data?.length ? (
          <>
            <Table head={['User', 'Role', 'Businesses', 'Joined', 'Status', '']}>
              {data.map((u) => {
                const self = u._id === me?._id;
                const locked = self || (u.role === 'SUPER_ADMIN' && me?.role !== 'SUPER_ADMIN');
                return (
                  <tr key={u._id} className="block py-2 md:table-row md:py-0">
                    <Td>
                      <span className="font-semibold">{fullName(u)}</span>
                      <span className="block text-xs text-ink-500">{u.email}</span>
                    </Td>
                    <Td label="Role">
                      {locked ? (
                        ROLE_LABEL[u.role]
                      ) : (
                        <Select
                          aria-label={`Role for ${fullName(u)}`}
                          className="py-1"
                          value={u.role}
                          onChange={(e) => update(u, { role: e.target.value as User['role'] }, 'Role updated')}
                          options={(assignable.includes(u.role) ? assignable : [u.role, ...assignable]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                        />
                      )}
                    </Td>
                    <Td label="Businesses" className="tabular">{u.businessCount ?? 0}</Td>
                    <Td label="Joined" className="tabular">{fmtDate(u.createdAt)}</Td>
                    <Td>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</Td>
                    <Td className="text-right">
                      {me?.role === 'SUPER_ADMIN' && u.isActive && (
                        <span className="mr-2 inline-flex flex-wrap gap-2">
                          <Link className="link text-xs" to={`/admin/emails/new?type=GENERAL&userId=${u._id}`}>Send Email</Link>
                          <Link className="link text-xs" to={`/admin/emails/new?type=MANUAL_REMINDER&userId=${u._id}`}>Send Reminder</Link>
                        </span>
                      )}
                      {!locked && (
                        <Button size="sm" variant="ghost" onClick={() => (u.isActive ? setConfirm(u) : update(u, { isActive: true }, 'User reactivated'))}>
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </Table>
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState title="No users match" />
        )}
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Deactivate ${confirm ? fullName(confirm) : ''}?`}
        message="They will be signed out and can't sign in until reactivated. Their records are kept."
        confirmLabel="Deactivate user"
        danger
        onConfirm={() => confirm && update(confirm, { isActive: false }, 'User deactivated')}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
