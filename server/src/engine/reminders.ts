/**
 * Module purpose: Determines which pre-deadline, due-today, or overdue reminder window applies, and builds deterministic keys for duplicate prevention.
 */
import { diffInDays } from '../utils/dates';

export const OVERDUE_THRESHOLDS = [1, 7, 14, 30];

/**
 * Returns the reminder key a task has earned today, or null.
 *
 * Uses the nearest threshold that has been crossed, so a missed scheduler run or a
 * task created late still gets exactly one reminder for the current window
 * (e.g. a task created 6 days before its deadline gets the "7 days" reminder once).
 * Keys are stored with the notification so each one is only sent once per task.
 */
export function reminderKeyFor(
  dueDate: Date,
  today: Date,
  offsets: number[],
  includeOverdue: boolean,
): string | null {
  const days = diffInDays(dueDate, today);
  if (days >= 0) {
    const crossed = [...offsets].filter((o) => o >= days).sort((a, b) => a - b)[0];
    if (crossed === undefined) return null;
    return crossed === 0 ? 'DUE_TODAY' : `BEFORE_${crossed}`;
  }
  if (!includeOverdue) return null;
  const overdueBy = -days;
  const reached = OVERDUE_THRESHOLDS.filter((t) => t <= overdueBy).sort((a, b) => b - a)[0];
  return reached === undefined ? null : `OVERDUE_${reached}`;
}

/**
 * Maps a computed reminder key to the user-facing reminder category.
 */
export function reminderKind(key: string): 'REMINDER' | 'DUE_TODAY' | 'OVERDUE' {
  if (key === 'DUE_TODAY') return 'DUE_TODAY';
  if (key.startsWith('OVERDUE')) return 'OVERDUE';
  return 'REMINDER';
}
