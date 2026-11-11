/**
 * Module purpose: Separately handles Super Admin one-off emails and manual compliance reminders, verifies eligible recipients, records attempts, and audits outcomes.
 */
import { Types } from 'mongoose';
import { z } from 'zod';
import { manualEmailSchema } from '../validators';
import {
  businessRepository, emailLogRepository, memberRepository, requirementRepository,
  taskRepository, userRepository,
} from '../repositories';
import { ApiError } from '../utils/ApiError';
import { formatDate } from '../utils/dates';
import { manualEmailTemplate } from '../utils/emailTemplates';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { AuditContext, auditService } from './audit.service';
import { emailService } from './email.service';

export type ManualEmailInput = z.infer<typeof manualEmailSchema>;

const OUTSTANDING = { $nin: ['COMPLETED', 'NOT_APPLICABLE'] };

/**
 * Collects active businesses owned by or shared with a recipient. Only tasks in those businesses may be sent as manual reminders.
 */
async function eligibleBusinessIds(recipientId: string): Promise<string[]> {
  const [memberships, owned] = await Promise.all([
    memberRepository.find({ user: recipientId, status: 'ACTIVE' }),
    businessRepository.find({ owner: recipientId, businessStatus: { $ne: 'CLOSED' } }, { select: '_id' }),
  ]);
  const ids = [...new Set([...memberships.map((m) => String(m.business)), ...owned.map((b) => String(b._id))])];
  if (!ids.length) return [];
  const activeBusinesses = await businessRepository.find({ _id: { $in: ids }, businessStatus: { $ne: 'CLOSED' } }, { select: '_id' });
  return activeBusinesses.map((business) => String(business._id));
}

/**
 * Requires a current, active registered recipient with a valid email address before sending.
 */
async function recipientById(id: string) {
  const recipient = await userRepository.findById(id);
  if (!recipient || !recipient.isActive) throw ApiError.badRequest('Select an active registered user');
  if (!z.string().email().safeParse(recipient.email).success) throw ApiError.badRequest('Recipient has an invalid email address');
  return recipient;
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const manualEmailService = {
  /**
   * Returns outstanding tasks the chosen recipient can legitimately access for the reminder picker.
   */
  async obligations(recipientId: string, search?: string) {
    await recipientById(recipientId);
    const businesses = await eligibleBusinessIds(recipientId);
    if (!businesses.length) return [];
    const filter: Record<string, unknown> = { businessId: { $in: businesses }, status: OUTSTANDING };
    if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
    const tasks = await taskRepository.find(filter, { sort: { dueDate: 1 }, limit: 100 });
    const [businessesFound, requirements] = await Promise.all([
      businessRepository.find({ _id: { $in: tasks.map((t) => t.businessId) } }, { select: 'businessName' }),
      requirementRepository.find({ _id: { $in: tasks.map((t) => t.requirementId) } }, { select: 'description' }),
    ]);
    const businessNames = new Map(businessesFound.map((b) => [String(b._id), b.businessName]));
    const descriptions = new Map(requirements.map((r) => [String(r._id), r.description ?? '']));
    return tasks.map((task) => ({
      _id: String(task._id), title: task.title, businessName: businessNames.get(String(task.businessId)) ?? '',
      dueDate: task.dueDate, periodLabel: task.periodLabel ?? task.period,
      status: task.status, details: descriptions.get(String(task.requirementId)) ?? '',
    }));
  },

  /**
   * Validates the selected recipient and optional task, builds the message, claims an idempotent log entry, sends through SMTP, then records and audits the outcome.
   * @param input - Validated general email or manual reminder fields.
   * @param actorId - ID of the initiating Super Admin.
   * @param audit - Request context for the permanent audit entry.
   */
  async send(input: ManualEmailInput, actorId: string, audit: AuditContext) {
    const recipient = await recipientById(input.recipientId);
    let obligation: { name: string; business: string; dueDate: string; details: string; taskId: string } | undefined;
    let taskId: string | undefined;
    let dueDate: Date | undefined;

    // A manual reminder must reference an outstanding task the recipient is entitled to see.
    if (input.type === 'MANUAL_REMINDER') {
      const task = await taskRepository.findById(input.taskId!);
      if (!task || ['COMPLETED', 'NOT_APPLICABLE'].includes(task.status)) {
        throw ApiError.badRequest('Select an outstanding compliance obligation');
      }
      const business = await businessRepository.findById(String(task.businessId));
      const businessIds = await eligibleBusinessIds(input.recipientId);
      if (!business || business.businessStatus === 'CLOSED' || !businessIds.includes(String(task.businessId))) {
        throw ApiError.forbidden('The recipient is not associated with that obligation');
      }
      const requirement = await requirementRepository.findById(String(task.requirementId));
      taskId = String(task._id);
      dueDate = task.dueDate;
      obligation = {
        name: task.title,
        business: business.businessName,
        dueDate: formatDate(task.dueDate),
        details: [task.periodLabel ?? task.period, requirement?.description, `Status: ${task.status.replace(/_/g, ' ')}`]
          .filter(Boolean).join(' — ').slice(0, 1500),
        taskId,
      };
    }

    const message = manualEmailTemplate({
      subject: input.subject, message: input.message, format: input.format, obligation,
    });

    // Claim the unique request BEFORE SMTP. Even concurrent retry requests cannot
    // produce a second delivery. Do not retry an uncertain transport result.
    let attempt;
    try {
      attempt = await emailLogRepository.create({
        recipient: recipient._id, recipientName: `${recipient.firstName} ${recipient.lastName}`.trim(),
        recipientEmail: recipient.email, initiatedBy: new Types.ObjectId(actorId),
        subject: input.subject, message: input.message, format: input.format,
        type: input.type, requestId: input.requestId,
        ...(taskId ? { task: new Types.ObjectId(taskId), obligationName: obligation!.name,
          businessName: obligation!.business, dueDate, obligationDetails: obligation!.details } : {}),
        status: 'PENDING', attemptedAt: new Date(),
      });
    // A duplicate unique-index error means this request ID was already claimed, so do not attempt another SMTP send.
    } catch (err: any) {
      if (err?.code === 11000) throw ApiError.conflict('This email request was already submitted; check email history before retrying');
      throw err;
    }

    // The transport normally returns a structured result, but guard against an
    // unexpected exception so every claimed attempt reaches a final state.
    let outcome: Awaited<ReturnType<typeof emailService.sendDetailed>>;
    try {
      outcome = await emailService.sendDetailed(recipient.email, message, true);
    } catch {
      outcome = { sent: false, code: 'SMTP_ERROR' };
    }
    // Persist the transport outcome even when sending failed; history must include failed attempts.
    const updated = await emailLogRepository.updateById(String(attempt._id), {
      status: outcome.sent ? 'SENT' : 'FAILED',
      ...(outcome.sent ? { sentAt: new Date() } : { failureCode: outcome.code ?? 'SMTP_ERROR' }),
    });
    await auditService.log(audit, outcome.sent ? 'MANUAL_EMAIL_SENT' : 'MANUAL_EMAIL_FAILED', 'EmailLog',
      String(attempt._id), { metadata: { type: input.type, recipientId: input.recipientId, taskId } });
    if (!outcome.sent) {
      throw new ApiError(outcome.code === 'SMTP_NOT_CONFIGURED' ? 503 : 502,
        outcome.code === 'SMTP_NOT_CONFIGURED'
          ? 'SMTP is not configured. Set the server Gmail App Password before sending.'
          : 'The email was not accepted by SMTP. The failed attempt is saved in email history.');
    }
    return updated;
  },

  /**
   * Returns paginated manual email attempts while leaving large message bodies out of list results.
   */
  async history(query: Record<string, unknown>) {
    const q = parseListQuery(query, ['attemptedAt'], '-attemptedAt');
    const filter: Record<string, unknown> = {};
    if (typeof query.type === 'string') filter.type = query.type;
    if (typeof query.status === 'string') filter.status = query.status;
    const { items, total } = await emailLogRepository.paginate(filter, {
      sort: q.sort, skip: q.skip, limit: q.limit,
      select: '-message -obligationDetails',
      populate: { path: 'initiatedBy', select: 'firstName lastName email' },
    });
    return { items, meta: pageMeta(q.page, q.limit, total) };
  },

  /**
   * Returns a complete delivery-attempt record for the Super Admin detail dialog.
   */
  async get(id: string) {
    const item = await emailLogRepository.findById(id, {
      populate: { path: 'initiatedBy', select: 'firstName lastName email' },
    });
    if (!item) throw ApiError.notFound('Email record not found');
    return item;
  },
};
