/**
 * Module purpose: Creates monthly, quarterly, annual, and custom reporting periods over a requested date range.
 */
import { Frequency } from '../config/constants';
import { daysInMonth, utcDate } from '../utils/dates';

export interface Period {
  /** Stable key used to deduplicate tasks, e.g. "2026-03", "2026-Q1", "2026-H2", "2026", "ONCE". */
  key: string;
  label: string;
  start: Date;
  end: Date;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthPeriod(year: number, m: number): Period {
  return {
    key: `${year}-${String(m + 1).padStart(2, '0')}`,
    label: `${MONTHS[m]} ${year}`,
    start: utcDate(year, m, 1),
    end: utcDate(year, m, daysInMonth(year, m)),
  };
}

function spanPeriod(year: number, startMonth: number, months: number, key: string, label: string): Period {
  const endMonth = startMonth + months - 1;
  return { key, label, start: utcDate(year, startMonth, 1), end: utcDate(year, endMonth, daysInMonth(year, endMonth)) };
}

/**
 * Returns the calendar periods for a frequency across [fromYear, toYear].
 * ONE_TIME returns a single period anchored on `anchor` (e.g. incorporation date).
 */
export function periodsForYears(
  frequency: Frequency,
  fromYear: number,
  toYear: number,
  options: { anchor?: Date; customIntervalMonths?: number } = {},
): Period[] {
  if (frequency === 'ONE_TIME') {
    const anchor = options.anchor ?? utcDate(fromYear, 0, 1);
    return [{ key: 'ONCE', label: 'One-time', start: anchor, end: anchor }];
  }
  const periods: Period[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    switch (frequency) {
      case 'MONTHLY':
        for (let m = 0; m < 12; m++) periods.push(monthPeriod(year, m));
        break;
      case 'QUARTERLY':
        for (let q = 0; q < 4; q++) periods.push(spanPeriod(year, q * 3, 3, `${year}-Q${q + 1}`, `Q${q + 1} ${year}`));
        break;
      case 'BI_ANNUAL':
        periods.push(spanPeriod(year, 0, 6, `${year}-H1`, `H1 ${year}`));
        periods.push(spanPeriod(year, 6, 6, `${year}-H2`, `H2 ${year}`));
        break;
      case 'ANNUAL':
        periods.push(spanPeriod(year, 0, 12, `${year}`, `${year}`));
        break;
      case 'CUSTOM': {
        const interval = Math.min(12, Math.max(1, options.customIntervalMonths ?? 1));
        let index = 1;
        for (let m = 0; m < 12; m += interval) {
          const span = Math.min(interval, 12 - m);
          periods.push(spanPeriod(year, m, span, `${year}-C${index}`, `${MONTHS[m]}–${MONTHS[m + span - 1]} ${year}`));
          index++;
        }
        break;
      }
    }
  }
  return periods;
}
