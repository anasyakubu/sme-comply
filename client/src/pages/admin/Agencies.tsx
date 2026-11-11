/**
 * Module purpose: Lists and edits regulatory agencies, which are referenced by regulatory requirements and compliance tasks.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { errorMessage, get, patch, post } from '../../lib/api';
import type { Agency } from '../../types';
import { Badge, Button, Checkbox, EmptyState, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Select, SkeletonRows, Table, Td, Textarea } from '../../components/ui';

const EMPTY: Partial<Agency> = { name: '', acronym: '', description: '', level: 'FEDERAL', website: '', contactEmail: '', contactPhone: '', active: true };

/**
 * Lists and edits regulatory agencies, which are referenced by regulatory requirements and compliance tasks.
 */
export default function Agencies() {
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [page, setPage] = useState(1);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, loading, error, reload } = useApi(() => get<Agency[]>('/agencies', { search: q, page, limit: 20 }), [q, page]);
  const [editing, setEditing] = useState<Partial<Agency> | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = { ...editing };
      delete (body as Record<string, unknown>)._id;
      delete (body as Record<string, unknown>).requirementCount;
      delete (body as Record<string, unknown>).isSampleData;
      for (const k of ['createdAt', 'updatedAt', 'createdBy', 'updatedBy']) delete (body as Record<string, unknown>)[k];
      if (editing._id) await patch(`/agencies/${editing._id}`, body);
      else await post('/agencies', body);
      toast.success(editing._id ? 'Agency updated' : 'Agency added');
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a: Agency) => {
    try {
      await patch(`/agencies/${a._id}`, { active: !a.active });
      toast.success(a.active ? 'Agency deactivated' : 'Agency reactivated');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Regulatory agencies"
        description="Authorities that requirements belong to."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ ...EMPTY })}>Add agency</Button>}
      />
      <div className="mb-4 max-w-md">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search agencies" />
      </div>
      <div className="panel">
        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data?.length ? (
          <>
            <Table head={['Agency', 'Level', 'Requirements', 'Status', '']}>
              {data.map((a) => (
                <tr key={a._id} className="block py-2 md:table-row md:py-0">
                  <Td>
                    <span className="font-semibold">{a.acronym}</span> <span className="text-ink-700">{a.name}</span>
                    {a.isSampleData && <span className="ml-2"><Badge tone="amber">Sample</Badge></span>}
                  </Td>
                  <Td label="Level">{a.level.toLowerCase()}</Td>
                  <Td label="Requirements" className="tabular">{a.requirementCount ?? 0}</Td>
                  <Td>{a.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(a)}>{a.active ? 'Deactivate' : 'Reactivate'}</Button>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState title="No agencies" action={<Button onClick={() => setEditing({ ...EMPTY })}>Add agency</Button>} />
        )}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? `Edit ${editing.acronym}` : 'Add agency'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing?._id ? 'Save agency' : 'Add agency'}</Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Acronym" required value={editing.acronym} onChange={(e) => setEditing({ ...editing, acronym: e.target.value })} />
            <Select
              label="Level"
              value={editing.level}
              onChange={(e) => setEditing({ ...editing, level: e.target.value as Agency['level'] })}
              options={[{ value: 'FEDERAL', label: 'Federal' }, { value: 'STATE', label: 'State' }, { value: 'LOCAL', label: 'Local' }]}
            />
            <Input label="Full name" required wrapperClassName="sm:col-span-2" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Textarea label="Description" wrapperClassName="sm:col-span-2" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <Input label="Website" type="url" placeholder="https://" wrapperClassName="sm:col-span-2" value={editing.website ?? ''} onChange={(e) => setEditing({ ...editing, website: e.target.value })} />
            <Input label="Contact email" type="email" value={editing.contactEmail ?? ''} onChange={(e) => setEditing({ ...editing, contactEmail: e.target.value })} />
            <Input label="Contact phone" value={editing.contactPhone ?? ''} onChange={(e) => setEditing({ ...editing, contactPhone: e.target.value })} />
            <Checkbox label="Active" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
          </div>
        )}
      </Modal>
    </div>
  );
}
