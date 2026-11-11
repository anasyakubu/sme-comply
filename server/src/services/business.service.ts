/**
 * Module purpose: Implements business creation, updates, membership management, closing, and task regeneration with access checks.
 */
import { Types } from 'mongoose';
import { BusinessRole } from '../config/constants';
import { businessRepository, memberRepository, taskRepository, userRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { randomToken, sha256 } from '../utils/crypto';
import { emailTemplates } from '../utils/emailTemplates';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { AuditContext, auditService } from './audit.service';
import { accessService } from './access.service';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
import { reminderService } from './reminder.service';
import { taskGenerationService } from './taskGeneration.service';

/** Fields that change which requirements apply. Editing any of them regenerates tasks. */
const APPLICABILITY_FIELDS = [
  'businessType',
  'industry',
  'state',
  'employeeCount',
  'annualTurnover',
  'businessStatus',
  'dateOfIncorporation',
  'flags',
];

/**
 * Aggregates task counts by business and status in MongoDB instead of issuing a query for every business.
 */
async function complianceSummary(businessIds: Types.ObjectId[]) {
  if (businessIds.length === 0) return new Map<string, any>();
  const rows = await taskRepository.aggregate([
    { $match: { businessId: { $in: businessIds }, status: { $ne: 'NOT_APPLICABLE' } } },
    { $group: { _id: { b: '$businessId', s: '$status' }, count: { $sum: 1 } } },
  ]);
  const map = new Map<string, any>();
  for (const r of rows) {
    const key = String(r._id.b);
    const entry = map.get(key) ?? { total: 0, completed: 0, overdue: 0, open: 0 };
    entry.total += r.count;
    if (r._id.s === 'COMPLETED') entry.completed += r.count;
    else if (r._id.s === 'OVERDUE') entry.overdue += r.count;
    else entry.open += r.count;
    map.set(key, entry);
  }
  return map;
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const businessService = {
  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(userId: string, data: Record<string, any>, ctx: AuditContext) {
    const business = await businessRepository.create({ ...data, owner: userId as any });
    await memberRepository.create({
      user: userId as any,
      business: business._id,
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });
    await reminderService.getSettings(String(business._id));
    const generation = await taskGenerationService.generateForBusiness(String(business._id));
    await auditService.log(ctx, 'BUSINESS_CREATED', 'Business', String(business._id), {
      businessId: String(business._id),
      metadata: { name: business.businessName, tasksCreated: generation.created },
    });
    return { business, generation };
  },

  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(user: Express.AuthUser, query: Record<string, unknown>) {
    const q = parseListQuery(query, ['businessName', 'createdAt', 'state', 'employeeCount'], 'businessName');
    const visible = await accessService.visibleBusinessIds(user);
    const filter: Record<string, unknown> = {};
    if (visible) filter._id = { $in: visible.map((id) => new Types.ObjectId(id)) };
    if (q.search) {
      const rx = { $regex: escapeRegex(q.search), $options: 'i' };
      filter.$or = [{ businessName: rx }, { legalName: rx }, { registrationNumber: rx }];
    }
    for (const f of ['state', 'businessType', 'industry', 'businessStatus']) {
      if (typeof query[f] === 'string' && query[f]) filter[f] = query[f];
    }
    const { items, total } = await businessRepository.paginate(filter, {
      sort: q.sort,
      skip: q.skip,
      limit: q.limit,
      populate: { path: 'owner', select: 'firstName lastName email' },
    });

    // Merge aggregate compliance counts with the current page of businesses for the dashboard list.
    const summary = await complianceSummary(items.map((b) => b._id as Types.ObjectId));
    const memberships = visible
      ? await memberRepository.find({ user: user.id, business: { $in: items.map((b) => b._id) }, status: 'ACTIVE' })
      : [];
    const roleByBusiness = new Map(memberships.map((m) => [String(m.business), m.role]));

    const data = items.map((b) => {
      const s = summary.get(String(b._id)) ?? { total: 0, completed: 0, overdue: 0, open: 0 };
      return {
        ...b.toJSON(),
        myRole: roleByBusiness.get(String(b._id)) ?? (visible ? null : 'PLATFORM_ADMIN'),
        compliance: { ...s, percentage: complianceRate(s.completed, s.overdue) },
      };
    });
    return { items: data, meta: pageMeta(q.page, q.limit, total) };
  },

  /**
   * Loads the requested record and returns it or reports that it cannot be found.
   */
  async get(businessId: string, access: Express.BusinessAccess) {
    const business = await businessRepository.findById(businessId, {
      populate: { path: 'owner', select: 'firstName lastName email' },
    });
    if (!business) throw ApiError.notFound('Business not found');
    const s = (await complianceSummary([business._id as Types.ObjectId])).get(businessId) ?? { total: 0, completed: 0, overdue: 0, open: 0 };
    return {
      ...business.toJSON(),
      myRole: access.role,
      myPermissions: access.permissions,
      compliance: { ...s, percentage: complianceRate(s.completed, s.overdue) },
    };
  },

  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(businessId: string, data: Record<string, any>, ctx: AuditContext) {
    const before = await businessRepository.findById(businessId);
    if (!before) throw ApiError.notFound('Business not found');
    const changed = APPLICABILITY_FIELDS.filter((f) => f in data && JSON.stringify((before as any)[f]) !== JSON.stringify(data[f]));
    if (data.flags) data.flags = { ...(before.toObject().flags ?? {}), ...data.flags };
    const business = await businessRepository.updateById(businessId, data);
    const generation = changed.length ? await taskGenerationService.generateForBusiness(businessId) : null;
    await auditService.log(ctx, 'BUSINESS_UPDATED', 'Business', businessId, {
      businessId,
      metadata: { fields: Object.keys(data), regenerated: Boolean(generation) },
    });
    return { business, generation };
  },

  /**
   * Requests compliance task regeneration after relevant business changes.
   */
  async regenerate(businessId: string, ctx: AuditContext) {
    const generation = await taskGenerationService.generateForBusiness(businessId);
    await auditService.log(ctx, 'TASKS_REGENERATED', 'Business', businessId, { businessId, metadata: { ...generation } });
    return generation;
  },

  /**
   * Closes the selected business and prevents further open-business operations.
   */
  async close(businessId: string, ctx: AuditContext) {
    const business = await businessRepository.updateById(businessId, { businessStatus: 'CLOSED' });
    await taskRepository.updateMany(
      { businessId, status: { $in: ['UPCOMING', 'PENDING'] } },
      { $set: { status: 'NOT_APPLICABLE' } },
    );
    await auditService.log(ctx, 'BUSINESS_CLOSED', 'Business', businessId, { businessId });
    return business;
  },

  // ---------- Members ----------

  async listMembers(businessId: string) {
    return memberRepository.find(
      { business: businessId, status: { $ne: 'REMOVED' } },
      { populate: { path: 'user', select: 'firstName lastName email phone avatar' }, sort: { createdAt: 1 } },
    );
  },

  /**
   * Invites a user to join a business with a defined membership role.
   */
  async invite(businessId: string, email: string, role: BusinessRole, inviter: Express.AuthUser, ctx: AuditContext) {
    if (role === 'OWNER') throw ApiError.badRequest('A business has a single owner. Invite as accountant or compliance officer.');
    const normalized = email.toLowerCase();
    const business = await businessRepository.findById(businessId);
    if (!business) throw ApiError.notFound('Business not found');
    const inviterUser = await userRepository.findById(inviter.id);
    const inviterName = inviterUser ? `${inviterUser.firstName} ${inviterUser.lastName}` : 'A colleague';
    const existingUser = await userRepository.findOne({ email: normalized });

    const duplicate = await memberRepository.findOne({
      business: businessId,
      status: { $in: ['ACTIVE', 'INVITED'] },
      $or: [{ invitedEmail: normalized }, ...(existingUser ? [{ user: existingUser._id }] : [])],
    });
    if (duplicate) throw ApiError.conflict('This person is already a member or has a pending invitation');

    let member;
    if (existingUser) {
      const removed = await memberRepository.findOne({ business: businessId, user: existingUser._id });
      member = removed
        ? await memberRepository.updateById(String(removed._id), { status: 'ACTIVE', role, joinedAt: new Date(), invitedBy: inviter.id })
        : await memberRepository.create({
            user: existingUser._id,
            business: business._id,
            role,
            status: 'ACTIVE',
            invitedEmail: normalized,
            invitedBy: inviter.id as any,
            invitedAt: new Date(),
            joinedAt: new Date(),
          });
      await notificationService.create({
        userId: String(existingUser._id),
        businessId,
        type: 'INVITATION',
        title: `You were added to ${business.businessName}`,
        message: `${inviterName} added you as ${role.replace('_', ' ').toLowerCase()}.`,
      });
      await emailService.send(normalized, emailTemplates.invitation({ business: business.businessName, inviter: inviterName, role }));
    } else {
      const token = randomToken();
      member = await memberRepository.create({
        business: business._id,
        role,
        status: 'INVITED',
        invitedEmail: normalized,
        inviteTokenHash: sha256(token),
        inviteExpires: new Date(Date.now() + 14 * 86_400_000),
        invitedBy: inviter.id as any,
        invitedAt: new Date(),
      });
      await emailService.send(normalized, emailTemplates.invitation({ business: business.businessName, inviter: inviterName, role, token }));
    }
    await auditService.log(ctx, 'USER_INVITED', 'BusinessMember', String(member?._id), {
      businessId,
      metadata: { email: normalized, role, existingUser: Boolean(existingUser) },
    });
    return member;
  },

  /**
   * Changes a member’s role or invitation state under the business permission rules.
   */
  async updateMember(businessId: string, memberId: string, data: { role?: BusinessRole; permissions?: string[] }, ctx: AuditContext) {
    const member = await memberRepository.findOne({ _id: memberId, business: businessId });
    if (!member) throw ApiError.notFound('Member not found');
    if (member.role === 'OWNER') throw ApiError.badRequest("The owner's role can't be changed");
    if (data.role === 'OWNER') throw ApiError.badRequest('A business has a single owner');
    const previous = member.role;
    if (data.role) member.role = data.role;
    if (data.permissions) member.permissions = data.permissions as any;
    await member.save();
    await auditService.log(ctx, 'ROLE_CHANGED', 'BusinessMember', memberId, {
      businessId,
      metadata: { from: previous, to: member.role },
    });
    return member;
  },

  /**
   * Revokes a user’s access to the selected business.
   */
  async removeMember(businessId: string, memberId: string, ctx: AuditContext) {
    const member = await memberRepository.findOne({ _id: memberId, business: businessId });
    if (!member) throw ApiError.notFound('Member not found');
    if (member.role === 'OWNER') throw ApiError.badRequest("The owner can't be removed");
    member.status = 'REMOVED';
    await member.save();
    await auditService.log(ctx, 'MEMBER_REMOVED', 'BusinessMember', memberId, { businessId });
  },
};

/** Completed ÷ (completed + overdue): the share of obligations that have come due and been met. */
export function complianceRate(completed: number, overdue: number): number {
  const due = completed + overdue;
  return due === 0 ? 100 : Math.round((completed / due) * 100);
}
