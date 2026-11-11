/**
 * Module purpose: Aggregates platform-wide administrative metrics, users, businesses, and job actions.
 */
import {
  agencyRepository,
  auditLogRepository,
  businessRepository,
  notificationRepository,
  requirementRepository,
  taskRepository,
  userRepository,
} from '../repositories';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { complianceRate } from './business.service';

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const adminService = {
  /**
   * Builds key counts and summaries for the administrator dashboard.
   */
  async overview() {
    const [users, activeUsers, businesses, agencies, requirements, taskRows, notifications, recentAudit, businessesByState] = await Promise.all([
      userRepository.count({}),
      userRepository.count({ isActive: true }),
      businessRepository.count({}),
      agencyRepository.count({ active: true }),
      requirementRepository.count({ active: true }),
      taskRepository.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      notificationRepository.count({}),
      auditLogRepository.find({}, { sort: { timestamp: -1 }, limit: 8, populate: { path: 'user', select: 'firstName lastName email' } }),
      businessRepository.aggregate([{ $group: { _id: '$state', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    ]);
    const tasks = Object.fromEntries(taskRows.map((r: any) => [r._id, r.count]));
    return {
      users,
      activeUsers,
      businesses,
      agencies,
      requirements,
      notifications,
      tasks,
      platformCompliance: complianceRate(tasks.COMPLETED ?? 0, tasks.OVERDUE ?? 0),
      recentAudit,
      businessesByState: businessesByState.map((b: any) => ({ state: b._id, count: b.count })),
    };
  },

  /**
   * Lists the platform actions captured in the audit history.
   */
  async auditLogs(query: Record<string, unknown>) {
    const q = parseListQuery(query, ['timestamp', 'action', 'entity'], '-timestamp');
    const filter: Record<string, any> = {};
    if (typeof query.action === 'string' && query.action) filter.action = query.action;
    if (typeof query.entity === 'string' && query.entity) filter.entity = query.entity;
    if (typeof query.userId === 'string' && query.userId) filter.user = query.userId;
    if (typeof query.businessId === 'string' && query.businessId) filter.businessId = query.businessId;
    if (typeof query.from === 'string' || typeof query.to === 'string') {
      filter.timestamp = {};
      if (typeof query.from === 'string' && query.from) filter.timestamp.$gte = new Date(query.from);
      if (typeof query.to === 'string' && query.to) filter.timestamp.$lte = new Date(query.to);
    }
    if (q.search) filter.action = { $regex: escapeRegex(q.search), $options: 'i' };
    const { items, total } = await auditLogRepository.paginate(filter, {
      sort: q.sort,
      skip: q.skip,
      limit: q.limit,
      populate: [
        { path: 'user', select: 'firstName lastName email' },
        { path: 'businessId', select: 'businessName' },
      ],
    });
    const actions = await auditLogRepository.aggregate([{ $group: { _id: '$action' } }, { $sort: { _id: 1 } }]);
    return { items, meta: pageMeta(q.page, q.limit, total), actions: actions.map((a: any) => a._id) };
  },
};
