/**
 * Module purpose: Shows business information, team access, and reminder preferences. Subsections use business permissions to enable or disable management actions.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useBusiness } from '../../context/BusinessContext';
import { del, errorMessage, get, patch, post, put } from '../../lib/api';
import { fmtDate, fullName, naira, ROLE_LABEL } from '../../lib/format';
import type { Business, Member, ReminderSettings } from '../../types';
import { Badge, Button, Checkbox, ConfirmDialog, ErrorState, Input, Modal, PageHeader, Select, SkeletonRows, Tabs } from '../../components/ui';
import { BusinessForm, BusinessFormValues, toPayload } from '../../components/business/BusinessForm';

type Tab = 'overview' | 'edit' | 'team' | 'reminders';

/**
 * Shows business information, team access, and reminder preferences. Subsections use business permissions to enable or disable management actions.
 */
export default function BusinessDetails() {
  const { id } = useParams();
  const { reload: reloadBusinesses } = useBusiness();
  const [tab, setTab] = useState<Tab>('overview');
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data: b, loading, error, reload } = useApi(() => get<Business>(`/businesses/${id}`), [id]);
  const [regenerating, setRegenerating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  if (loading && !b) return <SkeletonRows rows={8} />;
  if (error || !b) return <div className="panel"><ErrorState message={error ?? 'Business not found'} onRetry={reload} /></div>;

  // Permissions come from the backend business record; the UI hides actions not granted to this member.
  const perms = b.myPermissions ?? [];
  const can = (p: string) => perms.includes(p as never);

  const save = async (values: BusinessFormValues) => {
    try {
      const res = await patch<{ generation: { created: number; markedNotApplicable: number } | null }>(`/businesses/${b._id}`, toPayload(values));
      const g = res.data.generation;
      toast.success(g ? `Saved. ${g.created} new obligations, ${g.markedNotApplicable} no longer apply.` : 'Business details saved');
      await Promise.all([reload(), reloadBusinesses()]);
      setTab('overview');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Rebuild compliance tasks when the owner requests it; the backend retains existing task progress.
  const regenerate = async () => {
    setRegenerating(true);
    try {
      const res = await post<{ created: number; applicableRequirements: number }>(`/businesses/${b._id}/regenerate-tasks`);
      toast.success(`${res.data.applicableRequirements} requirements apply. ${res.data.created} new obligations added.`);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRegenerating(false);
    }
  };

  // Closing a business is confirmed first and preserves its history for later review.
  const close = async () => {
    setClosing(true);
    try {
      await post(`/businesses/${b._id}/close`);
      toast.success('Business closed. Open obligations are no longer tracked.');
      setConfirmClose(false);
      await Promise.all([reload(), reloadBusinesses()]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setClosing(false);
    }
  };

  // Editing is only offered to roles with business:update; overview remains readable for other members.
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'overview', label: 'Overview' },
    ...(can('business:update') ? [{ value: 'edit' as Tab, label: 'Edit details' }] : []),
    { value: 'team', label: 'Team' },
    { value: 'reminders', label: 'Reminders' },
  ];

  return (
    <div>
      <PageHeader
        back={
          <Link to="/app/businesses" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" /> Businesses
          </Link>
        }
        title={b.businessName}
        description={`${b.businessType} in ${b.state}`}
        actions={
          can('business:update') &&
          b.businessStatus !== 'CLOSED' && (
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={regenerating} onClick={regenerate}>
              Refresh obligations
            </Button>
          )
        }
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <section className="panel p-5">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Item label="Legal name" value={b.legalName} />
              <Item label="RC or BN number" value={b.registrationNumber} />
              <Item label="TIN" value={b.taxIdentificationNumber} />
              <Item label="Date of incorporation" value={b.dateOfIncorporation ? fmtDate(b.dateOfIncorporation) : undefined} />
              <Item label="Industry" value={b.industry} />
              <Item label="Location" value={[b.city, b.state].filter(Boolean).join(', ')} />
              <Item label="Employees" value={String(b.employeeCount)} />
              <Item label="Annual turnover" value={naira(b.annualTurnover)} />
              <Item label="Address" value={b.address} />
              <Item label="Contact" value={[b.phone, b.email].filter(Boolean).join(', ')} />
            </dl>
            <h2 className="mt-6 text-sm font-semibold">Registered for</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries({
                cacRegistered: 'CAC',
                taxRegistered: 'Tax ID',
                vatRegistered: 'VAT',
                pensionRegistered: 'Pension',
                regulatedProducts: 'Regulated products',
                importsExports: 'Imports/exports',
              }).map(([k, label]) => (
                <Badge key={k} tone={b.flags?.[k as keyof typeof b.flags] ? 'green' : 'neutral'}>
                  {b.flags?.[k as keyof typeof b.flags] ? label : `No ${label.toLowerCase()}`}
                </Badge>
              ))}
            </div>
          </section>
          <aside className="space-y-4">
            <section className="panel p-5">
              <p className="tabular text-4xl font-extrabold text-ledger-700">{b.compliance?.percentage ?? 100}%</p>
              <p className="text-sm text-ink-700">compliance rate</p>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-500">Completed</dt><dd className="tabular font-semibold">{b.compliance?.completed ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Open</dt><dd className="tabular font-semibold">{b.compliance?.open ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Overdue</dt><dd className="tabular font-semibold text-signal-600">{b.compliance?.overdue ?? 0}</dd></div>
              </dl>
            </section>
            <p className="text-sm text-ink-500">You are {ROLE_LABEL[b.myRole ?? '']?.toLowerCase()}.</p>
            {can('business:update') && b.businessStatus !== 'CLOSED' && (
              <Button variant="ghost" size="sm" className="text-signal-700" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmClose(true)}>
                Close this business
              </Button>
            )}
          </aside>
        </div>
      )}

      {tab === 'edit' && <BusinessForm initial={b} submitLabel="Save changes" onSubmit={save} onCancel={() => setTab('overview')} />}
      {tab === 'team' && <Team businessId={b._id} canManage={can('members:manage')} />}
      {tab === 'reminders' && <Reminders businessId={b._id} canManage={can('reminders:manage')} />}

      <ConfirmDialog
        open={confirmClose}
        title={`Close ${b.businessName}?`}
        message="Upcoming obligations will be marked not applicable and reminders stop. Records and documents are kept."
        confirmLabel="Close business"
        danger
        loading={closing}
        onConfirm={close}
        onClose={() => setConfirmClose(false)}
      />
    </div>
  );
}

/**
 * Renders one labeled business property, using a dash for information that has not been provided.
 */
function Item({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  );
}

/**
 * Loads members/invitations and handles role changes or invitations when the viewer has members:manage permission.
 */
function Team({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, loading, error, reload } = useApi(() => get<Member[]>(`/businesses/${businessId}/members`), [businessId]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ACCOUNTANT' | 'COMPLIANCE_OFFICER'>('ACCOUNTANT');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const invite = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Enter a valid email address');
    setSaving(true);
    try {
      const res = await post<Member>(`/businesses/${businessId}/members`, { email, role });
      toast.success(res.data.status === 'ACTIVE' ? 'Added to the team' : 'Invitation sent');
      setInviteOpen(false);
      setEmail('');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (m: Member, newRole: string) => {
    try {
      await patch(`/businesses/${businessId}/members/${m._id}`, { role: newRole });
      toast.success('Role updated');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await del(`/businesses/${businessId}/members/${removing._id}`);
      toast.success('Removed from the team');
      setRemoving(null);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-bold">Team</h2>
        {canManage && (
          <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
            Invite someone
          </Button>
        )}
      </div>
      {loading && !data ? (
        <SkeletonRows rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <ul className="divide-y divide-line">
          {(data ?? []).map((m) => (
            <li key={m._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.user ? fullName(m.user) : m.invitedEmail}</p>
                <p className="text-sm text-ink-500">
                  {m.user?.email ?? 'Invitation pending'}
                  {m.status === 'INVITED' && m.invitedAt ? `, invited ${fmtDate(m.invitedAt)}` : ''}
                </p>
              </div>
              {canManage && m.role !== 'OWNER' ? (
                <div className="flex items-center gap-2">
                  <Select
                    aria-label="Role"
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value)}
                    options={[
                      { value: 'ACCOUNTANT', label: 'Accountant' },
                      { value: 'COMPLIANCE_OFFICER', label: 'Compliance officer' },
                    ]}
                    className="py-1.5"
                  />
                  <button onClick={() => setRemoving(m)} className="rounded p-1.5 text-ink-400 hover:bg-signal-50 hover:text-signal-600" aria-label="Remove member">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Badge tone={m.role === 'OWNER' ? 'ink' : 'neutral'}>{ROLE_LABEL[m.role]}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite someone"
        description="If they don't have an account yet, they'll get an email to create one and join this business."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={invite}>Send invitation</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            hint={role === 'ACCOUNTANT' ? 'Updates obligations, records filings and uploads documents.' : 'Also manages reminders and can mark obligations not applicable.'}
            options={[
              { value: 'ACCOUNTANT', label: 'Accountant' },
              { value: 'COMPLIANCE_OFFICER', label: 'Compliance officer' },
            ]}
          />
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove from team?"
        message={`${removing?.user ? fullName(removing.user) : removing?.invitedEmail} will lose access to this business.`}
        confirmLabel="Remove"
        danger
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}

const OFFSETS = [60, 30, 14, 7, 3, 1, 0];

/**
 * Reads and edits the business’s *automatic* reminder timing and delivery preferences; manual Super Admin reminders are separate.
 */
function Reminders({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, loading, error, reload, setData } = useApi(() => get<ReminderSettings>(`/businesses/${businessId}/reminder-settings`), [businessId]);
  const [saving, setSaving] = useState(false);
  if (loading && !data) return <SkeletonRows rows={4} />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load settings'} onRetry={reload} />;

  const toggleOffset = (d: number) => {
    const has = data.daysBefore.includes(d);
    setData({ ...data, daysBefore: has ? data.daysBefore.filter((x) => x !== d) : [...data.daysBefore, d].sort((a, b) => b - a) });
  };

  const save = async () => {
    if (data.daysBefore.length === 0) return toast.error('Choose at least one reminder day');
    setSaving(true);
    try {
      await put(`/businesses/${businessId}/reminder-settings`, data);
      toast.success('Reminder settings saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel p-5">
      <h2 className="font-bold">When to remind the team</h2>
      <p className="mt-1 text-sm text-ink-500">Everyone on the team is reminded. Each reminder is sent once per obligation.</p>
      <fieldset className="mt-4" disabled={!canManage}>
        <legend className="label">Days before the deadline</legend>
        <div className="flex flex-wrap gap-2">
          {OFFSETS.map((d) => {
            const on = data.daysBefore.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleOffset(d)}
                aria-pressed={on}
                className={`tabular rounded border px-3 py-1.5 text-sm font-semibold ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-white text-ink-700 hover:bg-paper'}`}
              >
                {d === 0 ? 'On the day' : `${d} day${d === 1 ? '' : 's'}`}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-6 space-y-3">
        <Checkbox label="Remind when overdue" description="After 1, 7, 14 and 30 days" checked={data.remindWhenOverdue} disabled={!canManage} onChange={(e) => setData({ ...data, remindWhenOverdue: e.target.checked })} />
        <Checkbox label="Send email" checked={data.emailEnabled} disabled={!canManage} onChange={(e) => setData({ ...data, emailEnabled: e.target.checked })} />
        <Checkbox label="Show in the app" checked={data.inAppEnabled} disabled={!canManage} onChange={(e) => setData({ ...data, inAppEnabled: e.target.checked })} />
      </div>
      {canManage ? (
        <Button className="mt-6" loading={saving} onClick={save}>
          Save reminder settings
        </Button>
      ) : (
        <p className="mt-6 text-sm text-ink-500">Only the owner or a compliance officer can change these.</p>
      )}
    </section>
  );
}
