/**
 * Module purpose: Computes a task’s current status and priority from its deadline while respecting terminal states.
 */
import { PENDING_WINDOW_DAYS, TaskPriority, TaskStatus } from '../config/constants';
import { diffInDays } from '../utils/dates';

/** Statuses the scheduler must never overwrite. */
const TERMINAL: TaskStatus[] = ['COMPLETED', 'NOT_APPLICABLE'];

/**
 * UPCOMING: due in more than PENDING_WINDOW_DAYS days
 * PENDING:  due within PENDING_WINDOW_DAYS days and not started
 * IN_PROGRESS: someone is working on it (kept until due date passes)
 * OVERDUE: due date has passed and not completed
 */
export function computeStatus(current: TaskStatus | undefined, dueDate: Date, today: Date): TaskStatus {
  if (current && TERMINAL.includes(current)) return current;
  const days = diffInDays(dueDate, today);
  if (days < 0) return 'OVERDUE';
  if (current === 'IN_PROGRESS') return 'IN_PROGRESS';
  return days <= PENDING_WINDOW_DAYS ? 'PENDING' : 'UPCOMING';
}

/**
 * Ranks the urgency of a task using its status and remaining time until the deadline.
 */
export function computePriority(status: TaskStatus, dueDate: Date, today: Date): TaskPriority {
  if (status === 'COMPLETED' || status === 'NOT_APPLICABLE') return 'LOW';
  const days = diffInDays(dueDate, today);
  if (days < 0) return 'CRITICAL';
  if (days <= 3) return 'HIGH';
  if (days <= PENDING_WINDOW_DAYS) return 'MEDIUM';
  return 'LOW';
}
