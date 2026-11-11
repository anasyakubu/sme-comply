/**
 * Module purpose: Tests date and display formatting, including calendar-day calculations that should not shift across time zones.
 */
import { daysUntil, dueDateOnly, fileSize, fullName, naira, refId, titleCase } from './format';

describe('format helpers', () => {
  it('reads UTC date-only due dates as calendar dates', () => {
    const d = dueDateOnly('2026-02-21T00:00:00.000Z');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(21);
  });

  it('counts calendar days until a due date', () => {
    const today = new Date(2026, 8, 21, 15, 30);
    expect(daysUntil('2026-09-21T00:00:00.000Z', today)).toBe(0);
    expect(daysUntil('2026-09-28T00:00:00.000Z', today)).toBe(7);
    expect(daysUntil('2026-09-18T00:00:00.000Z', today)).toBe(-3);
  });

  it('formats sizes, names, ids and labels', () => {
    expect(fileSize(512)).toBe('512 B');
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize(3 * 1_048_576)).toBe('3.0 MB');
    expect(fullName({ firstName: 'Amaka', lastName: 'Obi' })).toBe('Amaka Obi');
    expect(fullName(null)).toBe('—');
    expect(refId('abc')).toBe('abc');
    expect(refId({ _id: 'xyz' })).toBe('xyz');
    expect(titleCase('TASK_COMPLETED')).toBe('Task completed');
    expect(naira(1500)).toContain('1,500');
  });
});
