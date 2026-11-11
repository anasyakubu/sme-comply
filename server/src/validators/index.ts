/**
 * Module purpose: Defines Zod schemas shared by route validators for user inputs, business changes, filings, requirements, and manual email requests.
 */
import { z } from 'zod';
import {
  BUSINESS_PERMISSIONS,
  DOCUMENT_TYPES,
  FILING_STATUSES,
  FREQUENCIES,
  PLATFORM_ROLES,
  REQUIREMENT_CATEGORIES,
  TASK_STATUSES,
} from '../config/constants';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalText = (max = 200) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));
const optionalUrl = z
  .string()
  .trim()
  .url('Enter a full URL starting with https://')
  .optional()
  .or(z.literal('').transform(() => undefined));
const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const idParam = z.object({ id: objectId });

// ---------- Auth ----------
export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name').max(60),
  lastName: z.string().trim().min(1, 'Enter your last name').max(60),
  email: z.string().trim().email('Enter a valid email address'),
  phone: optionalText(20),
  password,
});
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
export const forgotSchema = z.object({ email: z.string().trim().email() });
export const resetSchema = z.object({ token: z.string().min(10), password });
export const verifySchema = z.object({ token: z.string().min(10) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });
export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: optionalText(20),
  avatar: optionalUrl,
});

// ---------- Business ----------
const flags = z
  .object({
    cacRegistered: z.boolean(),
    taxRegistered: z.boolean(),
    vatRegistered: z.boolean(),
    pensionRegistered: z.boolean(),
    regulatedProducts: z.boolean(),
    importsExports: z.boolean(),
  })
  .partial();

// Create and update operations reuse the same business field rules to avoid inconsistent validation.
const businessBase = {
  businessName: z.string().trim().min(2, 'Enter the business name').max(150),
  legalName: optionalText(200),
  registrationNumber: optionalText(40),
  taxIdentificationNumber: optionalText(40),
  businessType: z.string().trim().min(1, 'Choose a business type'),
  industry: z.string().trim().min(1, 'Enter the industry').max(80),
  state: z.string().trim().min(1, 'Choose a state'),
  city: optionalText(80),
  address: optionalText(250),
  phone: optionalText(20),
  email: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)),
  website: optionalUrl,
  dateOfIncorporation: z.coerce.date().max(new Date(Date.now() + 86_400_000), 'Date cannot be in the future').optional().or(z.literal('').transform(() => undefined)),
  employeeCount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  annualTurnover: z.coerce.number().min(0).optional(),
  businessStatus: z.enum(['ACTIVE', 'DORMANT', 'CLOSED']).optional(),
  flags: flags.optional(),
};
export const createBusinessSchema = z.object(businessBase);
export const updateBusinessSchema = z.object(businessBase).partial();

export const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['ACCOUNTANT', 'COMPLIANCE_OFFICER']),
});
export const updateMemberSchema = z.object({
  role: z.enum(['ACCOUNTANT', 'COMPLIANCE_OFFICER']).optional(),
  permissions: z.array(z.enum(BUSINESS_PERMISSIONS)).optional(),
});
// These settings affect automatic reminders, not the independent manual email sending endpoint.
export const reminderSettingsSchema = z.object({
  daysBefore: z.array(z.number().int().min(0).max(90)).min(1).max(10).optional(),
  remindWhenOverdue: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
});

// ---------- Agencies & requirements ----------
const agencyBase = {
  name: z.string().trim().min(2).max(150),
  acronym: z.string().trim().min(2).max(15),
  description: optionalText(1000),
  level: z.enum(['FEDERAL', 'STATE', 'LOCAL']).optional(),
  website: optionalUrl,
  contactEmail: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)),
  contactPhone: optionalText(30),
  active: z.boolean().optional(),
};
export const createAgencySchema = z.object(agencyBase);
export const updateAgencySchema = z.object(agencyBase).partial();

const requirementBase = {
  agencyId: objectId,
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dashes and underscores'),
  description: optionalText(3000),
  category: z.enum(REQUIREMENT_CATEGORIES),
  frequency: z.enum(FREQUENCIES),
  customIntervalMonths: z.number().int().min(1).max(12).optional(),
  dueRule: z.record(z.any()),
  applicabilityRules: z.record(z.any()).optional(),
  requiredDocuments: z.array(z.string().trim().min(1).max(150)).max(30).optional(),
  penaltyInformation: optionalText(3000),
  officialWebsite: optionalUrl,
  guidanceUrl: optionalUrl,
  active: z.boolean().optional(),
  effectiveFrom: z.coerce.date().optional().nullable(),
  effectiveUntil: z.coerce.date().optional().nullable(),
};
export const createRequirementSchema = z.object(requirementBase);
export const updateRequirementSchema = z.object(requirementBase).partial();
export const previewRulesSchema = z.object({ applicabilityRules: z.record(z.any()) });

// ---------- Tasks, filings, documents ----------
export const taskStatusSchema = z.object({ status: z.enum(TASK_STATUSES) });
export const completeTaskSchema = z.object({ note: z.string().trim().max(2000).optional() });
export const noteSchema = z.object({ body: z.string().trim().min(1, 'Write a note').max(2000) });
export const assignSchema = z.object({ assigneeId: objectId.nullable() });

export const createFilingSchema = z.object({
  taskId: objectId,
  filingDate: z.coerce.date(),
  referenceNumber: optionalText(100),
  status: z.enum(FILING_STATUSES).optional(),
  notes: optionalText(2000),
  submittedTo: optionalText(150),
  amountPaid: z.coerce.number().min(0).optional(),
  documents: z.array(objectId).max(20).optional(),
  markTaskCompleted: z.boolean().optional(),
});
export const updateFilingSchema = createFilingSchema.omit({ taskId: true, documents: true, markTaskCompleted: true }).partial();

export const uploadDocumentSchema = z.object({
  businessId: objectId,
  taskId: objectId.optional().or(z.literal('').transform(() => undefined)),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  description: optionalText(500),
});

// ---------- Reports ----------
export const reportQuerySchema = z
  .object({
    businessId: objectId,
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((v) => v.from <= v.to, { message: '"From" must be before "To"', path: ['from'] });

// ---------- Admin ----------
export const adminUpdateUserSchema = z.object({
  role: z.enum(PLATFORM_ROLES).optional(),
  isActive: z.boolean().optional(),
});
export const lookupSchema = z.object({
  kind: z.enum(['BUSINESS_TYPE', 'INDUSTRY']),
  value: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().optional(),
});
export const updateLookupSchema = z.object({
  value: z.string().trim().min(1).max(80).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ---------- Super Admin manual communication ----------
export const manualEmailSchema = z.object({
  recipientId: objectId,
  requestId: z.string().uuid(),
  type: z.enum(['GENERAL', 'MANUAL_REMINDER']),
  taskId: objectId.optional(),
  subject: z.string().trim().min(1, 'Enter a subject').max(200)
    .refine((value) => !/[\r\n]/.test(value), 'Subject must be one line'),
  message: z.string().trim().min(1, 'Enter a message').max(20000),
  format: z.enum(['TEXT', 'RICH_TEXT']).default('TEXT'),
}).superRefine((data, ctx) => {
  if (data.type === 'MANUAL_REMINDER' && !data.taskId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['taskId'], message: 'Select an obligation' });
  }
  if (data.type === 'GENERAL' && data.taskId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['taskId'], message: 'General emails cannot refer to an obligation' });
  }
});
export const manualEmailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(['GENERAL', 'MANUAL_REMINDER']).optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
});
export const emailObligationsQuerySchema = z.object({
  recipientId: objectId,
  search: z.string().trim().max(100).optional(),
});
