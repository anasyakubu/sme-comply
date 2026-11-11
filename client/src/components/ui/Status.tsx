/**
 * Module purpose: Converts internal compliance states and priorities to readable badges and deadline countdowns.
 */
import type { ReactNode } from 'react';
import type { TaskPriority, TaskStatus } from '../../types';
import { daysUntil, PRIORITY_LABEL, STATUS_LABEL } from '../../lib/format';

const STATUS_STYLE: Record<TaskStatus, string> = {
  UPCOMING: 'bg-paper text-ink-700 border-line',
  PENDING: 'bg-due-50 text-due-700 border-due-100',
  IN_PROGRESS: 'bg-white text-ink-900 border-ink-300',
  COMPLETED: 'bg-ledger-50 text-ledger-700 border-ledger-100',
  OVERDUE: 'bg-signal-50 text-signal-700 border-signal-100',
  NOT_APPLICABLE: 'bg-white text-ink-400 border-line line-through',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  LOW: 'bg-ink-300',
  MEDIUM: 'bg-due-600',
  HIGH: 'bg-signal-600',
  CRITICAL: 'bg-signal-700 ring-2 ring-signal-100',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-700">
      <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`} aria-hidden />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'ink' }) {
  const tones = {
    neutral: 'bg-paper text-ink-700 border-line',
    green: 'bg-ledger-50 text-ledger-700 border-ledger-100',
    amber: 'bg-due-50 text-due-700 border-due-100',
    red: 'bg-signal-50 text-signal-700 border-signal-100',
    ink: 'bg-ink-900 text-white border-ink-900',
  };
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

/**
 * The signature element: every obligation carries its own count of days left,
 * set in tabular figures in the left margin like a ledger column.
 */
export function DueCountdown({ dueDate, status, size = 'md' }: { dueDate: string; status: TaskStatus; size?: 'md' | 'lg' }) {
  const days = daysUntil(dueDate);
  const done = status === 'COMPLETED' || status === 'NOT_APPLICABLE';
  const late = !done && days < 0;
  const today = !done && days === 0;
  const soon = !done && days > 0 && days <= 14;

  const colour = done ? 'text-ink-300' : late ? 'text-signal-600' : today || soon ? 'text-due-600' : 'text-ink-900';
  const numberSize = size === 'lg' ? 'text-4xl' : 'text-2xl';
  const value = done ? '✓' : today ? '0' : String(Math.abs(days));
  const caption = done
    ? status === 'COMPLETED'
      ? 'done'
      : 'n/a'
    : today
      ? 'due today'
      : late
        ? `day${Math.abs(days) === 1 ? '' : 's'} late`
        : `day${days === 1 ? '' : 's'} left`;

  return (
    <div className={`flex w-16 shrink-0 flex-col items-end ${size === 'lg' ? 'w-24' : ''}`} aria-label={done ? caption : `${value} ${caption}`}>
      <span className={`tabular font-extrabold leading-none ${numberSize} ${colour}`}>{value}</span>
      <span className={`mt-1 text-[0.7rem] font-medium ${late ? 'text-signal-600' : 'text-ink-500'}`}>{caption}</span>
    </div>
  );
}
