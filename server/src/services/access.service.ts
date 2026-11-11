/**
 * Module purpose: Determines which business records and operations are visible to each authenticated user.
 */
import { Types } from 'mongoose';
import { ADMIN_ROLES, BusinessPermission, BUSINESS_PERMISSIONS, ROLE_PERMISSIONS, BusinessRole } from '../config/constants';
import { memberRepository, businessRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';

type AuthUser = Express.AuthUser;
type Access = Express.BusinessAccess;

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const accessService = {
  /**
   * Determines whether the platform role grants administrative visibility.
   */
  isPlatformAdmin(user: AuthUser) {
    return ADMIN_ROLES.includes(user.role);
  },

  async resolve(user: AuthUser, businessId: string): Promise<Access | null> {
    if (!Types.ObjectId.isValid(businessId)) return null;
    if (this.isPlatformAdmin(user)) {
      const exists = await businessRepository.count({ _id: businessId });
      if (!exists) return null;
      // Platform admins can inspect everything; only SUPER_ADMIN may act on business data.
      const permissions: BusinessPermission[] =
        user.role === 'SUPER_ADMIN' ? [...BUSINESS_PERMISSIONS] : ['business:view', 'tasks:view', 'reports:view'];
      return { businessId, role: 'PLATFORM_ADMIN', permissions };
    }
    const member = await memberRepository.findOne({ business: businessId, user: user.id, status: 'ACTIVE' });
    if (!member) return null;
    const role = member.role as BusinessRole;
    const permissions = Array.from(new Set([...ROLE_PERMISSIONS[role], ...((member.permissions ?? []) as BusinessPermission[])]));
    return { businessId, role, permissions };
  },

  /** Throws 404 when the caller can't see the business (to avoid leaking existence) and 403 when they lack the permission. */
  async require(user: AuthUser, businessId: string, permission: BusinessPermission): Promise<Access> {
    const access = await this.resolve(user, String(businessId));
    if (!access) throw ApiError.notFound('Business not found');
    if (!access.permissions.includes(permission)) throw ApiError.forbidden();
    return access;
  },

  /** IDs of businesses the user can see. `null` means all (platform admin). */
  async visibleBusinessIds(user: AuthUser): Promise<string[] | null> {
    if (this.isPlatformAdmin(user)) return null;
    const members = await memberRepository.find({ user: user.id, status: 'ACTIVE' }, { select: 'business' });
    return members.map((m) => String(m.business));
  },
};
