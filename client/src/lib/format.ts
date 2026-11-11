/**
 * Module purpose: Formats dates, monetary values, sizes, labels, and user names for display. Deadline date-only handling avoids timezone shifts.
 */
import { differenceInCalendarDays, format, formatDistanceToNow, parseISO } from 'date-fns';
import type { TaskPriority, TaskStatus } from '../types';

const toDate = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d);

/** Due dates are stored as date-only values at 00:00 UTC; read them as calendar dates. */
export function dueDateOnly(d: string | Date): Date {
  const x = toDate(d);
  return new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

export const fmtDate = (d?: string | Date | null) => (d ? format(toDate(d), 'd MMM yyyy') : '—');
export const fmtDue = (d: string | Date) => format(dueDateOnly(d), 'd MMM yyyy');
export const fmtDateTime = (d?: string | Date | null) => (d ? format(toDate(d), 'd MMM yyyy, HH:mm') : '—');
export const fmtAgo = (d: string | Date) => formatDistanceToNow(toDate(d), { addSuffix: true });

/**
 * Counts whole days from today to the deadline, ignoring time-of-day.
 */
export function daysUntil(due: string | Date, today = new Date()): number {
  return differenceInCalendarDays(dueDateOnly(due), today);
}

export const naira = (n?: number) =>
  n === undefined || n === null ? '—' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`;

export const STATUS_LABEL: Record<TaskStatus, string> = {
  UPCOMING: 'Upcoming',
  PENDING: 'Due soon',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  OVERDUE: 'Overdue',
  NOT_APPLICABLE: 'Not applicable',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };

export const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  ACCOUNTANT: 'Accountant',
  COMPLIANCE_OFFICER: 'Compliance officer',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
  PLATFORM_ADMIN: 'Platform admin',
};

export const FREQUENCY_LABEL: Record<string, string> = {
  ONE_TIME: 'One-time',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  BI_ANNUAL: 'Twice a year',
  ANNUAL: 'Yearly',
  CUSTOM: 'Custom',
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  TAX_RECEIPT: 'Tax receipt',
  CERTIFICATE: 'Certificate',
  FILING_ACKNOWLEDGEMENT: 'Filing acknowledgement',
  PAYMENT_EVIDENCE: 'Payment evidence',
  REGISTRATION_DOCUMENT: 'Registration document',
  LICENSE: 'Licence',
  CORRESPONDENCE: 'Correspondence',
  OTHER: 'Other',
};

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const fullName = (u?: { firstName?: string; lastName?: string } | null) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : '—';

/** Reads a populated ref or a bare id. */
export const refId = (v: { _id: string } | string | null | undefined) => (typeof v === 'string' ? v : v?._id ?? '');
