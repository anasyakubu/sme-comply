/**
 * Module purpose: Lists, uploads, and deletes business documents with permission checks and confirmation before destructive actions.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileText, FolderOpen, Trash2, Upload } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { del, errorMessage, get } from '../../lib/api';
import { DOC_TYPE_LABEL, fileSize, fmtDate, fullName } from '../../lib/format';
import type { ComplianceTask, DocumentFile } from '../../types';
import { Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, SkeletonRows, Table, Td } from '../../components/ui';
import { UploadModal } from '../../components/tasks/UploadModal';
import { NoBusiness } from '../../components/business/NoBusiness';

/**
 * Lists, uploads, and deletes business documents with permission checks and confirmation before destructive actions.
 */
export default function Documents() {
  const { current, can, loading: loadingBusinesses } = useBusiness();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toDelete, setToDelete] = useState<DocumentFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, loading, error, reload } = useApi(
    () => get<DocumentFile[]>('/documents', { businessId: current!._id, search: q, documentType: type, page, limit: 20 }),
    [current?._id, q, type, page],
    Boolean(current),
  );
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const tasks = useApi(
    () => get<ComplianceTask[]>('/compliance-tasks', { businessId: current!._id, limit: 100, sort: '-dueDate', status: 'PENDING,IN_PROGRESS,OVERDUE,COMPLETED' }),
    [current?._id],
    Boolean(current) && uploadOpen,
  );

  if (!loadingBusinesses && !current) return <NoBusiness />;

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await del(`/documents/${toDelete._id}`);
      toast.success('Document deleted');
      setToDelete(null);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Receipts, certificates and acknowledgements, kept with the obligation they prove."
        actions={
          can('documents:upload') && (
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
              Upload document
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by file name" />
        <Select
          aria-label="Document type"
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          placeholder="All types"
          options={Object.entries(DOC_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="panel">
        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.length ? (
          <>
            <Table head={['File', 'Type', 'Obligation', 'Uploaded', '']}>
              {data.map((d) => (
                <tr key={d._id} className="block py-2 md:table-row md:py-0">
                  <Td>
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                      <a href={d.cloudinaryUrl} target="_blank" rel="noopener noreferrer" className="link font-semibold">
                        {d.fileName}
                      </a>
                    </span>
                    <span className="block pl-6 text-xs text-ink-500">{fileSize(d.fileSize)}</span>
                  </Td>
                  <Td label="Type">{DOC_TYPE_LABEL[d.documentType] ?? d.documentType}</Td>
                  <Td label="For">
                    {d.taskId ? (
                      <Link to={`/app/tasks/${d.taskId._id}`} className="hover:underline">
                        {d.taskId.title} <span className="text-ink-500">({d.taskId.periodLabel})</span>
                      </Link>
                    ) : (
                      <span className="text-ink-400">General</span>
                    )}
                  </Td>
                  <Td label="Uploaded">
                    <span className="tabular">{fmtDate(d.uploadedAt)}</span>
                    <span className="block text-xs text-ink-500">{fullName(d.uploadedBy)}</span>
                  </Td>
                  <Td className="text-right">
                    {can('documents:upload') && (
                      <button onClick={() => setToDelete(d)} className="rounded p-1.5 text-ink-400 hover:bg-signal-50 hover:text-signal-600" aria-label={`Delete ${d.fileName}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon={<FolderOpen className="h-8 w-8" />}
            title="No documents yet"
            message="Upload receipts and certificates so they're ready when an agency or auditor asks."
            action={can('documents:upload') && <Button onClick={() => setUploadOpen(true)}>Upload document</Button>}
          />
        )}
      </div>
      {current && (
        <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} businessId={current._id} tasks={tasks.data ?? []} onUploaded={() => void reload()} />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this document?"
        message={`${toDelete?.fileName ?? ''} will be removed permanently.`}
        confirmLabel="Delete document"
        danger
        loading={deleting}
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
