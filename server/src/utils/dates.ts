/**
 * Module purpose: Handles calendar dates in UTC and the configured application timezone to avoid deadline errors from time-of-day offsets.
 */
/**
 * All compliance dates are stored as "date-only" values at 00:00 UTC.
 * Day arithmetic happens in UTC so results don't drift with the server's timezone.
 */
export function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

/**
 * Returns the last valid day for a month, used to clamp rules such as the 31st in February.
 */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Moves a calendar date by whole UTC days.
 */
export function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Adds months, clamping the day to the end of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsUTC(date: Date, months: number): Date {
  const m = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(targetYear, targetMonth));
  return utcDate(targetYear, targetMonth, day);
}

/**
 * Removes time-of-day information for stable date comparisons.
 */
export function startOfDayUTC(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Today's calendar date in the given IANA timezone, as a UTC date-only value. */
export function todayInTimezone(timeZone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return utcDate(get('year'), get('month') - 1, get('day'));
}

/**
 * Calculates whole calendar days between two deadlines.
 */
export function diffInDays(later: Date, earlier: Date): number {
  return Math.round((startOfDayUTC(later).getTime() - startOfDayUTC(earlier).getTime()) / 86_400_000);
}

/**
 * Presents a date consistently in email content and audit details.
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
