/**
 * Module purpose: Performs permission-aware task listing, completion, assignment, notes, and status changes.
 */
import { Types } from 'mongoose';
import { env } from '../config/env';
import { TaskStatus } from '../config/constants';
import { computePriority, computeStatus } from '../engine';
import { businessRepository, documentRepository, filingRepository, memberRepository, taskRepository, userRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { todayInTimezone } from '../utils/dates';
import { emailTemplates } from '../utils/emailTemplates';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { accessService } from './access.service';
import { AuditContext, auditService } from './audit.service';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
import { taskGenerationService } from './taskGeneration.service';

const TASK_POPULATE = [
  { path: 'agencyId', select: 'name acronym website' },
  { path: 'businessId', select: 'businessName' },
  { path: 'completedBy', select: 'firstName lastName' },
];

/**
 * Builds a query limited to accessible businesses before adding status, category, date, and escaped search filters.
 */
async function buildFilter(user: Express.AuthUser, query: Record<string, unknown>) {
  const filter: Record<string, any> = {};
  // Apply the permission-based business filter before user-specified search criteria.
  const visible = await accessService.visibleBusinessIds(user);
  if (typeof query.businessId === 'string' && query.businessId) {
    if (!Types.ObjectId.isValid(query.businessId)) throw ApiError.badRequest('Invalid businessId');
    if (visible && !visible.includes(query.businessId)) throw ApiError.notFound('Business not found');
    filter.businessId = new Types.ObjectId(query.businessId);
  } else if (visible) {
    filter.businessId = { $in: visible.map((id) => new Types.ObjectId(id)) };
  }
  const statuses = typeof query.status === 'string' && query.status ? query.status.split(',') : null;
  if (statuses) filter.status = { $in: statuses };
  else if (query.includeNotApplicable !== 'true') filter.status = { $ne: 'NOT_APPLICABLE' };
  if (typeof query.priority === 'string' && query.priority) filter.priority = { $in: query.priority.split(',') };
  if (typeof query.category === 'string' && query.category) filter.category = query.category;
  if (typeof query.agencyId === 'string' && Types.ObjectId.isValid(query.agencyId)) filter.agencyId = new Types.ObjectId(query.agencyId);
  if (typeof query.from === 'string' || typeof query.to === 'string') {
    filter.dueDate = {};
    if (typeof query.from === 'string' && query.from) filter.dueDate.$gte = new Date(query.from);
    if (typeof query.to === 'string' && query.to) filter.dueDate.$lte = new Date(query.to);
  }
  if (typeof query.search === 'string' && query.search.trim()) {
    filter.title = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
  }
  return filter;
}

/**
 * Loads the task and checks permission for its business, masking inaccessible tasks as not found.
 */
async function loadWithAccess(taskId: string, user: Express.AuthUser, permission: Parameters<typeof accessService.require>[2]) {
  if (!Types.ObjectId.isValid(taskId)) throw ApiError.notFound('Task not found');
  const task = await taskRepository.findById(taskId);
  if (!task) throw ApiError.notFound('Task not found');
  const access = await accessService.require(user, String(task.businessId), permission).catch((err) => {
    if (err instanceof ApiError && err.statusCode === 404) throw ApiError.notFound('Task not found');
    throw err;
  });
  return { task, access };
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const taskService = {
  loadWithAccess,

  /**
   * Lists only tasks the user may access and applies request filters and pagination.
   */
  async list(user: Express.AuthUser, query: Record<string, unknown>) {
    const q = parseListQuery(query, ['dueDate', 'createdAt', 'priority', 'status', 'title'], 'dueDate');
    const filter = await buildFilter(user, query);
    const { items, total } = await taskRepository.paginate(filter, { sort: q.sort, skip: q.skip, limit: q.limit, populate: TASK_POPULATE });
    return { items, meta: pageMeta(q.page, q.limit, total) };
  },

  /** Lightweight shape for the calendar view. */
  async calendar(user: Express.AuthUser, query: Record<string, unknown>) {
    const filter = await buildFilter(user, { ...query, includeNotApplicable: 'false' });
    const tasks = await taskRepository.find(filter, {
      sort: { dueDate: 1 },
      limit: 1000,
      select: 'title dueDate status priority category periodLabel agencyId businessId',
      populate: [
        { path: 'agencyId', select: 'acronym' },
        { path: 'businessId', select: 'businessName' },
      ],
    });
    return tasks;
  },

  /**
   * Loads the task and related records after checking access to its business.
   */
  async detail(taskId: string, user: Express.AuthUser) {
    const { access } = await loadWithAccess(taskId, user, 'tasks:view');
    const task = await taskRepository.findById(taskId, {
      populate: [
        ...TASK_POPULATE,
        { path: 'requirementId' },
        { path: 'notes.author', select: 'firstName lastName' },
        { path: 'assignedTo', select: 'firstName lastName email' },
      ],
    });
    const [filings, documents] = await Promise.all([
      filingRepository.find({ taskId }, { sort: { filingDate: -1 }, populate: [{ path: 'filedBy', select: 'firstName lastName' }, { path: 'documents', select: 'fileName cloudinaryUrl' }] }),
      documentRepository.find({ taskId }, { sort: { uploadedAt: -1 }, populate: { path: 'uploadedBy', select: 'firstName lastName' } }),
    ]);
    return { task, filings, documents, permissions: access.permissions, role: access.role };
  },

  /**
   * Applies a permitted task state change and writes an audit entry.
   */
  async updateStatus(taskId: string, status: TaskStatus, user: Express.AuthUser, ctx: AuditContext) {
    const { task, access } = await loadWithAccess(taskId, user, 'tasks:update');
    if (status === 'NOT_APPLICABLE' && !access.permissions.includes('tasks:mark_not_applicable')) {
      throw ApiError.forbidden('Only the owner or a compliance officer can mark a task as not applicable');
    }
    if (status === 'COMPLETED') return this.complete(taskId, user, ctx);
    const today = todayInTimezone(env.APP_TIMEZONE);
    const previous = task.status;
    if (status === 'NOT_APPLICABLE') {
      task.status = 'NOT_APPLICABLE';
      task.generatedAutomatically = false; // manual decision: the engine must not revive it
    } else if (status === 'IN_PROGRESS') {
      task.status = computeStatus('IN_PROGRESS', task.dueDate, today);
      if (task.status === 'OVERDUE') task.status = 'IN_PROGRESS';
    } else {
      // Reopen: let the engine decide between UPCOMING/PENDING/OVERDUE.
      task.status = computeStatus(undefined, task.dueDate, today);
      task.completedAt = undefined;
      task.completedBy = undefined;
    }
    task.priority = computePriority(task.status as TaskStatus, task.dueDate, today);
    await task.save();
    await auditService.log(ctx, 'TASK_STATUS_CHANGED', 'ComplianceTask', taskId, {
      businessId: String(task.businessId),
      metadata: { from: previous, to: task.status },
    });
    return task;
  },

  /**
   * Records completion details and sends relevant notifications.
   */
  async complete(taskId: string, user: Express.AuthUser, ctx: AuditContext, note?: string) {
    const { task } = await loadWithAccess(taskId, user, 'tasks:update');
    if (task.status === 'COMPLETED') return task;
    task.status = 'COMPLETED';
    task.priority = 'LOW';
    task.completedAt = new Date();
    task.completedBy = user.id as any;
    if (note) task.notes.push({ body: note, author: user.id as any, createdAt: new Date() } as any);
    await task.save();

    const businessId = String(task.businessId);
    const [business, actor] = await Promise.all([
      businessRepository.findById(businessId, { select: 'businessName' }),
      userRepository.findById(user.id, { select: 'firstName lastName' }),
    ]);
    const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'A team member';
    await notificationService.notifyBusiness(
      businessId,
      { type: 'TASK_COMPLETED', title: `${task.title} completed`, message: `${actorName} marked ${task.periodLabel ?? task.period} complete.`, relatedTaskId: taskId },
      user.id,
    );
    // Email the owner if someone else completed it.
    if (business) {
      const ownerMember = await memberRepository.findOne({ business: businessId, role: 'OWNER', status: 'ACTIVE' });
      if (ownerMember && String(ownerMember.user) !== user.id) {
        const owner = await userRepository.findById(String(ownerMember.user));
        if (owner) {
          await emailService.send(
            owner.email,
            emailTemplates.taskCompleted({ name: owner.firstName, business: business.businessName, task: task.title, completedBy: actorName, taskId }),
          );
        }
      }
    }
    await auditService.log(ctx, 'TASK_COMPLETED', 'ComplianceTask', taskId, { businessId });
    // Roll the window forward so the next period exists.
    await taskGenerationService.generateForBusiness(businessId).catch(() => undefined);
    return task;
  },

  /**
   * Appends an attributed note to a task for collaboration and traceability.
   */
  async addNote(taskId: string, body: string, user: Express.AuthUser, ctx: AuditContext) {
    const { task } = await loadWithAccess(taskId, user, 'tasks:update');
    task.notes.push({ body, author: user.id as any, createdAt: new Date() } as any);
    await task.save();
    await auditService.log(ctx, 'TASK_NOTE_ADDED', 'ComplianceTask', taskId, { businessId: String(task.businessId) });
    return task.populate({ path: 'notes.author', select: 'firstName lastName' });
  },

  /**
   * Checks business membership before assigning a task to a user.
   */
  async assign(taskId: string, assigneeId: string | null, user: Express.AuthUser, ctx: AuditContext) {
    const { task } = await loadWithAccess(taskId, user, 'tasks:update');
    if (assigneeId) {
      const target = await accessService.resolve({ id: assigneeId, email: '', role: 'OWNER' }, String(task.businessId));
      if (!target) throw ApiError.badRequest('That person is not a member of this business');
    }
    task.assignedTo = (assigneeId as any) ?? undefined;
    await task.save();
    await auditService.log(ctx, 'TASK_ASSIGNED', 'ComplianceTask', taskId, { businessId: String(task.businessId), metadata: { assigneeId } });
    return task;
  },
};
