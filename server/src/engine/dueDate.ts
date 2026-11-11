/**
 * Module purpose: Calculates regulatory deadlines from data-driven due rules. Supported rules convert a compliance period into a UTC due date.
 */
import { Period } from './periods';
import { addDaysUTC, addMonthsUTC, daysInMonth, utcDate } from '../utils/dates';

export type DueRule =
  | { type: 'FIXED_DATE'; month: number; day: number; yearOffset?: number }
  | { type: 'DAY_OF_MONTH'; day: number; monthOffset?: number }
  | { type: 'LAST_DAY_OF_MONTH'; monthOffset?: number }
  | { type: 'DAYS_AFTER_PERIOD_END'; days: number }
  | { type: 'MONTHS_AFTER_PERIOD_END'; months: number; day?: number }
  | { type: 'DAYS_AFTER_ANCHOR'; anchor: 'dateOfIncorporation' | 'createdAt'; days: number }
  | { type: 'ANNIVERSARY'; anchor: 'dateOfIncorporation' | 'createdAt'; daysAfter?: number };

export interface DueContext {
  period: Period;
  business: { dateOfIncorporation?: Date | null; createdAt?: Date | null };
}

type Handler = (rule: any, ctx: DueContext) => Date | null;

function clampDay(year: number, monthIndex: number, day: number): Date {
  return utcDate(year, monthIndex, Math.min(Math.max(1, day), daysInMonth(year, monthIndex)));
}

function anchorDate(anchor: string, ctx: DueContext): Date | null {
  const value = anchor === 'dateOfIncorporation' ? ctx.business.dateOfIncorporation : ctx.business.createdAt;
  return value ? new Date(value) : null;
}

// Each due-rule type has one handler; administrators store rule data rather than hard-coding deadlines.
const handlers: Record<string, Handler> = {
  FIXED_DATE: (rule, { period }) =>
    clampDay(period.end.getUTCFullYear() + (rule.yearOffset ?? 0), rule.month - 1, rule.day),

  DAY_OF_MONTH: (rule, { period }) => {
    const base = addMonthsUTC(utcDate(period.end.getUTCFullYear(), period.end.getUTCMonth(), 1), rule.monthOffset ?? 1);
    return clampDay(base.getUTCFullYear(), base.getUTCMonth(), rule.day);
  },

  LAST_DAY_OF_MONTH: (rule, { period }) => {
    const base = addMonthsUTC(utcDate(period.end.getUTCFullYear(), period.end.getUTCMonth(), 1), rule.monthOffset ?? 1);
    return utcDate(base.getUTCFullYear(), base.getUTCMonth(), daysInMonth(base.getUTCFullYear(), base.getUTCMonth()));
  },

  DAYS_AFTER_PERIOD_END: (rule, { period }) => addDaysUTC(period.end, rule.days),

  MONTHS_AFTER_PERIOD_END: (rule, { period }) => {
    const base = addMonthsUTC(utcDate(period.end.getUTCFullYear(), period.end.getUTCMonth(), 1), rule.months);
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    return rule.day ? clampDay(y, m, rule.day) : utcDate(y, m, daysInMonth(y, m));
  },

  DAYS_AFTER_ANCHOR: (rule, ctx) => {
    const a = anchorDate(rule.anchor, ctx);
    return a ? addDaysUTC(utcDate(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()), rule.days) : null;
  },

  ANNIVERSARY: (rule, ctx) => {
    const a = anchorDate(rule.anchor, ctx);
    if (!a) return null;
    const anniversary = clampDay(ctx.period.end.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
    return addDaysUTC(anniversary, rule.daysAfter ?? 0);
  },
};

/** Lets new due-rule types be plugged in without changing callers. */
export function registerDueRule(type: string, handler: Handler): void {
  handlers[type] = handler;
}

/**
 * Lists rule types that administrators can select when defining deadlines.
 */
export function supportedDueRuleTypes(): string[] {
  return Object.keys(handlers);
}

/**
 * Applies a registered due-rule handler to the reporting period. Missing anchors can produce null; unknown rule types throw.
 */
export function calculateDueDate(rule: DueRule | Record<string, any>, ctx: DueContext): Date | null {
  const handler = handlers[(rule as any)?.type];
  if (!handler) throw new Error(`Unsupported due rule type: ${(rule as any)?.type}`);
  return handler(rule, ctx);
}

/** Validates the shape of a due rule; returns an error message or null. */
export function validateDueRule(rule: any): string | null {
  if (!rule || typeof rule !== 'object' || typeof rule.type !== 'string') return 'Due rule must have a type';
  if (!handlers[rule.type]) return `Unsupported due rule type: ${rule.type}`;
  const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  switch (rule.type) {
    case 'FIXED_DATE':
      if (!isInt(rule.month, 1, 12) || !isInt(rule.day, 1, 31)) return 'FIXED_DATE needs month (1-12) and day (1-31)';
      break;
    case 'DAY_OF_MONTH':
      if (!isInt(rule.day, 1, 31)) return 'DAY_OF_MONTH needs day (1-31)';
      break;
    case 'DAYS_AFTER_PERIOD_END':
    case 'DAYS_AFTER_ANCHOR':
      if (!isInt(rule.days, 0, 3650)) return `${rule.type} needs days (0-3650)`;
      break;
    case 'MONTHS_AFTER_PERIOD_END':
      if (!isInt(rule.months, 0, 60)) return 'MONTHS_AFTER_PERIOD_END needs months (0-60)';
      break;
  }
  return null;
}
