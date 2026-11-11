/**
 * Module purpose: Uploads a supporting document and optionally associates it with a business compliance task. The server performs file validation and storage.
 */
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { UploadCloud } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { DOC_TYPE_LABEL, fileSize } from '../../lib/format';
import { Button, Modal, Select, Textarea } from '../ui';
import type { ComplianceTask, DocumentFile } from '../../types';

const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
const MAX_MB = 10;

interface Props {
  open: boolean;
  onClose: () => void;
  businessId: string;
  taskId?: string;
  tasks?: ComplianceTask[];
  onUploaded: (doc: DocumentFile) => void;
}

/**
 * Collects a file and related task/business information and posts multipart data.
 */
export function UploadModal({ open, onClose, businessId, taskId, tasks, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('OTHER');
  const [description, setDescription] = useState('');
  const [selectedTask, setSelectedTask] = useState(taskId ?? '');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setDescription('');
    setType('OTHER');
    setProgress(null);
    setError(null);
  };

  const choose = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPT.split(',').includes(`.${ext}`)) return setError('Choose a PDF, DOC, DOCX, JPG or PNG file.');
    if (f.size > MAX_MB * 1_048_576) return setError(`This file is ${fileSize(f.size)}. The limit is ${MAX_MB} MB.`);
    setFile(f);
  };

  const submit = async () => {
    if (!file) return setError('Choose a file to upload.');
    const form = new FormData();
    form.append('file', file);
    form.append('businessId', businessId);
    if (selectedTask) form.append('taskId', selectedTask);
    form.append('documentType', type);
    if (description) form.append('description', description);
    try {
      setProgress(0);
      const res = await api.post('/documents', form, {
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      toast.success('Document uploaded');
      onUploaded(res.data.data);
      reset();
      onClose();
    } catch (err) {
      setProgress(null);
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Upload a document"
      description="Receipts, certificates and acknowledgements. PDF, DOC, DOCX, JPG or PNG up to 10 MB."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={progress !== null} disabled={!file}>
            Upload document
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0]);
          }}
          className="rounded-lg border-2 border-dashed border-line p-6 text-center"
        >
          <UploadCloud className="mx-auto h-7 w-7 text-ink-400" aria-hidden />
          {file ? (
            <p className="mt-2 text-sm font-semibold">
              {file.name} <span className="font-normal text-ink-500">({fileSize(file.size)})</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-500">Drag a file here, or</p>
          )}
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>
            {file ? 'Choose a different file' : 'Choose file'}
          </Button>
          <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} aria-label="File" />
        </div>
        {progress !== null && (
          <div className="h-1.5 overflow-hidden rounded bg-paper" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-ledger-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="text-sm font-medium text-signal-600" role="alert">{error}</p>}
        <Select
          label="Document type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={Object.entries(DOC_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {!taskId && tasks && (
          <Select
            label="Related obligation"
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            placeholder="None"
            options={tasks.map((t) => ({ value: t._id, label: `${t.title} (${t.periodLabel ?? t.period})` }))}
          />
        )}
        <Textarea label="Description" hint="Optional" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </div>
    </Modal>
  );
}
