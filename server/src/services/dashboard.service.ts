/**
 * Module purpose: Aggregates compliance counts and upcoming tasks into business dashboard summaries.
 */
import { Types } from 'mongoose';
import { env } from '../config/env';
import { PENDING_WINDOW_DAYS } from '../config/constants';
import { filingRepository, notificationRepository, taskRepository } from '../repositories';
import { addDaysUTC, addMonthsUTC, todayInTimezone, utcDate } from '../utils/dates';
import { complianceRate } from './business.service';

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const dashboardService = {
  /**
   * Collects summary counts, upcoming deadlines, recent filing activity, and notifications for one accessible business.
   */
  async forBusiness(businessId: string, userId: string) {
    const bId = new Types.ObjectId(businessId);
    const today = todayInTimezone(env.APP_TIMEZONE);
    const soon = addDaysUTC(today, PENDING_WINDOW_DAYS);

    const [statusRows, upcoming, overdue, recentFilings, notifications, byCategory, monthly] = await Promise.all([
      taskRepository.aggregate([{ $match: { businessId: bId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      taskRepository.find(
        { businessId: bId, status: { $in: ['UPCOMING', 'PENDING', 'IN_PROGRESS'] } },
        { sort: { dueDate: 1 }, limit: 6, populate: { path: 'agencyId', select: 'acronym name' } },
      ),
      taskRepository.find(
        { businessId: bId, status: 'OVERDUE' },
        { sort: { dueDate: 1 }, limit: 6, populate: { path: 'agencyId', select: 'acronym name' } },
      ),
      filingRepository.find(
        { businessId: bId },
        { sort: { filingDate: -1 }, limit: 5, populate: [{ path: 'taskId', select: 'title periodLabel' }, { path: 'filedBy', select: 'firstName lastName' }] },
      ),
      notificationRepository.find({ userId, businessId: bId }, { sort: { createdAt: -1 }, limit: 5 }),
      taskRepository.aggregate([
        { $match: { businessId: bId, status: { $ne: 'NOT_APPLICABLE' } } },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
            overdue: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      taskRepository.aggregate([
        {
          $match: {
            businessId: bId,
            status: { $ne: 'NOT_APPLICABLE' },
            dueDate: { $gte: addMonthsUTC(utcDate(today.getUTCFullYear(), today.getUTCMonth(), 1), -5), $lt: addMonthsUTC(utcDate(today.getUTCFullYear(), today.getUTCMonth(), 1), 7) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$dueDate' } },
            due: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
            overdue: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const counts: Record<string, number> = Object.fromEntries(statusRows.map((r: any) => [r._id, r.count]));
    const get = (s: string) => counts[s] ?? 0;
    const dueSoon = await taskRepository.count({
      businessId: bId,
      status: { $in: ['PENDING', 'IN_PROGRESS', 'UPCOMING'] },
      dueDate: { $gte: today, $lte: soon },
    });

    return {
      today,
      stats: {
        total: Object.entries(counts).filter(([s]) => s !== 'NOT_APPLICABLE').reduce((a, [, c]) => a + c, 0),
        completed: get('COMPLETED'),
        pending: get('PENDING') + get('UPCOMING') + get('IN_PROGRESS'),
        inProgress: get('IN_PROGRESS'),
        overdue: get('OVERDUE'),
        dueSoon,
        compliancePercentage: complianceRate(get('COMPLETED'), get('OVERDUE')),
      },
      upcoming,
      overdue,
      recentFilings,
      notifications,
      byCategory: byCategory.map((c: any) => ({ category: c._id ?? 'Other', total: c.total, completed: c.completed, overdue: c.overdue })),
      monthly: monthly.map((m: any) => ({ month: m._id, due: m.due, completed: m.completed, overdue: m.overdue })),
    };
  },
};
