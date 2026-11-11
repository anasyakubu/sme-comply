/**
 * Module purpose: Manages regulatory requirements, their applicability rules, and due-date logic used by the task planner.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useLookups } from '../../hooks/useLookups';
import { errorMessage, get, patch, post } from '../../lib/api';
import { FREQUENCY_LABEL, refId } from '../../lib/format';
import type { Agency, Requirement, RuleGroup } from '../../types';
import { Badge, Button, Checkbox, EmptyState, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Select, SkeletonRows, Table, Td, Textarea } from '../../components/ui';
import { RuleBuilder } from '../../components/admin/RuleBuilder';
import { DueRuleEditor } from '../../components/admin/DueRuleEditor';

type Draft = Omit<Requirement, '_id' | 'agencyId'> & { _id?: string; agencyId: string; requiredDocumentsText: string };

const blank = (): Draft => ({
  agencyId: '',
  name: '',
  code: '',
  description: '',
  category: 'Tax',
  frequency: 'MONTHLY',
  dueRule: { type: 'DAY_OF_MONTH', day: 21, monthOffset: 1 },
  applicabilityRules: { match: 'ALL', conditions: [] },
  requiredDocuments: [],
  requiredDocumentsText: '',
  penaltyInformation: '',
  officialWebsite: '',
  guidanceUrl: '',
  active: true,
});

/**
 * Manages regulatory requirements, their applicability rules, and due-date logic used by the task planner.
 */
export default function Requirements() {
  const options = useLookups();
  const [search, setSearch] = useState('');
  // Wait briefly after typing so the requirements endpoint is not called per character.
  const q = useDebounce(search);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, meta, loading, error, reload } = useApi(() => get<Requirement[]>('/requirements', { search: q, category, page, limit: 20 }), [q, category, page]);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const agencies = useApi(() => get<Agency[]>('/agencies', { limit: 100 }), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ totalBusinesses: number; matching: number; sample: Array<{ _id: string; businessName: string; state: string }> } | null>(null);

  const edit = (r: Requirement) => {
    setPreview(null);
    setDraft({ ...r, agencyId: refId(r.agencyId as never), requiredDocumentsText: (r.requiredDocuments ?? []).join('\n') });
  };

  // Preview shows which businesses match draft applicability rules without saving them.
  const runPreview = async () => {
    if (!draft) return;
    try {
      const res = await post<NonNullable<typeof preview>>('/requirements/preview', { applicabilityRules: draft.applicabilityRules ?? {} });
      setPreview(res.data);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Remove UI-only and read-only fields before submitting the requirement to backend validation.
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { _id, requiredDocumentsText, ...rest } = draft;
    const body: Record<string, unknown> = {
      ...rest,
      requiredDocuments: requiredDocumentsText.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    for (const k of ['createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'isSampleData']) delete body[k];
    for (const k of ['officialWebsite', 'guidanceUrl', 'description', 'penaltyInformation']) if (body[k] === '') delete body[k];
    if (body.frequency !== 'CUSTOM') delete body.customIntervalMonths;
    try {
      if (_id) await patch(`/requirements/${_id}`, body);
      else await post('/requirements', body);
      toast.success(_id ? 'Requirement saved. Obligations are being updated.' : 'Requirement added. Obligations are being generated.');
      setDraft(null);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: Requirement) => {
    try {
      await patch(`/requirements/${r._id}`, { active: !r.active });
      toast.success(r.active ? 'Requirement deactivated' : 'Requirement reactivated');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Regulatory requirements"
        description="Each requirement has a frequency, a due-date rule and applicability rules. Changes regenerate obligations for every business."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setPreview(null); setDraft(blank()); }}>Add requirement</Button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or code" />
        <Select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder="All categories" options={options?.categories ?? []} />
      </div>
      <div className="panel">
        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data?.length ? (
          <>
            <Table head={['Requirement', 'Agency', 'Frequency', 'Status', '']}>
              {data.map((r) => (
                <tr key={r._id} className="block py-2 md:table-row md:py-0">
                  <Td>
                    <span className="font-semibold">{r.name}</span>
                    <span className="block text-xs text-ink-500">
                      {r.code}, {r.category}
                    </span>
                  </Td>
                  <Td label="Agency">{typeof r.agencyId === 'object' ? r.agencyId.acronym : ''}</Td>
                  <Td label="Frequency">{FREQUENCY_LABEL[r.frequency]}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {r.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                      {r.isSampleData && <Badge tone="amber">Sample</Badge>}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => edit(r)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(r)}>{r.active ? 'Deactivate' : 'Reactivate'}</Button>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState title="No requirements match" />
        )}
      </div>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        size="xl"
        title={draft?._id ? `Edit ${draft.code}` : 'Add requirement'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{draft?._id ? 'Save requirement' : 'Add requirement'}</Button>
          </>
        }
      >
        {draft && options && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <Input label="Code" required hint="Unique, e.g. NRS-VAT-MONTHLY" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
              <Select label="Agency" required placeholder="Choose…" value={draft.agencyId} onChange={(e) => setDraft({ ...draft, agencyId: e.target.value })} options={(agencies.data ?? []).map((a) => ({ value: a._id, label: `${a.acronym}, ${a.name}` }))} />
              <Select label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} options={options.categories} />
              <Select label="Frequency" value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Draft['frequency'] })} options={options.frequencies.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))} />
              {draft.frequency === 'CUSTOM' && (
                <Input label="Every how many months" type="number" min={1} max={12} value={draft.customIntervalMonths ?? ''} onChange={(e) => setDraft({ ...draft, customIntervalMonths: Number(e.target.value) })} />
              )}
              <Textarea label="Description" wrapperClassName="sm:col-span-2" value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>

            <DueRuleEditor value={draft.dueRule} onChange={(dueRule) => setDraft({ ...draft, dueRule })} />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="label mb-0">Who it applies to</span>
                <Button size="sm" variant="secondary" onClick={runPreview}>Preview matches</Button>
              </div>
              <RuleBuilder value={(draft.applicabilityRules ?? { match: 'ALL', conditions: [] }) as RuleGroup} onChange={(g) => { setPreview(null); setDraft({ ...draft, applicabilityRules: g }); }} options={options} />
              {preview && (
                <p className="mt-2 text-sm text-ink-700" role="status">
                  Applies to <strong className="tabular">{preview.matching}</strong> of {preview.totalBusinesses} businesses
                  {preview.sample.length > 0 && `, including ${preview.sample.slice(0, 3).map((s) => s.businessName).join(', ')}`}.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Textarea label="Documents usually needed" hint="One per line" value={draft.requiredDocumentsText} onChange={(e) => setDraft({ ...draft, requiredDocumentsText: e.target.value })} />
              <Textarea label="Penalty information" value={draft.penaltyInformation ?? ''} onChange={(e) => setDraft({ ...draft, penaltyInformation: e.target.value })} />
              <Input label="Official website" type="url" value={draft.officialWebsite ?? ''} onChange={(e) => setDraft({ ...draft, officialWebsite: e.target.value })} />
              <Input label="Guidance link" type="url" value={draft.guidanceUrl ?? ''} onChange={(e) => setDraft({ ...draft, guidanceUrl: e.target.value })} />
              <Checkbox label="Active" description="Inactive requirements don't generate obligations" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
