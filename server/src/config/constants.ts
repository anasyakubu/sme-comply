/**
 * Module purpose: Defines shared role names, permissions, task statuses, regulatory frequencies, and reminder defaults used across the API.
 */
export const PLATFORM_ROLES = ['OWNER', 'ACCOUNTANT', 'COMPLIANCE_OFFICER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof PLATFORM_ROLES)[number];

/** Roles a user can hold inside a specific business. */
export const BUSINESS_ROLES = ['OWNER', 'ACCOUNTANT', 'COMPLIANCE_OFFICER'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const ADMIN_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];

export const BUSINESS_PERMISSIONS = [
  'business:view',
  'business:update',
  'members:manage',
  'tasks:view',
  'tasks:update',
  'tasks:mark_not_applicable',
  'filings:record',
  'documents:upload',
  'documents:delete',
  'reports:view',
  'reminders:manage',
] as const;
export type BusinessPermission = (typeof BUSINESS_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<BusinessRole, BusinessPermission[]> = {
  OWNER: [...BUSINESS_PERMISSIONS],
  ACCOUNTANT: [
    'business:view',
    'tasks:view',
    'tasks:update',
    'filings:record',
    'documents:upload',
    'reports:view',
  ],
  COMPLIANCE_OFFICER: [
    'business:view',
    'tasks:view',
    'tasks:update',
    'tasks:mark_not_applicable',
    'filings:record',
    'documents:upload',
    'documents:delete',
    'reports:view',
    'reminders:manage',
  ],
};

export const TASK_STATUSES = ['UPCOMING', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'NOT_APPLICABLE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const FREQUENCIES = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'BI_ANNUAL', 'ANNUAL', 'CUSTOM'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const REQUIREMENT_CATEGORIES = [
  'Corporate',
  'Tax',
  'Employment',
  'Pension',
  'Insurance',
  'Industry',
  'Licensing',
  'State',
  'Other',
] as const;

export const FILING_STATUSES = ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED'] as const;

export const DOCUMENT_TYPES = [
  'TAX_RECEIPT',
  'CERTIFICATE',
  'FILING_ACKNOWLEDGEMENT',
  'PAYMENT_EVIDENCE',
  'REGISTRATION_DOCUMENT',
  'LICENSE',
  'CORRESPONDENCE',
  'OTHER',
] as const;

export const DEFAULT_BUSINESS_TYPES = [
  'Sole Proprietorship',
  'Partnership',
  'Limited Liability Company',
  'Public Limited Company',
  'Non-Governmental Organization',
  'Other',
];

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
  'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

/** Days before the due date at which a task moves from UPCOMING to PENDING. */
export const PENDING_WINDOW_DAYS = 14;

export const DEFAULT_REMINDER_OFFSETS = [30, 14, 7, 3, 1, 0];

export const SAMPLE_DATA_NOTICE = 'Sample regulatory data — verify with the relevant authority.';
