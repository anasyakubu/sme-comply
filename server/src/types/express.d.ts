/**
 * Module purpose: Extends Express request types with the authenticated user added by the authentication middleware.
 */
import { BusinessPermission, BusinessRole, UserRole } from '../config/constants';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      role: UserRole;
    }
    interface BusinessAccess {
      businessId: string;
      role: BusinessRole | 'PLATFORM_ADMIN';
      permissions: BusinessPermission[];
    }
    interface Request {
      user?: AuthUser;
      access?: BusinessAccess;
    }
  }
}

export {};
