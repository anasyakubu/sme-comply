/**
 * Module purpose: Records a filing against a compliance task. The modal validates the form, posts the filing, and informs its parent when it succeeds.
 */
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { errorMessage, post } from '../../lib/api';
import type { ComplianceTask, DocumentFile } from '../../types';
import { Button, Checkbox, Input, Modal, Select, Textarea } from '../ui';

const schema = z.object({
  filingDate: z.string().min(1, 'Enter the date you filed'),
  referenceNumber: z.string().trim().max(100).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED']),
  submittedTo: z.string().trim().max(150).optional(),
  amountPaid: z.union([z.literal(''), z.coerce.number().min(0, 'Enter a positive amount')]).optional(),
  notes: z.string().trim().max(2000).optional(),
  markTaskCompleted: z.boolean(),
  documents: z.array(z.string()).optional(),
});
type Form = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  task: ComplianceTask;
  documents: DocumentFile[];
  onSaved: () => void;
}

/**
 * Collects submission information and links it to a compliance task.
 */
export function FilingModal({ open, onClose, task, documents, onSaved }: Props) {
  const { register, handleSubmit, formState, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { filingDate: format(new Date(), 'yyyy-MM-dd'), status: 'SUBMITTED', markTaskCompleted: true, documents: [] },
  });
  const status = watch('status');

  const onSubmit = async (v: Form) => {
    try {
      await post('/filings', {
        ...v,
        taskId: task._id,
        amountPaid: v.amountPaid === '' || v.amountPaid === undefined ? undefined : Number(v.amountPaid),
        markTaskCompleted: ['SUBMITTED', 'ACCEPTED'].includes(v.status) ? v.markTaskCompleted : false,
      });
      toast.success('Filing recorded');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Record a filing"
      description={`${task.title}, ${task.periodLabel ?? task.period}. Record what you submitted to the agency; SME Comply does not submit it for you.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={formState.isSubmitting}>
            Save filing record
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input label="Date filed" type="date" required error={formState.errors.filingDate?.message} {...register('filingDate')} />
        <Select
          label="Status"
          {...register('status')}
          options={[
            { value: 'SUBMITTED', label: 'Submitted' },
            { value: 'ACCEPTED', label: 'Accepted by agency' },
            { value: 'DRAFT', label: 'Draft (not yet submitted)' },
            { value: 'REJECTED', label: 'Rejected by agency' },
          ]}
        />
        <Input label="Reference or receipt number" hint="From the agency portal or payment receipt" {...register('referenceNumber')} />
        <Input label="Submitted to" placeholder="e.g. TaxPro Max, CAC portal" {...register('submittedTo')} />
        <Input label="Amount paid (₦)" type="number" min={0} step="0.01" hint="Optional" error={formState.errors.amountPaid?.message} {...register('amountPaid')} />
        <div />
        <Textarea label="Notes" wrapperClassName="sm:col-span-2" {...register('notes')} />
        {documents.length > 0 && (
          <fieldset className="sm:col-span-2">
            <legend className="label">Attach uploaded documents</legend>
            <div className="space-y-2">
              {documents.map((d) => (
                <label key={d._id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={d._id} className="h-4 w-4 rounded border-line text-ledger-600" {...register('documents')} />
                  {d.fileName}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {['SUBMITTED', 'ACCEPTED'].includes(status) && (
          <Checkbox className="sm:col-span-2" label="Mark this obligation as completed" {...register('markTaskCompleted')} />
        )}
      </form>
    </Modal>
  );
}
