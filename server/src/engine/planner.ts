/**
 * Module purpose: Combines business applicability, reporting periods, and due-rule calculations to plan compliance tasks without writing to the database.
 */
import { Frequency } from '../config/constants';
import { businessFacts, evaluateRules } from './applicability';
import { calculateDueDate } from './dueDate';
import { periodsForYears } from './periods';

export interface PlannedTask {
  requirementId: string;
  agencyId: string;
  title: string;
  category: string;
  period: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
}

/**
 * Pure planning step: given a business and requirements, returns the tasks that
 * should exist within the window [windowStart, windowEnd] (by due date).
 * Kept free of database calls so it can be unit tested directly.
 */
export function planTasks(
  business: Record<string, any>,
  requirements: Array<Record<string, any>>,
  windowStart: Date,
  windowEnd: Date,
): { planned: PlannedTask[]; applicableIds: string[]; warnings: string[] } {
  const facts = businessFacts(business);
  const planned: PlannedTask[] = [];
  const applicableIds: string[] = [];
  const warnings: string[] = [];
  const businessStart: Date | null = business.dateOfIncorporation ? new Date(business.dateOfIncorporation) : null;

  for (const req of requirements) {
    if (req.active === false) continue;
    if (!evaluateRules(req.applicabilityRules, facts).applies) continue;
    applicableIds.push(String(req._id));

    // Generate an extra previous year because a period may have a deadline in the following year.
    const years = [windowStart.getUTCFullYear() - 1, windowEnd.getUTCFullYear()];
    const anchor = businessStart ?? (business.createdAt ? new Date(business.createdAt) : windowStart);
    const periods = periodsForYears(req.frequency as Frequency, years[0], years[1], {
      anchor,
      customIntervalMonths: req.customIntervalMonths,
    });

    for (const period of periods) {
      // Nothing is owed for periods that ended before the business existed.
      if (businessStart && req.frequency !== 'ONE_TIME' && period.end < businessStart) continue;
      let dueDate: Date | null;
      try {
        dueDate = calculateDueDate(req.dueRule, { period, business });
      } catch (err) {
        warnings.push(`Requirement ${req.code}: ${(err as Error).message}`);
        break;
      }
      if (!dueDate) continue;
      if (dueDate < windowStart || dueDate > windowEnd) continue;
      if (req.effectiveFrom && dueDate < new Date(req.effectiveFrom)) continue;
      if (req.effectiveUntil && dueDate > new Date(req.effectiveUntil)) continue;
      planned.push({
        requirementId: String(req._id),
        agencyId: String(req.agencyId?._id ?? req.agencyId),
        title: req.name,
        category: req.category,
        period: period.key,
        periodLabel: period.label,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate,
      });
    }
  }
  return { planned, applicableIds, warnings };
}

