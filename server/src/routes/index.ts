/**
 * Module purpose: Registers the API URL map and attaches authentication, role checks, validation, upload, and rate-limit middleware.
 */
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { businessController } from '../controllers/business.controller';
import { taskController } from '../controllers/task.controller';
import { filingController } from '../controllers/filing.controller';
import { documentController } from '../controllers/document.controller';
import { notificationController } from '../controllers/notification.controller';
import { agencyController, lookupController, requirementController } from '../controllers/regulatory.controller';
import { reportController } from '../controllers/report.controller';
import { adminController } from '../controllers/admin.controller';
import { manualEmailController } from '../controllers/manualEmail.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { requireBusinessPermission } from '../middleware/businessAccess';
import { validate } from '../middleware/validate';
import { authLimiter, manualEmailLimiter } from '../middleware/rateLimit';
import { uploadSingle } from '../middleware/upload';
import { asyncHandler as h } from '../utils/asyncHandler';
import * as v from '../validators';
import { z } from 'zod';

const router = Router();
const admin = requireRole('ADMIN', 'SUPER_ADMIN');
const superAdmin = requireRole('SUPER_ADMIN');
const memberParams = z.object({ id: v.objectId, memberId: v.objectId });

// ---------- Auth ----------
const auth = Router();
auth.post('/register', authLimiter, validate(v.registerSchema), h(authController.register));
auth.post('/login', authLimiter, validate(v.loginSchema), h(authController.login));
auth.post('/refresh', h(authController.refresh));
auth.post('/logout', h(authController.logout));
auth.post('/forgot-password', authLimiter, validate(v.forgotSchema), h(authController.forgotPassword));
auth.post('/reset-password', authLimiter, validate(v.resetSchema), h(authController.resetPassword));
auth.post('/verify-email', validate(v.verifySchema), h(authController.verifyEmail));
auth.post('/resend-verification', authenticate, h(authController.resendVerification));
auth.get('/me', authenticate, h(authController.me));
router.use('/auth', auth);

// ---------- Users (self) ----------
const users = Router();
users.use(authenticate);
users.get('/me', h(authController.me));
users.patch('/me', validate(v.profileSchema), h(authController.updateProfile));
users.post('/me/password', validate(v.changePasswordSchema), h(authController.changePassword));
router.use('/users', users);

// ---------- Lookups ----------
router.get('/lookups/options', authenticate, h(lookupController.options));

// ---------- Businesses & members ----------
const businesses = Router();
businesses.use(authenticate);
businesses.get('/', h(businessController.list));
businesses.post('/', validate(v.createBusinessSchema), h(businessController.create));
businesses.get('/:id', validate(v.idParam, 'params'), requireBusinessPermission('business:view', ['params']), h(businessController.get));
businesses.patch('/:id', validate(v.idParam, 'params'), requireBusinessPermission('business:update', ['params']), validate(v.updateBusinessSchema), h(businessController.update));
businesses.post('/:id/close', validate(v.idParam, 'params'), requireBusinessPermission('business:update', ['params']), h(businessController.close));
businesses.post('/:id/regenerate-tasks', validate(v.idParam, 'params'), requireBusinessPermission('business:update', ['params']), h(businessController.regenerate));
businesses.get('/:id/dashboard', validate(v.idParam, 'params'), requireBusinessPermission('tasks:view', ['params']), h(businessController.dashboard));
businesses.get('/:id/members', validate(v.idParam, 'params'), requireBusinessPermission('business:view', ['params']), h(businessController.members));
businesses.post('/:id/members', validate(v.idParam, 'params'), requireBusinessPermission('members:manage', ['params']), validate(v.inviteSchema), h(businessController.invite));
businesses.patch('/:id/members/:memberId', validate(memberParams, 'params'), requireBusinessPermission('members:manage', ['params']), validate(v.updateMemberSchema), h(businessController.updateMember));
businesses.delete('/:id/members/:memberId', validate(memberParams, 'params'), requireBusinessPermission('members:manage', ['params']), h(businessController.removeMember));
businesses.get('/:id/reminder-settings', validate(v.idParam, 'params'), requireBusinessPermission('business:view', ['params']), h(businessController.getReminders));
businesses.put('/:id/reminder-settings', validate(v.idParam, 'params'), requireBusinessPermission('reminders:manage', ['params']), validate(v.reminderSettingsSchema), h(businessController.updateReminders));
router.use('/businesses', businesses);

// Alias required by the API outline: /business-members/:businessId
const members = Router();
members.use(authenticate);
members.get('/:businessId', requireBusinessPermission('business:view', ['params']), (req, res, next) => {
  req.params.id = req.params.businessId;
  return h(businessController.members)(req, res, next);
});
router.use('/business-members', members);

// ---------- Regulatory data (read: any signed-in user; write: admin) ----------
const agencies = Router();
agencies.use(authenticate);
agencies.get('/', h(agencyController.list));
agencies.get('/:id', validate(v.idParam, 'params'), h(agencyController.get));
agencies.post('/', admin, validate(v.createAgencySchema), h(agencyController.create));
agencies.patch('/:id', admin, validate(v.idParam, 'params'), validate(v.updateAgencySchema), h(agencyController.update));
router.use('/agencies', agencies);

const requirements = Router();
requirements.use(authenticate);
requirements.get('/', h(requirementController.list));
requirements.post('/preview', admin, validate(v.previewRulesSchema), h(requirementController.preview));
requirements.get('/:id', validate(v.idParam, 'params'), h(requirementController.get));
requirements.post('/', admin, validate(v.createRequirementSchema), h(requirementController.create));
requirements.patch('/:id', admin, validate(v.idParam, 'params'), validate(v.updateRequirementSchema), h(requirementController.update));
router.use('/requirements', requirements);

// ---------- Compliance tasks ----------
const tasks = Router();
tasks.use(authenticate);
tasks.get('/', h(taskController.list));
tasks.get('/calendar', h(taskController.calendar));
tasks.get('/:id', validate(v.idParam, 'params'), h(taskController.get));
tasks.patch('/:id/status', validate(v.idParam, 'params'), validate(v.taskStatusSchema), h(taskController.updateStatus));
tasks.post('/:id/complete', validate(v.idParam, 'params'), validate(v.completeTaskSchema), h(taskController.complete));
tasks.post('/:id/notes', validate(v.idParam, 'params'), validate(v.noteSchema), h(taskController.addNote));
tasks.patch('/:id/assign', validate(v.idParam, 'params'), validate(v.assignSchema), h(taskController.assign));
router.use('/compliance-tasks', tasks);

// ---------- Filings ----------
const filings = Router();
filings.use(authenticate);
filings.get('/', h(filingController.list));
filings.post('/', validate(v.createFilingSchema), h(filingController.create));
filings.patch('/:id', validate(v.idParam, 'params'), validate(v.updateFilingSchema), h(filingController.update));
filings.delete('/:id', validate(v.idParam, 'params'), h(filingController.remove));
router.use('/filings', filings);

// ---------- Documents ----------
const documents = Router();
documents.use(authenticate);
documents.get('/', h(documentController.list));
documents.post('/', uploadSingle, validate(v.uploadDocumentSchema), h(documentController.upload));
documents.delete('/:id', validate(v.idParam, 'params'), h(documentController.remove));
router.use('/documents', documents);

// ---------- Notifications ----------
const notifications = Router();
notifications.use(authenticate);
notifications.get('/', h(notificationController.list));
notifications.get('/unread-count', h(notificationController.unreadCount));
notifications.post('/read-all', h(notificationController.markAllRead));
notifications.patch('/:id/read', validate(v.idParam, 'params'), h(notificationController.markRead));
notifications.delete('/:id', validate(v.idParam, 'params'), h(notificationController.remove));
router.use('/notifications', notifications);

// ---------- Reports ----------
const reports = Router();
reports.use(authenticate);
reports.get('/compliance', validate(v.reportQuerySchema, 'query'), requireBusinessPermission('reports:view', ['query']), h(reportController.compliance));
reports.get('/compliance.csv', validate(v.reportQuerySchema, 'query'), requireBusinessPermission('reports:view', ['query']), h(reportController.csv));
reports.get('/compliance.pdf', validate(v.reportQuerySchema, 'query'), requireBusinessPermission('reports:view', ['query']), h(reportController.pdf));
router.use('/reports', reports);

// ---------- Admin ----------
// The admin group first authenticates and checks ADMIN/SUPER_ADMIN; email routes add a stricter Super Admin check.
const adminRouter = Router();
adminRouter.use(authenticate, admin);
// Communication is Super Admin-only even though other /admin routes also allow ADMIN.
adminRouter.get('/emails/obligations', superAdmin, validate(v.emailObligationsQuerySchema, 'query'), h(manualEmailController.obligations));
adminRouter.get('/emails', superAdmin, validate(v.manualEmailQuerySchema, 'query'), h(manualEmailController.history));
adminRouter.get('/emails/:id', superAdmin, validate(v.idParam, 'params'), h(manualEmailController.get));
adminRouter.post('/emails', superAdmin, manualEmailLimiter, validate(v.manualEmailSchema), h(manualEmailController.send));
adminRouter.get('/overview', h(adminController.overview));
adminRouter.get('/users', h(adminController.users));
adminRouter.get('/users/:id', validate(v.idParam, 'params'), h(adminController.user));
adminRouter.patch('/users/:id', validate(v.idParam, 'params'), validate(v.adminUpdateUserSchema), h(adminController.updateUser));
adminRouter.get('/businesses', h(adminController.businesses));
adminRouter.get('/notifications', h(adminController.notifications));
adminRouter.get('/lookups', h(lookupController.list));
adminRouter.post('/lookups', validate(v.lookupSchema), h(lookupController.create));
adminRouter.patch('/lookups/:id', validate(v.idParam, 'params'), validate(v.updateLookupSchema), h(lookupController.update));
adminRouter.post('/jobs/reminders', h(adminController.runReminders));
adminRouter.post('/jobs/generate-tasks', h(adminController.regenerateAll));
router.use('/admin', adminRouter);

// Also exposed at /audit-logs per the API outline.
router.get('/audit-logs', authenticate, admin, h(adminController.auditLogs));
adminRouter.get('/audit-logs', h(adminController.auditLogs));

export default router;
