/**
 * Module purpose: Records and manages compliance submissions with checks against the task and business involved.
 */
import { Types } from 'mongoose';
import { documentRepository, filingRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { accessService } from './access.service';
import { AuditContext, auditService } from './audit.service';
import { notificationService } from './notification.service';
import { taskService } from './task.service';

export interface FilingInput {
  taskId: string;
  filingDate: string | Date;
  referenceNumber?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  notes?: string;
  submittedTo?: string;
  amountPaid?: number;
  documents?: string[];
  markTaskCompleted?: boolean;
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const filingService = {
  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(input: FilingInput, user: Express.AuthUser, ctx: AuditContext) {
    const { task } = await taskService.loadWithAccess(input.taskId, user, 'filings:record');
    const businessId = String(task.businessId);
    if (input.documents?.length) {
      const count = await documentRepository.count({ _id: { $in: input.documents }, businessId });
      if (count !== input.documents.length) throw ApiError.badRequest('One or more documents do not belong to this business');
    }
    const filing = await filingRepository.create({
      taskId: task._id,
      businessId: task.businessId,
      filedBy: user.id as any,
      filingDate: new Date(input.filingDate),
      referenceNumber: input.referenceNumber,
      status: input.status ?? 'SUBMITTED',
      notes: input.notes,
      submittedTo: input.submittedTo,
      amountPaid: input.amountPaid,
      documents: (input.documents ?? []) as any,
    });
    // NOTE: `FilingRecord.status` is currently typed as `unknown` on the create() result
    // (should be a string union). Normalize it locally so subsequent uses are well-typed.
    const filingStatus = (filing.status as string | undefined) ?? 'SUBMITTED';
    if (input.documents?.length) {
      await documentRepository.updateMany({ _id: { $in: input.documents } }, { filingId: filing._id, taskId: task._id });
    }
    await auditService.log(ctx, 'FILING_RECORDED', 'FilingRecord', String(filing._id), {
      businessId,
      metadata: { taskId: input.taskId, status: filingStatus, referenceNumber: filing.referenceNumber },
    });
    await notificationService.notifyBusiness(
      businessId,
      { type: 'FILING_RECORDED', title: `Filing recorded: ${task.title}`, message: `${task.periodLabel ?? task.period} — ${filingStatus.toLowerCase()}.`, relatedTaskId: input.taskId },
      user.id,
    );
    const shouldComplete = input.markTaskCompleted ?? ['SUBMITTED', 'ACCEPTED'].includes(filingStatus);
    if (shouldComplete && task.status !== 'COMPLETED') await taskService.complete(input.taskId, user, ctx);
    return filing;
  },

  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(user: Express.AuthUser, query: Record<string, unknown>) {
    const q = parseListQuery(query, ['filingDate', 'createdAt', 'status'], '-filingDate');
    const filter: Record<string, any> = {};
    const visible = await accessService.visibleBusinessIds(user);
    if (typeof query.businessId === 'string' && query.businessId) {
      if (visible && !visible.includes(query.businessId)) throw ApiError.notFound('Business not found');
      filter.businessId = new Types.ObjectId(query.businessId);
    } else if (visible) {
      filter.businessId = { $in: visible.map((id) => new Types.ObjectId(id)) };
    }
    if (typeof query.taskId === 'string' && Types.ObjectId.isValid(query.taskId)) filter.taskId = query.taskId;
    if (typeof query.status === 'string' && query.status) filter.status = query.status;
    if (q.search) filter.referenceNumber = { $regex: escapeRegex(q.search), $options: 'i' };
    const { items, total } = await filingRepository.paginate(filter, {
      sort: q.sort,
      skip: q.skip,
      limit: q.limit,
      populate: [
        { path: 'taskId', select: 'title periodLabel dueDate status' },
        { path: 'businessId', select: 'businessName' },
        { path: 'filedBy', select: 'firstName lastName' },
      ],
    });
    return { items, meta: pageMeta(q.page, q.limit, total) };
  },

  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(id: string, data: Partial<FilingInput>, user: Express.AuthUser, ctx: AuditContext) {
    const filing = await filingRepository.findById(id);
    if (!filing) throw ApiError.notFound('Filing not found');
    await accessService.require(user, String(filing.businessId), 'filings:record');
    if (data.filingDate) filing.filingDate = new Date(data.filingDate);
    for (const k of ['referenceNumber', 'status', 'notes', 'submittedTo', 'amountPaid'] as const) {
      if (data[k] !== undefined) (filing as any)[k] = data[k];
    }
    await filing.save();
    await auditService.log(ctx, 'FILING_UPDATED', 'FilingRecord', id, { businessId: String(filing.businessId), metadata: { status: filing.status } });
    return filing;
  },

  /**
   * Checks access and removes the requested entry.
   */
  async remove(id: string, user: Express.AuthUser, ctx: AuditContext) {
    const filing = await filingRepository.findById(id);
    if (!filing) throw ApiError.notFound('Filing not found');
    await accessService.require(user, String(filing.businessId), 'documents:delete');
    await filing.deleteOne();
    await auditService.log(ctx, 'FILING_DELETED', 'FilingRecord', id, { businessId: String(filing.businessId) });
  },
};