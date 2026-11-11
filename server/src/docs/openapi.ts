/**
 * Module purpose: Describes API endpoints and payload schemas for generated Swagger/OpenAPI documentation.
 */
/**
 * OpenAPI 3 description of the SME Comply API, served at /api-docs.
 * Kept in code (rather than JSDoc comments) so it is type-checked and easy to review.
 */
type Op = {
  summary: string;
  tag: string;
  auth?: boolean;
  body?: string;
  query?: string[];
  params?: string[];
  admin?: boolean;
  multipart?: boolean;
  produces?: string;
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

function operation(op: Op) {
  const parameters = [
    ...(op.params ?? []).map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
    ...(op.query ?? []).map((name) => ({ name, in: 'query', required: false, schema: { type: 'string' } })),
  ];
  return {
    tags: [op.tag],
    summary: op.summary + (op.admin ? ' (admin)' : ''),
    ...(op.auth === false ? { security: [] } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(op.body
      ? { requestBody: { required: true, content: { 'application/json': { schema: ref(op.body) } } } }
      : op.multipart
        ? {
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    required: ['file', 'businessId'],
                    properties: {
                      file: { type: 'string', format: 'binary' },
                      businessId: { type: 'string' },
                      taskId: { type: 'string' },
                      documentType: { type: 'string' },
                      description: { type: 'string' },
                    },
                  },
                },
              },
            },
          }
        : {}),
    responses: {
      200: {
        description: 'Success',
        content: op.produces ? { [op.produces]: {} } : { 'application/json': { schema: ref('Success') } },
      },
      400: { description: 'Validation failed', content: { 'application/json': { schema: ref('Error') } } },
      401: { description: 'Not signed in' },
      403: { description: 'Not permitted' },
      404: { description: 'Not found' },
    },
  };
}

const list = ['page', 'limit', 'sort', 'search'];

const paths: Record<string, Record<string, Op>> = {
  '/auth/register': { post: { tag: 'Auth', summary: 'Create an account', auth: false, body: 'Register' } },
  '/auth/login': { post: { tag: 'Auth', summary: 'Sign in (sets refresh cookie)', auth: false, body: 'Login' } },
  '/auth/refresh': { post: { tag: 'Auth', summary: 'Rotate refresh cookie and get a new access token', auth: false } },
  '/auth/logout': { post: { tag: 'Auth', summary: 'Sign out and revoke session', auth: false } },
  '/auth/forgot-password': { post: { tag: 'Auth', summary: 'Email a password reset link', auth: false, body: 'Email' } },
  '/auth/reset-password': { post: { tag: 'Auth', summary: 'Reset password with token', auth: false, body: 'ResetPassword' } },
  '/auth/verify-email': { post: { tag: 'Auth', summary: 'Confirm email address', auth: false, body: 'Token' } },
  '/auth/me': { get: { tag: 'Auth', summary: 'Current user and memberships' } },
  '/users/me': {
    get: { tag: 'Users', summary: 'Current user profile' },
    patch: { tag: 'Users', summary: 'Update profile', body: 'Profile' },
  },
  '/users/me/password': { post: { tag: 'Users', summary: 'Change password', body: 'ChangePassword' } },
  '/lookups/options': { get: { tag: 'Lookups', summary: 'Dropdown options, rule fields and operators' } },
  '/businesses': {
    get: { tag: 'Businesses', summary: 'Businesses I can access', query: [...list, 'state', 'businessType'] },
    post: { tag: 'Businesses', summary: 'Create a business and generate its obligations', body: 'Business' },
  },
  '/businesses/{id}': {
    get: { tag: 'Businesses', summary: 'Business details', params: ['id'] },
    patch: { tag: 'Businesses', summary: 'Update business (regenerates tasks if applicability fields change)', params: ['id'], body: 'Business' },
  },
  '/businesses/{id}/close': { post: { tag: 'Businesses', summary: 'Close business', params: ['id'] } },
  '/businesses/{id}/regenerate-tasks': { post: { tag: 'Businesses', summary: 'Re-evaluate requirements and generate tasks', params: ['id'] } },
  '/businesses/{id}/dashboard': { get: { tag: 'Businesses', summary: 'Dashboard statistics', params: ['id'] } },
  '/businesses/{id}/members': {
    get: { tag: 'Business members', summary: 'List members', params: ['id'] },
    post: { tag: 'Business members', summary: 'Invite a member', params: ['id'], body: 'Invite' },
  },
  '/businesses/{id}/members/{memberId}': {
    patch: { tag: 'Business members', summary: 'Change member role', params: ['id', 'memberId'], body: 'Invite' },
    delete: { tag: 'Business members', summary: 'Remove member', params: ['id', 'memberId'] },
  },
  '/business-members/{businessId}': { get: { tag: 'Business members', summary: 'List members (alias)', params: ['businessId'] } },
  '/businesses/{id}/reminder-settings': {
    get: { tag: 'Reminders', summary: 'Reminder settings', params: ['id'] },
    put: { tag: 'Reminders', summary: 'Update reminder settings', params: ['id'], body: 'ReminderSettings' },
  },
  '/agencies': {
    get: { tag: 'Agencies', summary: 'List agencies', query: [...list, 'active', 'level'] },
    post: { tag: 'Agencies', summary: 'Create agency', body: 'Agency', admin: true },
  },
  '/agencies/{id}': {
    get: { tag: 'Agencies', summary: 'Agency details', params: ['id'] },
    patch: { tag: 'Agencies', summary: 'Update or deactivate agency', params: ['id'], body: 'Agency', admin: true },
  },
  '/requirements': {
    get: { tag: 'Requirements', summary: 'List requirements', query: [...list, 'category', 'frequency', 'agencyId', 'active'] },
    post: { tag: 'Requirements', summary: 'Create requirement', body: 'Requirement', admin: true },
  },
  '/requirements/preview': { post: { tag: 'Requirements', summary: 'Preview which businesses rules match', body: 'RulesPreview', admin: true } },
  '/requirements/{id}': {
    get: { tag: 'Requirements', summary: 'Requirement details', params: ['id'] },
    patch: { tag: 'Requirements', summary: 'Update or deactivate requirement', params: ['id'], body: 'Requirement', admin: true },
  },
  '/compliance-tasks': {
    get: {
      tag: 'Compliance tasks',
      summary: 'List tasks',
      query: [...list, 'businessId', 'status', 'priority', 'category', 'agencyId', 'from', 'to'],
    },
  },
  '/compliance-tasks/calendar': { get: { tag: 'Compliance tasks', summary: 'Tasks for calendar', query: ['businessId', 'from', 'to', 'status', 'agencyId'] } },
  '/compliance-tasks/{id}': { get: { tag: 'Compliance tasks', summary: 'Task with requirement, filings and documents', params: ['id'] } },
  '/compliance-tasks/{id}/status': { patch: { tag: 'Compliance tasks', summary: 'Change status', params: ['id'], body: 'TaskStatus' } },
  '/compliance-tasks/{id}/complete': { post: { tag: 'Compliance tasks', summary: 'Mark as completed', params: ['id'], body: 'Note' } },
  '/compliance-tasks/{id}/notes': { post: { tag: 'Compliance tasks', summary: 'Add note', params: ['id'], body: 'Note' } },
  '/filings': {
    get: { tag: 'Filings', summary: 'List filing records', query: [...list, 'businessId', 'taskId', 'status'] },
    post: { tag: 'Filings', summary: 'Record a filing', body: 'Filing' },
  },
  '/filings/{id}': {
    patch: { tag: 'Filings', summary: 'Update filing', params: ['id'], body: 'Filing' },
    delete: { tag: 'Filings', summary: 'Delete filing', params: ['id'] },
  },
  '/documents': {
    get: { tag: 'Documents', summary: 'List documents', query: [...list, 'businessId', 'taskId', 'documentType'] },
    post: { tag: 'Documents', summary: 'Upload evidence (PDF, DOC, DOCX, JPG, PNG)', multipart: true },
  },
  '/documents/{id}': { delete: { tag: 'Documents', summary: 'Delete document', params: ['id'] } },
  '/notifications': { get: { tag: 'Notifications', summary: 'My notifications', query: [...list, 'read', 'type'] } },
  '/notifications/unread-count': { get: { tag: 'Notifications', summary: 'Unread count' } },
  '/notifications/read-all': { post: { tag: 'Notifications', summary: 'Mark all as read' } },
  '/notifications/{id}/read': { patch: { tag: 'Notifications', summary: 'Mark as read', params: ['id'] } },
  '/reports/compliance': { get: { tag: 'Reports', summary: 'Compliance report (JSON)', query: ['businessId', 'from', 'to'] } },
  '/reports/compliance.csv': { get: { tag: 'Reports', summary: 'Compliance report (CSV)', query: ['businessId', 'from', 'to'], produces: 'text/csv' } },
  '/reports/compliance.pdf': { get: { tag: 'Reports', summary: 'Compliance report (PDF)', query: ['businessId', 'from', 'to'], produces: 'application/pdf' } },
  '/admin/emails': {
    get: { tag: 'Super Admin Email', summary: 'Manual email delivery history (SUPER_ADMIN only)', query: ['page', 'limit', 'type', 'status'] },
    post: { tag: 'Super Admin Email', summary: 'Send manual email or compliance reminder (SUPER_ADMIN only)', body: 'ManualEmail' },
  },
  '/admin/emails/obligations': { get: { tag: 'Super Admin Email', summary: 'Outstanding obligations for an active recipient (SUPER_ADMIN only)', query: ['recipientId', 'search'] } },
  '/admin/emails/{id}': { get: { tag: 'Super Admin Email', summary: 'Manual email attempt details (SUPER_ADMIN only)', params: ['id'] } },
  '/admin/overview': { get: { tag: 'Admin', summary: 'Platform overview', admin: true } },
  '/admin/users': { get: { tag: 'Admin', summary: 'List users', query: [...list, 'role', 'isActive'], admin: true } },
  '/admin/users/{id}': {
    get: { tag: 'Admin', summary: 'User details', params: ['id'], admin: true },
    patch: { tag: 'Admin', summary: 'Change role or activate/deactivate', params: ['id'], body: 'AdminUserUpdate', admin: true },
  },
  '/admin/businesses': { get: { tag: 'Admin', summary: 'All businesses with compliance', query: list, admin: true } },
  '/admin/notifications': { get: { tag: 'Admin', summary: 'Notification activity', query: [...list, 'type'], admin: true } },
  '/admin/jobs/reminders': { post: { tag: 'Admin', summary: 'Run reminder job now', admin: true } },
  '/admin/jobs/generate-tasks': { post: { tag: 'Admin', summary: 'Generate tasks for all businesses', admin: true } },
  '/audit-logs': { get: { tag: 'Audit logs', summary: 'Audit log', query: [...list, 'action', 'entity', 'userId', 'businessId', 'from', 'to'], admin: true } },
};

const str = { type: 'string' };
const bool = { type: 'boolean' };
const num = { type: 'number' };

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SME Comply API',
    version: '1.0.0',
    description:
      'Regulatory filing tracker for Nigerian SMEs. Authenticate with POST /auth/login and use the returned accessToken as a Bearer token. SME Comply records filings; it does not submit them to government agencies.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Success: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: str, data: {}, meta: { type: 'object' } } },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: str,
          errors: { type: 'array', items: { type: 'object', properties: { path: str, message: str } } },
        },
      },
      Register: { type: 'object', required: ['firstName', 'lastName', 'email', 'password'], properties: { firstName: str, lastName: str, email: str, phone: str, password: str } },
      Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', example: 'owner@demo.smecomply.ng' }, password: { type: 'string', example: 'Demo@12345' } } },
      Email: { type: 'object', properties: { email: str } },
      Token: { type: 'object', properties: { token: str } },
      ResetPassword: { type: 'object', properties: { token: str, password: str } },
      Profile: { type: 'object', properties: { firstName: str, lastName: str, phone: str } },
      ChangePassword: { type: 'object', properties: { currentPassword: str, newPassword: str } },
      Business: {
        type: 'object',
        required: ['businessName', 'businessType', 'industry', 'state'],
        properties: {
          businessName: str, legalName: str, registrationNumber: str, taxIdentificationNumber: str,
          businessType: { type: 'string', example: 'Limited Liability Company' }, industry: str, state: { type: 'string', example: 'Kano' },
          city: str, address: str, phone: str, email: str, website: str, dateOfIncorporation: { type: 'string', format: 'date' },
          employeeCount: num, annualTurnover: num,
          flags: { type: 'object', properties: { cacRegistered: bool, taxRegistered: bool, vatRegistered: bool, pensionRegistered: bool, regulatedProducts: bool, importsExports: bool } },
        },
      },
      Invite: { type: 'object', properties: { email: str, role: { type: 'string', enum: ['ACCOUNTANT', 'COMPLIANCE_OFFICER'] } } },
      ReminderSettings: { type: 'object', properties: { daysBefore: { type: 'array', items: num }, remindWhenOverdue: bool, emailEnabled: bool, inAppEnabled: bool } },
      Agency: { type: 'object', properties: { name: str, acronym: str, description: str, level: { type: 'string', enum: ['FEDERAL', 'STATE', 'LOCAL'] }, website: str, active: bool } },
      Requirement: {
        type: 'object',
        properties: {
          agencyId: str, name: str, code: str, description: str, category: str,
          frequency: { type: 'string', enum: ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'BI_ANNUAL', 'ANNUAL', 'CUSTOM'] },
          dueRule: { type: 'object', example: { type: 'DAYS_AFTER_PERIOD_END', days: 30 } },
          applicabilityRules: { type: 'object', example: { match: 'ALL', conditions: [{ field: 'employeeCount', operator: 'GTE', value: 3 }] } },
          requiredDocuments: { type: 'array', items: str }, penaltyInformation: str, officialWebsite: str, guidanceUrl: str, active: bool,
        },
      },
      RulesPreview: { type: 'object', properties: { applicabilityRules: { type: 'object' } } },
      TaskStatus: { type: 'object', properties: { status: { type: 'string', enum: ['UPCOMING', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'NOT_APPLICABLE'] } } },
      Note: { type: 'object', properties: { body: str, note: str } },
      Filing: {
        type: 'object',
        properties: {
          taskId: str, filingDate: { type: 'string', format: 'date' }, referenceNumber: str,
          status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED'] }, notes: str, submittedTo: str, amountPaid: num,
          documents: { type: 'array', items: str }, markTaskCompleted: bool,
        },
      },
      ManualEmail: {
        type: 'object',
        required: ['recipientId', 'requestId', 'type', 'subject', 'message'],
        properties: {
          recipientId: str, requestId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['GENERAL', 'MANUAL_REMINDER'] },
          taskId: str, subject: str, message: str,
          format: { type: 'string', enum: ['TEXT', 'RICH_TEXT'], default: 'TEXT' },
        },
      },
      AdminUserUpdate: { type: 'object', properties: { role: str, isActive: bool } },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: Object.fromEntries(
    Object.entries(paths).map(([path, ops]) => [path, Object.fromEntries(Object.entries(ops).map(([method, op]) => [method, operation(op)]))]),
  ),
};
