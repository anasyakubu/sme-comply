/**
 * Module purpose: Shared frontend TypeScript contracts for API responses, users, businesses, tasks, filings, permissions, and manual email records.
 */
export type PlatformRole = 'OWNER' | 'ACCOUNTANT' | 'COMPLIANCE_OFFICER' | 'ADMIN' | 'SUPER_ADMIN';
export type BusinessRole = 'OWNER' | 'ACCOUNTANT' | 'COMPLIANCE_OFFICER';
export type TaskStatus = 'UPCOMING' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'NOT_APPLICABLE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Frequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'BI_ANNUAL' | 'ANNUAL' | 'CUSTOM';
export type Permission =
  | 'business:view' | 'business:update' | 'members:manage' | 'tasks:view' | 'tasks:update'
  | 'tasks:mark_not_applicable' | 'filings:record' | 'documents:upload' | 'documents:delete'
  | 'reports:view' | 'reminders:manage';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
  errors?: Array<{ path: string; message: string }>;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: PlatformRole;
  avatar?: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  businessCount?: number;
}

export interface Ref {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  businessName?: string;
  acronym?: string;
  name?: string;
  title?: string;
  periodLabel?: string;
  website?: string;
}

export interface BusinessFlags {
  cacRegistered?: boolean;
  taxRegistered?: boolean;
  vatRegistered?: boolean;
  pensionRegistered?: boolean;
  regulatedProducts?: boolean;
  importsExports?: boolean;
}

export interface ComplianceSummary {
  total: number;
  completed: number;
  overdue: number;
  open: number;
  percentage: number;
}

export interface Business {
  _id: string;
  businessName: string;
  legalName?: string;
  registrationNumber?: string;
  taxIdentificationNumber?: string;
  businessType: string;
  industry: string;
  state: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  dateOfIncorporation?: string;
  employeeCount: number;
  annualTurnover: number;
  businessStatus: 'ACTIVE' | 'DORMANT' | 'CLOSED';
  flags: BusinessFlags;
  owner: Ref | string;
  isDemo?: boolean;
  createdAt: string;
  myRole?: BusinessRole | 'PLATFORM_ADMIN' | null;
  myPermissions?: Permission[];
  compliance?: ComplianceSummary;
}

export interface Member {
  _id: string;
  user?: Ref | null;
  business: string;
  role: BusinessRole;
  status: 'INVITED' | 'ACTIVE' | 'REMOVED';
  invitedEmail?: string;
  invitedAt?: string;
  joinedAt?: string;
}

export interface Agency {
  _id: string;
  name: string;
  acronym: string;
  description?: string;
  level: 'FEDERAL' | 'STATE' | 'LOCAL';
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  active: boolean;
  isSampleData?: boolean;
  requirementCount?: number;
}

export interface RuleCondition {
  field: string;
  operator: string;
  value?: unknown;
}
export interface RuleGroup {
  match?: 'ALL' | 'ANY';
  conditions?: Array<RuleCondition | RuleGroup>;
}

export interface Requirement {
  _id: string;
  agencyId: Ref | string;
  name: string;
  code: string;
  description?: string;
  category: string;
  frequency: Frequency;
  customIntervalMonths?: number;
  dueRule: Record<string, unknown> & { type: string };
  applicabilityRules?: RuleGroup;
  requiredDocuments?: string[];
  penaltyInformation?: string;
  officialWebsite?: string;
  guidanceUrl?: string;
  active: boolean;
  isSampleData?: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

export interface TaskNote {
  _id: string;
  body: string;
  author?: Ref;
  createdAt: string;
}

export interface ComplianceTask {
  _id: string;
  businessId: Ref | string;
  requirementId: Requirement | string;
  agencyId?: Ref;
  title: string;
  category?: string;
  period: string;
  periodLabel?: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: Ref;
  completedAt?: string;
  completedBy?: Ref;
  notes: TaskNote[];
  generatedAutomatically: boolean;
}

export interface Filing {
  _id: string;
  taskId: Ref | string;
  businessId: Ref | string;
  filedBy?: Ref;
  filingDate: string;
  referenceNumber?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  notes?: string;
  submittedTo?: string;
  amountPaid?: number;
  documents?: Array<{ _id: string; fileName: string; cloudinaryUrl: string }>;
}

export interface DocumentFile {
  _id: string;
  taskId?: Ref;
  businessId: Ref | string;
  uploadedBy?: Ref;
  fileName: string;
  fileType: string;
  fileSize: number;
  cloudinaryUrl: string;
  documentType: string;
  description?: string;
  uploadedAt: string;
}

export interface AppNotification {
  _id: string;
  type: 'REMINDER' | 'DUE_TODAY' | 'OVERDUE' | 'TASK_COMPLETED' | 'FILING_RECORDED' | 'DOCUMENT_UPLOADED' | 'INVITATION' | 'SYSTEM';
  title: string;
  message: string;
  read: boolean;
  businessId?: Ref;
  userId?: Ref;
  relatedTaskId?: string;
  emailSent?: boolean;
  createdAt: string;
}

export interface ReminderSettings {
  daysBefore: number[];
  remindWhenOverdue: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

export interface LookupOptions {
  businessTypes: string[];
  industries: string[];
  states: string[];
  frequencies: Frequency[];
  categories: string[];
  documentTypes: string[];
  ruleFields: Array<{ field: string; label: string; kind: 'string' | 'number' | 'boolean' }>;
  ruleOperators: string[];
  dueRuleTypes: string[];
}

export interface AuditEntry {
  _id: string;
  user?: Ref;
  action: string;
  entity: string;
  entityId?: string;
  businessId?: Ref;
  metadata?: Record<string, unknown>;
  ip?: string;
  timestamp: string;
}

export interface EmailObligation {
  _id: string;
  title: string;
  businessName: string;
  dueDate: string;
  periodLabel: string;
  status: TaskStatus;
  details: string;
}

export interface ManualEmailLog {
  _id: string;
  recipient: string;
  recipientName: string;
  recipientEmail: string;
  initiatedBy: Ref | string;
  subject: string;
  message?: string;
  format: 'TEXT' | 'RICH_TEXT';
  type: 'GENERAL' | 'MANUAL_REMINDER';
  task?: string;
  obligationName?: string;
  businessName?: string;
  dueDate?: string;
  obligationDetails?: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attemptedAt: string;
  sentAt?: string;
  failureCode?: string;
}
