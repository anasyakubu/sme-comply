/**
 * Module purpose: Lets administrators edit the date-calculation rule stored with a regulatory requirement. The available inputs depend on the chosen due-rule type.
 */
const TYPES: Array<{ value: string; label: string; help: string }> = [
  { value: 'DAY_OF_MONTH', label: 'A day in the following month', help: 'e.g. the 21st of the month after the period ends' },
  { value: 'LAST_DAY_OF_MONTH', label: 'Last day of a following month', help: 'e.g. end of the month after the period' },
  { value: 'FIXED_DATE', label: 'Fixed calendar date', help: 'e.g. 30 June each year, or 31 March of the next year' },
  { value: 'DAYS_AFTER_PERIOD_END', label: 'Days after the period ends', help: 'e.g. 30 days after the quarter' },
  { value: 'MONTHS_AFTER_PERIOD_END', label: 'Months after the period ends', help: 'e.g. 6 months after the financial year' },
  { value: 'ANNIVERSARY', label: 'Anniversary of incorporation', help: 'Yearly, relative to the incorporation date' },
  { value: 'DAYS_AFTER_ANCHOR', label: 'Days after incorporation (one-time)', help: 'For one-time obligations' },
];

type Rule = Record<string, unknown> & { type: string };

function Num({ label, value, onChange, min = 0, max }: { label: string; value: unknown; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className="block text-sm">
      <span className="label">{label}</span>
      <input type="number" className="input" min={min} max={max} value={value === undefined ? '' : String(value)} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/**
 * Shows type-specific controls for the rule that calculates a requirement’s deadline.
 */
export function DueRuleEditor({ value, onChange }: { value: Rule; onChange: (v: Rule) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const help = TYPES.find((t) => t.value === value.type)?.help;
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Due date rule</span>
        <select
          className="input"
          value={value.type}
          onChange={(e) => {
            const type = e.target.value;
            const defaults: Record<string, Rule> = {
              DAY_OF_MONTH: { type, day: 21, monthOffset: 1 },
              LAST_DAY_OF_MONTH: { type, monthOffset: 1 },
              FIXED_DATE: { type, month: 6, day: 30, yearOffset: 0 },
              DAYS_AFTER_PERIOD_END: { type, days: 30 },
              MONTHS_AFTER_PERIOD_END: { type, months: 6 },
              ANNIVERSARY: { type, anchor: 'dateOfIncorporation', daysAfter: 0 },
              DAYS_AFTER_ANCHOR: { type, anchor: 'dateOfIncorporation', days: 30 },
            };
            onChange(defaults[type] ?? { type });
          }}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {help && <span className="mt-1 block text-xs text-ink-500">{help}</span>}
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {value.type === 'DAY_OF_MONTH' && (
          <>
            <Num label="Day" value={value.day} min={1} max={31} onChange={(n) => set('day', n)} />
            <Num label="Months after period" value={value.monthOffset ?? 1} onChange={(n) => set('monthOffset', n)} />
          </>
        )}
        {value.type === 'LAST_DAY_OF_MONTH' && <Num label="Months after period" value={value.monthOffset ?? 1} onChange={(n) => set('monthOffset', n)} />}
        {value.type === 'FIXED_DATE' && (
          <>
            <Num label="Month (1–12)" value={value.month} min={1} max={12} onChange={(n) => set('month', n)} />
            <Num label="Day" value={value.day} min={1} max={31} onChange={(n) => set('day', n)} />
            <Num label="Year offset" value={value.yearOffset ?? 0} onChange={(n) => set('yearOffset', n)} />
          </>
        )}
        {(value.type === 'DAYS_AFTER_PERIOD_END' || value.type === 'DAYS_AFTER_ANCHOR') && <Num label="Days" value={value.days} onChange={(n) => set('days', n)} />}
        {value.type === 'MONTHS_AFTER_PERIOD_END' && (
          <>
            <Num label="Months" value={value.months} onChange={(n) => set('months', n)} />
            <Num label="Day (blank = month end)" value={value.day} min={1} max={31} onChange={(n) => set('day', n || undefined)} />
          </>
        )}
        {value.type === 'ANNIVERSARY' && <Num label="Days after anniversary" value={value.daysAfter ?? 0} onChange={(n) => set('daysAfter', n)} />}
      </div>
    </div>
  );
}
