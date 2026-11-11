/**
 * Module purpose: Tests transitions between upcoming, pending, overdue, and terminal task states.
 */
import { computePriority, computeStatus, reminderKeyFor } from '../src/engine';
import { planTasks } from '../src/engine';
import { addDaysUTC, utcDate } from '../src/utils/dates';

const today = utcDate(2026, 8, 21);
const offsets = [30, 14, 7, 3, 1, 0];

describe('computeStatus', () => {
  it('moves from UPCOMING to PENDING to OVERDUE', () => {
    expect(computeStatus(undefined, addDaysUTC(today, 40), today)).toBe('UPCOMING');
    expect(computeStatus(undefined, addDaysUTC(today, 14), today)).toBe('PENDING');
    expect(computeStatus(undefined, today, today)).toBe('PENDING');
    expect(computeStatus('PENDING', addDaysUTC(today, -1), today)).toBe('OVERDUE');
  });

  it('keeps IN_PROGRESS until the due date passes', () => {
    expect(computeStatus('IN_PROGRESS', addDaysUTC(today, 40), today)).toBe('IN_PROGRESS');
    expect(computeStatus('IN_PROGRESS', addDaysUTC(today, -2), today)).toBe('OVERDUE');
  });

  it('never changes completed or not-applicable tasks', () => {
    expect(computeStatus('COMPLETED', addDaysUTC(today, -10), today)).toBe('COMPLETED');
    expect(computeStatus('NOT_APPLICABLE', addDaysUTC(today, -10), today)).toBe('NOT_APPLICABLE');
  });

  it('assigns priority by urgency', () => {
    expect(computePriority('OVERDUE', addDaysUTC(today, -1), today)).toBe('CRITICAL');
    expect(computePriority('PENDING', addDaysUTC(today, 2), today)).toBe('HIGH');
    expect(computePriority('PENDING', addDaysUTC(today, 10), today)).toBe('MEDIUM');
    expect(computePriority('UPCOMING', addDaysUTC(today, 60), today)).toBe('LOW');
  });
});

describe('reminderKeyFor', () => {
  it('returns the reminder window a task is in', () => {
    expect(reminderKeyFor(addDaysUTC(today, 45), today, offsets, true)).toBeNull();
    expect(reminderKeyFor(addDaysUTC(today, 30), today, offsets, true)).toBe('BEFORE_30');
    expect(reminderKeyFor(addDaysUTC(today, 7), today, offsets, true)).toBe('BEFORE_7');
    expect(reminderKeyFor(today, today, offsets, true)).toBe('DUE_TODAY');
  });

  it('catches up on missed runs with the nearest window only', () => {
    expect(reminderKeyFor(addDaysUTC(today, 6), today, offsets, true)).toBe('BEFORE_7');
    expect(reminderKeyFor(addDaysUTC(today, 20), today, offsets, true)).toBe('BEFORE_30');
  });

  it('handles overdue thresholds and the overdue toggle', () => {
    expect(reminderKeyFor(addDaysUTC(today, -1), today, offsets, true)).toBe('OVERDUE_1');
    expect(reminderKeyFor(addDaysUTC(today, -9), today, offsets, true)).toBe('OVERDUE_7');
    expect(reminderKeyFor(addDaysUTC(today, -9), today, offsets, false)).toBeNull();
  });
});

describe('planTasks', () => {
  const business = {
    businessType: 'Limited Liability Company',
    state: 'Kano',
    industry: 'Technology',
    employeeCount: 15,
    flags: { vatRegistered: true },
    dateOfIncorporation: utcDate(2021, 2, 15),
  };
  const vat = {
    _id: '000000000000000000000001',
    agencyId: '000000000000000000000009',
    name: 'VAT return',
    code: 'VAT',
    category: 'Tax',
    frequency: 'MONTHLY',
    dueRule: { type: 'DAY_OF_MONTH', day: 21, monthOffset: 1 },
    applicabilityRules: { conditions: [{ field: 'flags.vatRegistered', operator: 'IS_TRUE' }] },
  };
  const pension = {
    ...vat,
    _id: '000000000000000000000002',
    name: 'Pension',
    applicabilityRules: { conditions: [{ field: 'employeeCount', operator: 'GTE', value: 50 }] },
  };

  it('plans one task per period inside the window and skips non-applicable requirements', () => {
    const { planned, applicableIds } = planTasks(business, [vat, pension], utcDate(2026, 0, 1), utcDate(2026, 11, 31));
    expect(applicableIds).toEqual(['000000000000000000000001']);
    // Dec 2025 (due 21 Jan 2026) through Nov 2026 (due 21 Dec 2026)
    expect(planned).toHaveLength(12);
    expect(new Set(planned.map((p) => p.period)).size).toBe(12);
    expect(planned[0].period).toBe('2025-12');
  });

  it('skips periods before the business existed', () => {
    const young = { ...business, dateOfIncorporation: utcDate(2026, 5, 10) };
    const { planned } = planTasks(young, [vat], utcDate(2026, 0, 1), utcDate(2026, 11, 31));
    expect(planned[0].period).toBe('2026-06');
  });

  it('is deterministic, so re-running produces the same keys', () => {
    const a = planTasks(business, [vat], utcDate(2026, 0, 1), utcDate(2026, 11, 31)).planned.map((p) => p.period);
    const b = planTasks(business, [vat], utcDate(2026, 0, 1), utcDate(2026, 11, 31)).planned.map((p) => p.period);
    expect(a).toEqual(b);
  });
});
