/**
 * Module purpose: Persists tasks planned by the engine without overwriting existing progress; updates applicability and deadline statuses.
 */
import { Types } from 'mongoose';
import { env } from '../config/env';
import { TaskStatus } from '../config/constants';
import { computePriority, computeStatus, planTasks } from '../engine';

export { planTasks } from '../engine';
import { businessRepository, requirementRepository, taskRepository } from '../repositories';
import { addMonthsUTC, todayInTimezone, utcDate } from '../utils/dates';
import { logger } from '../utils/logger';

export interface GenerationResult {
  businessId: string;
  applicableRequirements: number;
  created: number;
  markedNotApplicable: number;
  reactivated: number;
}

/** The window of due dates we keep tasks for: start of last month through the horizon. */
export function generationWindow(today: Date, lookbackMonths = 1) {
  const start = addMonthsUTC(utcDate(today.getUTCFullYear(), today.getUTCMonth(), 1), -lookbackMonths);
  const end = addMonthsUTC(today, env.TASK_HORIZON_MONTHS);
  return { start, end };
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const taskGenerationService = {
  async generateForBusiness(
    businessId: string,
    today: Date = todayInTimezone(env.APP_TIMEZONE),
    options: { lookbackMonths?: number } = {},
  ): Promise<GenerationResult> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error(`Business ${businessId} not found`);

    const result: GenerationResult = { businessId, applicableRequirements: 0, created: 0, markedNotApplicable: 0, reactivated: 0 };
    if (business.businessStatus === 'CLOSED') return result;

    const requirements = await requirementRepository.find({ active: true });
    const { start, end } = generationWindow(today, options.lookbackMonths);
    const { planned, applicableIds, warnings } = planTasks(business.toObject(), requirements.map((r) => r.toObject()), start, end);
    warnings.forEach((w) => logger.warn(w));
    result.applicableRequirements = applicableIds.length;

    // Insert only missing planned tasks; existing completed or edited records must remain untouched.
    if (planned.length > 0) {
      // Upsert with $setOnInsert: existing tasks (and their progress) are never overwritten.
      const ops = planned.map((p) => {
        const status: TaskStatus = computeStatus(undefined, p.dueDate, today);
        return {
          updateOne: {
            filter: { businessId: business._id, requirementId: new Types.ObjectId(p.requirementId), period: p.period },
            update: {
              $setOnInsert: {
                ...p,
                businessId: business._id,
                requirementId: new Types.ObjectId(p.requirementId),
                agencyId: new Types.ObjectId(p.agencyId),
                status,
                priority: computePriority(status, p.dueDate, today),
                generatedAutomatically: true,
              },
            },
            upsert: true,
          },
        };
      });
      const bulk = await taskRepository.bulkWrite(ops);
      result.created = bulk.upsertedCount;
    }

    // Future open tasks whose requirement no longer applies become NOT_APPLICABLE.
    const applicableObjectIds = applicableIds.map((id) => new Types.ObjectId(id));
    const na = await taskRepository.updateMany(
      {
        businessId: business._id,
        generatedAutomatically: true,
        requirementId: { $nin: applicableObjectIds },
        status: { $in: ['UPCOMING', 'PENDING'] },
        dueDate: { $gte: today },
      },
      { $set: { status: 'NOT_APPLICABLE', priority: 'LOW' } },
    );
    result.markedNotApplicable = na.modifiedCount;

    // Tasks previously marked NOT_APPLICABLE by the engine come back if the rule applies again.
    const back = await taskRepository.find({
      businessId: business._id,
      generatedAutomatically: true,
      requirementId: { $in: applicableObjectIds },
      status: 'NOT_APPLICABLE',
      dueDate: { $gte: today },
      completedAt: { $exists: false },
    });
    for (const t of back) {
      t.status = computeStatus(undefined, t.dueDate, today);
      t.priority = computePriority(t.status as TaskStatus, t.dueDate, today);
      await t.save();
    }
    result.reactivated = back.length;
    return result;
  },

  /**
   * Processes every open business independently; a failure for one business does not block the others.
   */
  async generateForAll(today?: Date) {
    const businesses = await businessRepository.find({ businessStatus: { $ne: 'CLOSED' } }, { select: '_id' });
    let created = 0;
    for (const b of businesses) {
      try {
        created += (await this.generateForBusiness(String(b._id), today)).created;
      } catch (err) {
        logger.error(`Task generation failed for business ${b._id}`, err);
      }
    }
    return { businesses: businesses.length, created };
  },

  /** Recomputes status and priority for all open tasks (e.g. UPCOMING → PENDING → OVERDUE). */
  async refreshStatuses(today: Date = todayInTimezone(env.APP_TIMEZONE)) {
    const open = await taskRepository.find({ status: { $in: ['UPCOMING', 'PENDING', 'IN_PROGRESS', 'OVERDUE'] } });
    let changed = 0;
    for (const task of open) {
      const status = computeStatus(task.status as TaskStatus, task.dueDate, today);
      const priority = computePriority(status, task.dueDate, today);
      if (status !== task.status || priority !== task.priority) {
        task.status = status;
        task.priority = priority;
        await task.save();
        changed++;
      }
    }
    return { checked: open.length, changed };
  },
};
