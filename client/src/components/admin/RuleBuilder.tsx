/**
 * Module purpose: Builds nested applicability conditions for regulatory requirements. ALL/ANY groups are edited as immutable objects so React can detect changes.
 */
import { Plus, Trash2 } from 'lucide-react';
import type { LookupOptions, RuleCondition, RuleGroup } from '../../types';

const OPERATOR_LABEL: Record<string, string> = {
  EQ: 'is',
  NEQ: 'is not',
  IN: 'is one of',
  NOT_IN: 'is none of',
  GT: 'is more than',
  GTE: 'is at least',
  LT: 'is less than',
  LTE: 'is at most',
  EXISTS: 'is filled in',
  IS_TRUE: 'is yes',
  IS_FALSE: 'is no',
  CONTAINS: 'contains',
};

const OPERATORS_BY_KIND: Record<string, string[]> = {
  string: ['EQ', 'NEQ', 'IN', 'NOT_IN', 'CONTAINS', 'EXISTS'],
  number: ['GTE', 'GT', 'LTE', 'LT', 'EQ', 'NEQ'],
  boolean: ['IS_TRUE', 'IS_FALSE'],
};

const isGroup = (c: RuleCondition | RuleGroup): c is RuleGroup => Array.isArray((c as RuleGroup).conditions);

interface Props {
  value: RuleGroup;
  onChange: (v: RuleGroup) => void;
  options: LookupOptions;
  depth?: number;
  onRemove?: () => void;
}

/** Visual editor for nested ALL/ANY applicability rules. */
export function RuleBuilder({ value, onChange, options, depth = 0, onRemove }: Props) {
  const conditions = value.conditions ?? [];
  const fieldKind = (f: string) => options.ruleFields.find((x) => x.field === f)?.kind ?? 'string';

  const update = (i: number, c: RuleCondition | RuleGroup) => onChange({ ...value, conditions: conditions.map((x, j) => (j === i ? c : x)) });
  const remove = (i: number) => onChange({ ...value, conditions: conditions.filter((_, j) => j !== i) });
  const add = (c: RuleCondition | RuleGroup) => onChange({ ...value, match: value.match ?? 'ALL', conditions: [...conditions, c] });

  const valueInput = (c: RuleCondition, i: number) => {
    if (['EXISTS', 'IS_TRUE', 'IS_FALSE'].includes(c.operator)) return null;
    const kind = fieldKind(c.field);
    if (['IN', 'NOT_IN'].includes(c.operator)) {
      const list = Array.isArray(c.value) ? (c.value as string[]) : [];
      if (c.field === 'businessType' || c.field === 'state') {
        const source = c.field === 'state' ? options.states : options.businessTypes;
        return (
          <select
            multiple
            aria-label="Values"
            className="input h-28 sm:col-span-2"
            value={list}
            onChange={(e) => update(i, { ...c, value: Array.from(e.target.selectedOptions).map((o) => o.value) })}
          >
            {source.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          aria-label="Values, separated by commas"
          className="input sm:col-span-2"
          placeholder="Comma-separated values"
          value={list.join(', ')}
          onChange={(e) => update(i, { ...c, value: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        />
      );
    }
    return (
      <input
        aria-label="Value"
        className="input sm:col-span-2"
        type={kind === 'number' ? 'number' : 'text'}
        value={String(c.value ?? '')}
        onChange={(e) => update(i, { ...c, value: kind === 'number' ? Number(e.target.value) : e.target.value })}
      />
    );
  };

  return (
    <div className={`rounded border ${depth === 0 ? 'border-line bg-paper' : 'border-dashed border-ink-300 bg-white'} p-3`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          Applies when
          <select
            className="input w-auto py-1"
            value={value.match ?? 'ALL'}
            onChange={(e) => onChange({ ...value, match: e.target.value as 'ALL' | 'ANY' })}
            aria-label="Match"
          >
            <option value="ALL">all</option>
            <option value="ANY">any</option>
          </select>
          of these are true
        </label>
        {onRemove && (
          <button type="button" onClick={onRemove} className="rounded p-1 text-ink-400 hover:text-signal-600" aria-label="Remove group">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {conditions.length === 0 && depth === 0 && <p className="mb-3 text-sm text-ink-500">No conditions: this applies to every business.</p>}

      <div className="space-y-2">
        {conditions.map((c, i) =>
          isGroup(c) ? (
            <RuleBuilder key={i} value={c} onChange={(g) => update(i, g)} options={options} depth={depth + 1} onRemove={() => remove(i)} />
          ) : (
            <div key={i} className="grid items-start gap-2 sm:grid-cols-[1.2fr_1fr_2fr_auto]">
              <select
                aria-label="Field"
                className="input"
                value={c.field}
                onChange={(e) => {
                  const kind = fieldKind(e.target.value);
                  update(i, { field: e.target.value, operator: OPERATORS_BY_KIND[kind][0], value: undefined });
                }}
              >
                {options.ruleFields.map((f) => (
                  <option key={f.field} value={f.field}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select aria-label="Operator" className="input" value={c.operator} onChange={(e) => update(i, { ...c, operator: e.target.value })}>
                {OPERATORS_BY_KIND[fieldKind(c.field)].map((o) => (
                  <option key={o} value={o}>
                    {OPERATOR_LABEL[o]}
                  </option>
                ))}
              </select>
              {valueInput(c, i) ?? <span className="hidden sm:col-span-2 sm:block" />}
              <button type="button" onClick={() => remove(i)} className="self-center rounded p-1.5 text-ink-400 hover:text-signal-600" aria-label="Remove condition">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ),
        )}
      </div>

      <div className="mt-3 flex gap-3 text-sm">
        <button type="button" className="link inline-flex items-center gap-1" onClick={() => add({ field: 'employeeCount', operator: 'GTE', value: 1 })}>
          <Plus className="h-3.5 w-3.5" /> Add condition
        </button>
        {depth < 2 && (
          <button type="button" className="link inline-flex items-center gap-1" onClick={() => add({ match: 'ANY', conditions: [] })}>
            <Plus className="h-3.5 w-3.5" /> Add group
          </button>
        )}
      </div>
    </div>
  );
}
