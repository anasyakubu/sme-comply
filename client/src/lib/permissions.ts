/**
 * Module purpose: Mirrors business permissions for showing permitted UI actions. Backend middleware still makes the final authorization decision.
 */
import type { BusinessRole, Permission, PlatformRole } from '../types';

/** Mirrors the server's ROLE_PERMISSIONS; the server remains the source of truth. */
const ALL: Permission[] = [
  'business:view', 'business:update', 'members:manage', 'tasks:view', 'tasks:update', 'tasks:mark_not_applicable',
  'filings:record', 'documents:upload', 'documents:delete', 'reports:view', 'reminders:manage',
];

export const ROLE_PERMISSIONS: Record<BusinessRole, Permission[]> = {
  OWNER: ALL,
  ACCOUNTANT: ['business:view', 'tasks:view', 'tasks:update', 'filings:record', 'documents:upload', 'reports:view'],
  COMPLIANCE_OFFICER: [
    'business:view', 'tasks:view', 'tasks:update', 'tasks:mark_not_applicable', 'filings:record',
    'documents:upload', 'documents:delete', 'reports:view', 'reminders:manage',
  ],
};

/**
 * Returns allowed business actions based on the user’s business membership and platform role.
 */
export function permissionsFor(role: BusinessRole | 'PLATFORM_ADMIN' | null | undefined, platformRole?: PlatformRole): Permission[] {
  if (role === 'PLATFORM_ADMIN' || (!role && platformRole && ['ADMIN', 'SUPER_ADMIN'].includes(platformRole))) {
    return platformRole === 'SUPER_ADMIN' ? ALL : ['business:view', 'tasks:view', 'reports:view'];
  }
  return role ? ROLE_PERMISSIONS[role] : [];
}

export const isAdmin = (role?: PlatformRole) => role === 'ADMIN' || role === 'SUPER_ADMIN';
