/**
 * Module purpose: Shows recorded manual email attempts, filters by type/status, and opens a detailed delivery-attempt record.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { errorMessage, get } from '../../lib/api';
import { fmtDate, fmtDateTime, fullName } from '../../lib/format';
import type { ManualEmailLog, Ref } from '../../types';
import { Badge, Button, ButtonLink, EmptyState, ErrorState, Modal, PageHeader, Pagination, Select, SkeletonRows, Table, Td } from '../../components/ui';

const typeLabel = (t: ManualEmailLog['type']) => t === 'GENERAL' ? 'General Email' : 'Manual Reminder';

/**
 * Lists persisted email attempts and fetches full message details only when a Super Admin opens a record.
 */
export default function AdminEmailHistory() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, error, loading, reload } = useApi(
    () => get<ManualEmailLog[]>('/admin/emails', { type, status, page, limit: 20 }), [type, status, page],
  );
  const [selected, setSelected] = useState<ManualEmailLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch full message content only when a history row is opened.
  const view = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await get<ManualEmailLog>(`/admin/emails/${id}`);
      setSelected(res.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Email history" description="Super Admin manual email and reminder delivery attempts. Sent means accepted by SMTP, not guaranteed inbox delivery."
        actions={<>
          <ButtonLink to="/admin/emails/new?type=GENERAL">Send Email</ButtonLink>
          <ButtonLink to="/admin/emails/new?type=MANUAL_REMINDER" variant="secondary">Send Reminder</ButtonLink>
        </>} />
      <div className="mb-4 grid gap-3 sm:max-w-xl sm:grid-cols-2">
        <Select aria-label="Email type" value={type} placeholder="All email types"
          options={[{ value: 'GENERAL', label: 'General Email' }, { value: 'MANUAL_REMINDER', label: 'Manual Reminder' }]}
          onChange={(e) => { setType(e.target.value); setPage(1); }} />
        <Select aria-label="Sending status" value={status} placeholder="All statuses"
          options={['SENT', 'FAILED', 'PENDING'].map((s) => ({ value: s, label: s === 'PENDING' ? 'Sending' : s === 'SENT' ? 'Sent' : 'Failed' }))}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
      </div>
      <div className="panel">
        {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : data?.length ? (
          <>
            <Table head={['Recipient', 'Subject and type', 'Date and time', 'Status', 'Initiated by', '']}>
              {data.map((mail) => (
                <tr key={mail._id} className="block py-2 md:table-row md:py-0">
                  <Td>
                    <span className="font-semibold">{mail.recipientName}</span>
                    <span className="block text-xs text-ink-500">{mail.recipientEmail}</span>
                  </Td>
                  <Td>
                    <span className="font-semibold">{mail.subject}</span>
                    <span className="block text-xs text-ink-500">{typeLabel(mail.type)}</span>
                  </Td>
                  <Td label="Date" className="tabular">{fmtDateTime(mail.sentAt ?? mail.attemptedAt)}</Td>
                  <Td>
                    {mail.status === 'SENT' ? <Badge tone="green">Sent</Badge> :
                      mail.status === 'FAILED' ? <Badge tone="red">Failed</Badge> : <Badge>Sending</Badge>}
                  </Td>
                  <Td label="By">{typeof mail.initiatedBy === 'string' ? '—' : fullName(mail.initiatedBy)}</Td>
                  <Td><Button size="sm" variant="ghost" disabled={detailLoading} onClick={() => void view(mail._id)}>View details</Button></Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : <EmptyState title="No manual emails yet" message="Send an individual email or reminder to create a history record."
          action={<Link className="link text-sm" to="/admin/emails/new">Send an email</Link>} />}
      </div>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Email details" size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
        {selected && (
          <div className="space-y-3 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div><dt className="text-ink-500">Recipient</dt><dd className="font-medium">{selected.recipientName} ({selected.recipientEmail})</dd></div>
              <div><dt className="text-ink-500">Sent by</dt><dd className="font-medium">{typeof selected.initiatedBy === 'string' ? '—' : fullName(selected.initiatedBy as Ref)}</dd></div>
              <div><dt className="text-ink-500">Type</dt><dd>{typeLabel(selected.type)}</dd></div>
              <div><dt className="text-ink-500">Status</dt><dd>{selected.status === 'PENDING' ? 'Sending' : selected.status}</dd></div>
              <div><dt className="text-ink-500">Attempted</dt><dd>{fmtDateTime(selected.attemptedAt)}</dd></div>
              <div><dt className="text-ink-500">Accepted by SMTP</dt><dd>{fmtDateTime(selected.sentAt)}</dd></div>
            </dl>
            <div><span className="text-ink-500">Subject</span><p className="font-semibold">{selected.subject}</p></div>
            {selected.obligationName && (
              <div className="rounded bg-paper p-3">
                <p className="font-semibold">{selected.obligationName}</p>
                <p>{selected.businessName} · Due {fmtDate(selected.dueDate)}</p>
                {selected.obligationDetails && <p className="mt-1 whitespace-pre-wrap">{selected.obligationDetails}</p>}
              </div>
            )}
            <div><p className="font-medium text-ink-500">Message ({selected.format === 'RICH_TEXT' ? 'Rich text source' : 'Plain text'})</p>
              <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-line bg-paper p-3 font-sans">{selected.message}</pre>
            </div>
            {selected.failureCode && <p className="text-signal-600">Delivery failure: {selected.failureCode}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
