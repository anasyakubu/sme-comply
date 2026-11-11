/**
 * Module purpose: Reads and updates account profiles and manages user records through authorized administrator operations.
 */
import { Types } from 'mongoose';
import { UserRole } from '../config/constants';
import { memberRepository, refreshTokenRepository, userRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { AuditContext, auditService } from './audit.service';

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const userService = {
  /**
   * Returns the signed-in user’s profile.
   */
  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    const memberships = await memberRepository.find(
      { user: userId, status: 'ACTIVE' },
      { populate: { path: 'business', select: 'businessName state businessStatus' } },
    );
    return { user, memberships };
  },

  /**
   * Validates and saves account profile fields.
   */
  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string; avatar?: string }, ctx: AuditContext) {
    const user = await userRepository.updateById(userId, data);
    await auditService.log(ctx, 'PROFILE_UPDATED', 'User', userId, { metadata: { fields: Object.keys(data) } });
    return user;
  },

  /**
   * Lists platform-wide records for the administrator view.
   */
  async adminList(query: Record<string, unknown>) {
    const q = parseListQuery(query, ['createdAt', 'lastLoginAt', 'email', 'firstName'], '-createdAt');
    const filter: Record<string, any> = {};
    if (typeof query.role === 'string' && query.role) filter.role = query.role;
    if (query.isActive === 'true') filter.isActive = true;
    if (query.isActive === 'false') filter.isActive = false;
    if (q.search) {
      const rx = { $regex: escapeRegex(q.search), $options: 'i' };
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
    }
    const { items, total } = await userRepository.paginate(filter, { sort: q.sort, skip: q.skip, limit: q.limit });
    const counts = await memberRepository.aggregate([
      { $match: { user: { $in: items.map((u) => u._id) }, status: 'ACTIVE' } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const map = new Map(counts.map((c: any) => [String(c._id), c.count]));
    return { items: items.map((u) => ({ ...u.toJSON(), businessCount: map.get(String(u._id)) ?? 0 })), meta: pageMeta(q.page, q.limit, total) };
  },

  /**
   * Loads a complete record for administrator inspection.
   */
  async adminGet(id: string) {
    if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('User not found');
    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound('User not found');
    const memberships = await memberRepository.find(
      { user: id, status: { $ne: 'REMOVED' } },
      { populate: { path: 'business', select: 'businessName state businessStatus' } },
    );
    return { user, memberships };
  },

  /**
   * Applies authorized administrator changes and records them for auditing.
   */
  async adminUpdate(actor: Express.AuthUser, id: string, data: { role?: UserRole; isActive?: boolean }, ctx: AuditContext) {
    const target = await userRepository.findById(id);
    if (!target) throw ApiError.notFound('User not found');
    if (id === actor.id) throw ApiError.badRequest("You can't change your own role or status");
    const touchesSuper = target.role === 'SUPER_ADMIN' || data.role === 'SUPER_ADMIN' || data.role === 'ADMIN';
    if (touchesSuper && actor.role !== 'SUPER_ADMIN') throw ApiError.forbidden('Only a super admin can grant or change admin roles');

    const previous = { role: target.role, isActive: target.isActive };
    if (data.role) target.role = data.role;
    if (data.isActive !== undefined) target.isActive = data.isActive;
    await target.save();
    if (data.isActive === false) await refreshTokenRepository.updateMany({ user: target._id }, { revokedAt: new Date() });

    if (data.role && data.role !== previous.role) {
      await auditService.log(ctx, 'ROLE_CHANGED', 'User', id, { metadata: { from: previous.role, to: data.role } });
    }
    if (data.isActive !== undefined && data.isActive !== previous.isActive) {
      await auditService.log(ctx, data.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'User', id);
    }
    return target;
  },
};
