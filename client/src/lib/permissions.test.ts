/**
 * Module purpose: Tests how platform and business roles map to permitted business actions.
 */
import { isAdmin, permissionsFor } from './permissions';

describe('permissionsFor', () => {
  it('gives owners everything', () => {
    expect(permissionsFor('OWNER')).toContain('members:manage');
  });

  it('keeps accountants away from team and not-applicable changes', () => {
    const p = permissionsFor('ACCOUNTANT');
    expect(p).toContain('filings:record');
    expect(p).not.toContain('members:manage');
    expect(p).not.toContain('tasks:mark_not_applicable');
  });

  it('lets compliance officers manage reminders', () => {
    expect(permissionsFor('COMPLIANCE_OFFICER')).toContain('reminders:manage');
  });

  it('gives platform admins read-only access and super admins full access', () => {
    expect(permissionsFor('PLATFORM_ADMIN', 'ADMIN')).toEqual(['business:view', 'tasks:view', 'reports:view']);
    expect(permissionsFor('PLATFORM_ADMIN', 'SUPER_ADMIN')).toContain('business:update');
    expect(permissionsFor(null)).toEqual([]);
  });

  it('recognises admin roles', () => {
    expect(isAdmin('ADMIN')).toBe(true);
    expect(isAdmin('SUPER_ADMIN')).toBe(true);
    expect(isAdmin('OWNER')).toBe(false);
  });
});
