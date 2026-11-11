/**
 * Module purpose: Displays one compliance task with assignment, notes, filings, and documents; actions depend on business permissions and task status.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, PlayCircle, RotateCcw, Trash2, Upload, XCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { del, errorMessage, get, patch, post } from '../../lib/api';
import { fileSize, fmtDate, fmtDateTime, fmtDue, FREQUENCY_LABEL, fullName, naira, refId, DOC_TYPE_LABEL } from '../../lib/format';
import type { ComplianceTask, DocumentFile, Filing, Permission, Requirement, TaskStatus } from '../../types';
import { Badge, Button, ConfirmDialog, DueCountdown, EmptyState, ErrorState, PageHeader, PriorityBadge, SkeletonRows, StatusBadge, Textarea } from '../../components/ui';
import { FilingModal } from '../../components/tasks/FilingModal';
import { UploadModal } from '../../components/tasks/UploadModal';

interface Detail {
  task: ComplianceTask & { requirementId: Requirement };
  filings: Filing[];
  documents: DocumentFile[];
  permissions: Permission[];
}

/**
 * Displays one compliance task with assignment, notes, filings, and documents; actions depend on business permissions and task status.
 */
export default function TaskDetails() {
  const { id } = useParams();
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, loading, error, reload } = useApi(() => get<Detail>(`/compliance-tasks/${id}`), [id]);
  const [filingOpen, setFilingOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmNA, setConfirmNA] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<DocumentFile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (loading && !data) return <SkeletonRows rows={8} />;
  if (error || !data) return <div className="panel"><ErrorState message={error ?? 'Obligation not found'} onRetry={reload} /></div>;

  const { task, filings, documents, permissions } = data;
  const req = task.requirementId;
  const can = (p: Permission) => permissions.includes(p);
  // Finished and not-applicable tasks do not expose editing/filing actions.
  const open = !['COMPLETED', 'NOT_APPLICABLE'].includes(task.status);

  const setStatus = async (status: TaskStatus, label: string) => {
    setBusy(status);
    try {
      if (status === 'COMPLETED') await post(`/compliance-tasks/${task._id}/complete`, {});
      else await patch(`/compliance-tasks/${task._id}/status`, { status });
      toast.success(label);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
      setConfirmNA(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy('note');
    try {
      await post(`/compliance-tasks/${task._id}/notes`, { body: note });
      setNote('');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const removeDoc = async () => {
    if (!deleteDoc) return;
    setBusy('delete');
    try {
      await del(`/documents/${deleteDoc._id}`);
      toast.success('Document deleted');
      setDeleteDoc(null);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        back={
          <Link to="/app/tasks" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" /> Obligations
          </Link>
        }
        title={task.title}
        description={
          <>
            {typeof task.agencyId === 'object' ? task.agencyId?.name : ''} for {typeof task.businessId === 'object' ? task.businessId.businessName : ''}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <DueCountdown dueDate={task.dueDate} status={task.status} size="lg" />
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                {req?.isSampleData && <Badge tone="amber">Sample regulatory data</Badge>}
              </div>
              <p className="text-sm text-ink-700">
                Due <strong className="tabular">{fmtDue(task.dueDate)}</strong> for {task.periodLabel ?? task.period}
              </p>
              {task.completedAt && (
                <p className="text-sm text-ink-500">
                  Completed {fmtDate(task.completedAt)} by {fullName(task.completedBy)}
                </p>
              )}
            </div>
            {can('tasks:update') && (
              <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                {open && can('filings:record') && (
                  <Button onClick={() => setFilingOpen(true)} icon={<FileText className="h-4 w-4" />}>
                    Record filing
                  </Button>
                )}
                {open && (
                  <Button variant="secondary" loading={busy === 'COMPLETED'} onClick={() => setStatus('COMPLETED', 'Marked as completed')} icon={<CheckCircle2 className="h-4 w-4" />}>
                    Mark completed
                  </Button>
                )}
                {open && task.status !== 'IN_PROGRESS' && (
                  <Button variant="ghost" loading={busy === 'IN_PROGRESS'} onClick={() => setStatus('IN_PROGRESS', 'Marked as in progress')} icon={<PlayCircle className="h-4 w-4" />}>
                    Start work
                  </Button>
                )}
                {!open && (
                  <Button variant="secondary" loading={busy === 'UPCOMING'} onClick={() => setStatus('UPCOMING', 'Obligation reopened')} icon={<RotateCcw className="h-4 w-4" />}>
                    Reopen
                  </Button>
                )}
              </div>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="font-bold">What this is</h2>
            <p className="mt-2 text-ink-700">{req?.description ?? 'No description available.'}</p>
            {req?.requiredDocuments && req.requiredDocuments.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-semibold">Usually needed</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
                  {req.requiredDocuments.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </>
            )}
            {req?.penaltyInformation && (
              <div className="mt-5 rounded border border-due-100 bg-due-50 p-3 text-sm">
                <p className="font-semibold">If it's late</p>
                <p className="mt-0.5 text-ink-700">{req.penaltyInformation}</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              {req?.officialWebsite && (
                <a href={req.officialWebsite} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                  Official website <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {req?.guidanceUrl && req.guidanceUrl !== req.officialWebsite && (
                <a href={req.guidanceUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                  Guidance <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            {req?.isSampleData && (
              <p className="mt-4 text-xs text-ink-500">Sample regulatory data. Verify the deadline and requirements with the relevant authority.</p>
            )}
          </section>

          <section className="panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-bold">Filing records</h2>
              {can('filings:record') && (
                <Button size="sm" variant="secondary" onClick={() => setFilingOpen(true)}>
                  Record filing
                </Button>
              )}
            </div>
            {filings.length ? (
              <ul className="divide-y divide-line">
                {filings.map((f) => (
                  <li key={f._id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        Filed {fmtDate(f.filingDate)}
                        {f.referenceNumber ? `, ref ${f.referenceNumber}` : ''}
                      </p>
                      <Badge tone={f.status === 'ACCEPTED' ? 'green' : f.status === 'REJECTED' ? 'red' : 'neutral'}>{f.status.toLowerCase()}</Badge>
                    </div>
                    <p className="text-ink-500">
                      Recorded by {fullName(f.filedBy)}
                      {f.submittedTo ? `, submitted to ${f.submittedTo}` : ''}
                      {f.amountPaid ? `, ${naira(f.amountPaid)} paid` : ''}
                    </p>
                    {f.notes && <p className="mt-1 text-ink-700">{f.notes}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No filing recorded" message="Once you've submitted this to the agency, record it here with the reference number." />
            )}
          </section>

          <section className="panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-bold">Documents</h2>
              {can('documents:upload') && (
                <Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
                  Upload
                </Button>
              )}
            </div>
            {documents.length ? (
              <ul className="divide-y divide-line">
                {documents.map((d) => (
                  <li key={d._id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <FileText className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <a href={d.cloudinaryUrl} target="_blank" rel="noopener noreferrer" className="link truncate font-semibold">
                        {d.fileName}
                      </a>
                      <p className="text-ink-500">
                        {DOC_TYPE_LABEL[d.documentType] ?? d.documentType}, {fileSize(d.fileSize)}, {fmtDate(d.uploadedAt)}
                      </p>
                    </div>
                    {can('documents:upload') && (
                      <button onClick={() => setDeleteDoc(d)} className="rounded p-1.5 text-ink-400 hover:bg-signal-50 hover:text-signal-600" aria-label={`Delete ${d.fileName}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No documents yet" message="Upload the receipt or acknowledgement as proof of filing." />
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="panel p-4 text-sm">
            <h2 className="font-bold">Details</h2>
            <dl className="mt-3 space-y-2">
              <Row label="Agency" value={typeof task.agencyId === 'object' ? task.agencyId?.acronym : ''} />
              <Row label="Category" value={task.category} />
              <Row label="Frequency" value={FREQUENCY_LABEL[req?.frequency] ?? req?.frequency} />
              <Row label="Period" value={task.periodLabel ?? task.period} />
              <Row label="Requirement code" value={req?.code} />
              <Row label="Created by" value={task.generatedAutomatically ? 'Rules engine' : 'Manually adjusted'} />
            </dl>
            {open && can('tasks:mark_not_applicable') && (
              <Button variant="ghost" size="sm" className="mt-4 text-signal-700" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirmNA(true)}>
                Mark not applicable
              </Button>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="font-bold">Notes</h2>
            {task.notes.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {task.notes.map((n) => (
                  <li key={n._id} className="text-sm">
                    <p className="whitespace-pre-wrap text-ink-900">{n.body}</p>
                    <p className="text-xs text-ink-500">
                      {fullName(n.author)}, {fmtDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-500">No notes yet.</p>
            )}
            {can('tasks:update') && (
              <div className="mt-4">
                <Textarea aria-label="Add a note" placeholder="Add a note for your team" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                <Button size="sm" className="mt-2" onClick={addNote} loading={busy === 'note'} disabled={!note.trim()}>
                  Add note
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>

      <FilingModal open={filingOpen} onClose={() => setFilingOpen(false)} task={task} documents={documents} onSaved={reload} />
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} businessId={refId(task.businessId)} taskId={task._id} onUploaded={() => void reload()} />
      <ConfirmDialog
        open={confirmNA}
        title="Mark as not applicable?"
        message="Use this when the obligation genuinely doesn't apply to this period. It won't count towards your compliance rate, and reminders stop."
        confirmLabel="Mark not applicable"
        danger
        loading={busy === 'NOT_APPLICABLE'}
        onConfirm={() => setStatus('NOT_APPLICABLE', 'Marked as not applicable')}
        onClose={() => setConfirmNA(false)}
      />
      <ConfirmDialog
        open={Boolean(deleteDoc)}
        title="Delete this document?"
        message={`${deleteDoc?.fileName ?? ''} will be removed permanently.`}
        confirmLabel="Delete document"
        danger
        loading={busy === 'delete'}
        onConfirm={removeDoc}
        onClose={() => setDeleteDoc(null)}
      />
    </div>
  );
}

/**
 * Displays one labeled property of the selected compliance task.
 */
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium">{value || '—'}</dd>
    </div>
  );
}
