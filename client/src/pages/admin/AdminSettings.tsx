/**
 * Module purpose: Manages lookup values used by business forms and other configurable platform options.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useApi } from '../../hooks/useApi';
import { errorMessage, get, patch, post } from '../../lib/api';
import { Badge, Button, ErrorState, Input, PageHeader, SkeletonRows } from '../../components/ui';

interface Lookup {
  _id: string;
  kind: 'BUSINESS_TYPE' | 'INDUSTRY';
  value: string;
  active: boolean;
}

/**
 * Manages lookup values used by business forms and other configurable platform options.
 */
function LookupList({ kind, title, items, reload }: { kind: Lookup['kind']; title: string; items: Lookup[]; reload: () => Promise<void> }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const add = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await post('/admin/lookups', { kind, value: value.trim() });
      setValue('');
      toast.success('Added');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (l: Lookup) => {
    try {
      await patch(`/admin/lookups/${l._id}`, { active: !l.active });
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <section className="panel">
      <h2 className="border-b border-line px-4 py-3 font-bold">{title}</h2>
      <ul className="divide-y divide-line">
        {items.map((l) => (
          <li key={l._id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className={l.active ? '' : 'text-ink-400 line-through'}>{l.value}</span>
            <span className="flex items-center gap-2">
              {!l.active && <Badge>Hidden</Badge>}
              <Button size="sm" variant="ghost" onClick={() => toggle(l)}>{l.active ? 'Hide' : 'Show'}</Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t border-line p-3">
        <Input aria-label={`New ${title.toLowerCase()}`} placeholder="Add a value" value={value} onChange={(e) => setValue(e.target.value)} wrapperClassName="flex-1" />
        <Button onClick={add} loading={saving}>Add</Button>
      </div>
    </section>
  );
}

/**
 * Manages lookup values used by business forms and other configurable platform options.
 */
export default function AdminSettings() {
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, loading, error, reload } = useApi(() => get<Lookup[]>('/admin/lookups'), []);
  if (loading && !data) return <SkeletonRows />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load values'} onRetry={reload} />;
  return (
    <div>
      <PageHeader title="Dropdown values" description="Business types and industries offered when a business is added. Hidden values stay on existing businesses." />
      <div className="grid gap-6 lg:grid-cols-2">
        <LookupList kind="BUSINESS_TYPE" title="Business types" items={data.filter((l) => l.kind === 'BUSINESS_TYPE')} reload={reload} />
        <LookupList kind="INDUSTRY" title="Industries" items={data.filter((l) => l.kind === 'INDUSTRY')} reload={reload} />
      </div>
    </div>
  );
}
