/**
 * Module purpose: Super Admin compose form for individual messages or manual obligation reminders. It verifies recipient and obligation selection before posting to the protected API.
 */
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useApi } from '../../hooks/useApi';
import { errorMessage, get, post } from '../../lib/api';
import { fmtDate, fullName } from '../../lib/format';
import type { EmailObligation, User } from '../../types';
import { Button, ErrorState, Input, PageHeader, Select, SkeletonRows, Textarea } from '../../components/ui';

type EmailType = 'GENERAL' | 'MANUAL_REMINDER';
type Format = 'TEXT' | 'RICH_TEXT';

/**
 * Combines user search, obligation lookup, a message form, and request-ID reuse to avoid accidental duplicate manual emails.
 */
export default function AdminComposeEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [type, setType] = useState<EmailType>(params.get('type') === 'MANUAL_REMINDER' ? 'MANUAL_REMINDER' : 'GENERAL');
  const [recipient, setRecipient] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const query = useDebounce(search);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [format, setFormat] = useState<Format>('TEXT');
  const [taskId, setTaskId] = useState('');
  const [obligationSearch, setObligationSearch] = useState('');
  const obligationQuery = useDebounce(obligationSearch);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const [sendError, setSendError] = useState('');
  const [hasAttempted, setHasAttempted] = useState(false);

  // User list search is server-side, including users beyond the first page.
  const users = useApi(() => get<User[]>('/admin/users', { search: query, isActive: 'true', limit: 50 }), [query]);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const obligations = useApi(() => get<EmailObligation[]>('/admin/emails/obligations',
    { recipientId: recipient?._id, search: obligationQuery }),
    [recipient?._id, obligationQuery], Boolean(recipient && type === 'MANUAL_REMINDER'));

  useEffect(() => {
    const id = params.get('userId');
    if (!id) return;
    let cancelled = false;
    get<{ user: User }>(`/admin/users/${encodeURIComponent(id)}`)
      .then((res) => { if (!cancelled && res.data.user.isActive) setRecipient(res.data.user); })
      .catch((err) => { if (!cancelled) toast.error(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [params]);

  // Editing the draft starts a new request identity so a revised email is not mistaken for an earlier attempt.
  const changed = () => {
    requestId.current = crypto.randomUUID();
    setSendError('');
    setHasAttempted(false);
  };
  // Clear task and draft details when the recipient changes to prevent sending another user’s obligation.
  const chooseRecipient = (u: User) => {
    changed();
    setRecipient(u);
    setTaskId('');
    setObligationSearch('');
    setSubject('');
    setMessage('');
  };
  // Pre-fill a useful reminder while leaving its subject and message editable.
  const chooseTask = (id: string) => {
    changed();
    setTaskId(id);
    const task = obligations.data?.find((t) => t._id === id);
    if (task && recipient) {
      setSubject(`Compliance reminder: ${task.title} — due ${fmtDate(task.dueDate)}`);
      setMessage(`Hello ${recipient.firstName},\n\nPlease review your upcoming compliance obligation and take any necessary action before the deadline.\n\nRegards,\nSME Comply`);
    }
  };
  // The ref blocks double clicks before React state updates; the backend also enforces request uniqueness.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email) || (type === 'MANUAL_REMINDER' && !taskId)) return;
    submitting.current = true;
    setSaving(true);
    setSendError('');
    try {
      await post('/admin/emails', {
        recipientId: recipient._id, requestId: requestId.current,
        type, ...(type === 'MANUAL_REMINDER' ? { taskId } : {}), subject, message, format,
      });
      toast.success('Email accepted by SMTP. A record was saved in email history.');
      navigate('/admin/emails');
    } catch (err) {
      setSendError(errorMessage(err));
      setHasAttempted(true);
      toast.error(errorMessage(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const task = obligations.data?.find((t) => t._id === taskId);
  const emailValid = Boolean(recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email));

  return (
    <div>
      <PageHeader
        title={type === 'GENERAL' ? 'Send Email' : 'Send Reminder'}
        description="Send one email directly to a registered user. This action is independent of scheduled reminders."
        back={<Link to="/admin/emails" className="link">Email history</Link>}
      />
      <form onSubmit={submit} className="panel max-w-3xl space-y-5 p-5">
        <Select
          label="Communication type" value={type}
          options={[{ value: 'GENERAL', label: 'General Email' }, { value: 'MANUAL_REMINDER', label: 'Manual Reminder' }]}
          disabled={saving}
          onChange={(e) => { changed(); setType(e.target.value as EmailType); setTaskId(''); setSubject(''); setMessage(''); }}
        />
        <div>
          <label htmlFor="recipient-search" className="label">Recipient <span className="text-signal-600">*</span></label>
          {recipient ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-ledger-200 bg-ledger-50 p-3 text-sm">
              <div>
                <strong>{fullName(recipient)}</strong>
                <span className="block text-ink-600">{recipient.email}</span>
                {!emailValid && <span className="block text-signal-600">This account has an invalid email address.</span>}
              </div>
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => {
                changed(); setRecipient(null); setTaskId(''); setSubject(''); setMessage('');
              }}>Change recipient</Button>
            </div>
          ) : (
            <>
              <input id="recipient-search" className="input" type="search" value={search}
                placeholder="Search registered users by name or email"
                onChange={(e) => setSearch(e.target.value)} disabled={saving} />
              <div className="mt-2 max-h-52 overflow-auto rounded border border-line" aria-label="Matching recipients">
                {users.loading && !users.data ? <SkeletonRows rows={3} /> : users.error ? (
                  <ErrorState message={users.error} onRetry={users.reload} />
                ) : users.data?.length ? users.data.map((u) => (
                  <button type="button" key={u._id} onClick={() => chooseRecipient(u)}
                    className="block w-full border-b border-line px-3 py-2 text-left text-sm hover:bg-paper last:border-0">
                    <span className="font-semibold">{fullName(u)}</span>
                    <span className="ml-2 text-ink-500">{u.email}</span>
                  </button>
                )) : <p className="px-3 py-4 text-sm text-ink-500">No active users found.</p>}
              </div>
            </>
          )}
        </div>

        {type === 'MANUAL_REMINDER' && (
          <div className="space-y-3">
            {recipient ? (
              obligations.loading && !obligations.data ? <SkeletonRows rows={2} /> : obligations.error ? (
                <ErrorState message={obligations.error} onRetry={obligations.reload} />
              ) : (
                <>
                <Input label="Search obligations" type="search" maxLength={100} value={obligationSearch} disabled={saving}
                  onChange={(e) => { changed(); setTaskId(''); setObligationSearch(e.target.value); }}
                  placeholder="Filter obligations by name" />
                <Select label="Compliance obligation" required value={taskId} disabled={saving}
                  onChange={(e) => chooseTask(e.target.value)} placeholder="Select an outstanding obligation"
                  options={(obligations.data ?? []).map((o) => ({
                    value: o._id, label: `${o.title} · ${o.businessName} · ${fmtDate(o.dueDate)}`,
                  }))}
                  hint={obligations.data?.length ? 'Only obligations for the recipient’s businesses are listed.' : 'No matching outstanding obligations.'} />
                </>
              )
            ) : <p className="text-sm text-ink-500">Select a recipient to view their compliance obligations.</p>}
            {task && (
              <div className="rounded border border-line bg-paper p-3 text-sm">
                <p className="font-semibold">{task.title}</p>
                <p>Business: {task.businessName}</p>
                <p>Due: {fmtDate(task.dueDate)} · {task.periodLabel} · {task.status.replace(/_/g, ' ')}</p>
                {task.details && <p className="mt-1 text-ink-600">{task.details}</p>}
                <p className="mt-2 text-xs text-ink-500">These obligation details are included automatically in the email and cannot be omitted by editing the message.</p>
              </div>
            )}
          </div>
        )}

        <Input label="Subject" required maxLength={200} value={subject} disabled={saving}
          onChange={(e) => { changed(); setSubject(e.target.value); }} placeholder="Email subject" />
        <Select label="Message formatting" value={format} disabled={saving}
          options={[{ value: 'TEXT', label: 'Plain text' }, { value: 'RICH_TEXT', label: 'Rich text (safe Markdown → HTML)' }]}
          onChange={(e) => { changed(); setFormat(e.target.value as Format); }}
          hint="Rich text supports **bold**, *italic*, and [link](https://example.com). HTML markup itself is escaped for safety." />
        <Textarea label="Message" rows={10} required maxLength={20000} value={message} disabled={saving}
          onChange={(e) => { changed(); setMessage(e.target.value); }} placeholder="Write your message..." />
        {sendError && (
          <div role="alert" className="rounded border border-signal-200 bg-signal-50 p-3 text-sm">
            <p className="font-semibold">{sendError}</p>
            <p className="mt-1">Check email history before attempting again, particularly if your connection was interrupted.</p>
            {hasAttempted && <Button className="mt-2" variant="secondary" size="sm" onClick={changed}>
              Prepare a new sending attempt
            </Button>}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" disabled={saving} onClick={() => navigate('/admin/emails')}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={hasAttempted || !emailValid || (type === 'MANUAL_REMINDER' && (!taskId || obligations.loading)) || !subject.trim() || !message.trim()}>
            {type === 'GENERAL' ? 'Send Email' : 'Send Reminder Now'}
          </Button>
        </div>
      </form>
    </div>
  );
}
