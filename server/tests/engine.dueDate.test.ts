/**
 * Module purpose: Tests due-date rule calculations and edge cases such as month boundaries.
 */
import { calculateDueDate, periodsForYears, validateDueRule } from '../src/engine';
import { utcDate } from '../src/utils/dates';

const iso = (d: Date | null) => d?.toISOString().slice(0, 10);
const business = { dateOfIncorporation: utcDate(2021, 2, 15), createdAt: utcDate(2024, 0, 10) };

describe('periodsForYears', () => {
  it('creates 12 monthly periods with stable keys', () => {
    const p = periodsForYears('MONTHLY', 2026, 2026);
    expect(p).toHaveLength(12);
    expect(p[0].key).toBe('2026-01');
    expect(iso(p[1].end)).toBe('2026-02-28');
  });

  it('handles leap-year February', () => {
    expect(iso(periodsForYears('MONTHLY', 2028, 2028)[1].end)).toBe('2028-02-29');
  });

  it('creates quarters, halves and years', () => {
    expect(periodsForYears('QUARTERLY', 2026, 2026).map((p) => p.key)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
    expect(iso(periodsForYears('QUARTERLY', 2026, 2026)[0].end)).toBe('2026-03-31');
    expect(periodsForYears('BI_ANNUAL', 2026, 2026).map((p) => p.key)).toEqual(['2026-H1', '2026-H2']);
    expect(periodsForYears('ANNUAL', 2025, 2026).map((p) => p.key)).toEqual(['2025', '2026']);
  });

  it('creates a single ONCE period for one-time requirements', () => {
    const p = periodsForYears('ONE_TIME', 2020, 2030, { anchor: utcDate(2024, 4, 2) });
    expect(p).toHaveLength(1);
    expect(p[0].key).toBe('ONCE');
  });

  it('splits custom intervals', () => {
    expect(periodsForYears('CUSTOM', 2026, 2026, { customIntervalMonths: 4 }).map((p) => p.key)).toEqual(['2026-C1', '2026-C2', '2026-C3']);
  });
});

describe('calculateDueDate', () => {
  const jan = periodsForYears('MONTHLY', 2026, 2026)[0];
  const dec = periodsForYears('MONTHLY', 2026, 2026)[11];
  const year = periodsForYears('ANNUAL', 2026, 2026)[0];

  it('DAY_OF_MONTH falls in the following month', () => {
    expect(iso(calculateDueDate({ type: 'DAY_OF_MONTH', day: 21, monthOffset: 1 }, { period: jan, business }))).toBe('2026-02-21');
  });

  it('DAY_OF_MONTH rolls over the year end', () => {
    expect(iso(calculateDueDate({ type: 'DAY_OF_MONTH', day: 10 }, { period: dec, business }))).toBe('2027-01-10');
  });

  it('DAY_OF_MONTH clamps to short months', () => {
    expect(iso(calculateDueDate({ type: 'DAY_OF_MONTH', day: 31, monthOffset: 1 }, { period: jan, business }))).toBe('2026-02-28');
  });

  it('LAST_DAY_OF_MONTH', () => {
    expect(iso(calculateDueDate({ type: 'LAST_DAY_OF_MONTH', monthOffset: 1 }, { period: jan, business }))).toBe('2026-02-28');
  });

  it('FIXED_DATE with year offset', () => {
    expect(iso(calculateDueDate({ type: 'FIXED_DATE', month: 3, day: 31, yearOffset: 1 }, { period: year, business }))).toBe('2027-03-31');
    expect(iso(calculateDueDate({ type: 'FIXED_DATE', month: 6, day: 30 }, { period: year, business }))).toBe('2026-06-30');
  });

  it('DAYS_AFTER_PERIOD_END', () => {
    expect(iso(calculateDueDate({ type: 'DAYS_AFTER_PERIOD_END', days: 30 }, { period: jan, business }))).toBe('2026-03-02');
  });

  it('MONTHS_AFTER_PERIOD_END defaults to month end', () => {
    expect(iso(calculateDueDate({ type: 'MONTHS_AFTER_PERIOD_END', months: 6 }, { period: year, business }))).toBe('2027-06-30');
  });

  it('ANNIVERSARY uses the incorporation date', () => {
    expect(iso(calculateDueDate({ type: 'ANNIVERSARY', anchor: 'dateOfIncorporation', daysAfter: 42 }, { period: year, business }))).toBe('2026-04-26');
  });

  it('DAYS_AFTER_ANCHOR returns null without an anchor', () => {
    const once = periodsForYears('ONE_TIME', 2026, 2026)[0];
    expect(calculateDueDate({ type: 'DAYS_AFTER_ANCHOR', anchor: 'dateOfIncorporation', days: 30 }, { period: once, business: {} })).toBeNull();
  });

  it('rejects unknown rule types', () => {
    expect(() => calculateDueDate({ type: 'NOPE' } as any, { period: jan, business })).toThrow();
    expect(validateDueRule({ type: 'NOPE' })).toMatch(/Unsupported/);
    expect(validateDueRule({ type: 'FIXED_DATE', month: 13, day: 1 })).toBeTruthy();
    expect(validateDueRule({ type: 'DAY_OF_MONTH', day: 21 })).toBeNull();
  });
});
