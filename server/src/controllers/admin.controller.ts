/**
 * Module purpose: Translates administrator HTTP requests into service calls and consistent JSON responses, including manual job triggers.
 */
import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { auditContext } from '../services/audit.service';
import { businessService } from '../services/business.service';
import { notificationService } from '../services/notification.service';
import { reminderService } from '../services/reminder.service';
import { taskGenerationService } from '../services/taskGeneration.service';
import { userService } from '../services/user.service';
import { auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';

export const adminController = {
  /**
   * Builds key counts and summaries for the administrator dashboard.
   */
  async overview(_req: Request, res: Response) {
    return sendSuccess(res, 'Overview retrieved', await adminService.overview());
  },
  /**
   * Lists registered platform accounts for administrator oversight.
   */
  async users(req: Request, res: Response) {
    const { items, meta } = await userService.adminList(req.query as Record<string, unknown>);
    return sendSuccess(res, 'Users retrieved', items, 200, meta);
  },
  /**
   * Loads a selected user for administrator inspection.
   */
  async user(req: Request, res: Response) {
    return sendSuccess(res, 'User retrieved', await userService.adminGet(req.params.id));
  },
  /**
   * Applies an administrator-authorized account change and returns the updated record.
   */
  async updateUser(req: Request, res: Response) {
    return sendSuccess(res, 'User updated', await userService.adminUpdate(req.user!, req.params.id, req.body, auditContext(req)));
  },
  /**
   * Lists registered businesses with search and paging.
   */
  async businesses(req: Request, res: Response) {
    const { items, meta } = await businessService.list(req.user!, req.query as Record<string, unknown>);
    return sendSuccess(res, 'Businesses retrieved', items, 200, meta);
  },
  /**
   * Lists platform notifications for administrator monitoring.
   */
  async notifications(req: Request, res: Response) {
    const { items, meta, byType } = await notificationService.adminList(req.query as Record<string, unknown>);
    res.status(200).json({ success: true, message: 'Notifications retrieved', data: items, meta, byType });
  },
  /**
   * Lists the platform actions captured in the audit history.
   */
  async auditLogs(req: Request, res: Response) {
    const { items, meta, actions } = await adminService.auditLogs(req.query as Record<string, unknown>);
    res.status(200).json({ success: true, message: 'Audit logs retrieved', data: items, meta, actions });
  },
  /**
   * Triggers the existing automatic reminder job from an authorized admin endpoint.
   */
  async runReminders(req: Request, res: Response) {
    const statuses = await taskGenerationService.refreshStatuses();
    const reminders = await reminderService.run();
    await auditService.log(auditContext(req), 'REMINDERS_RUN_MANUALLY', 'System', undefined, { metadata: { ...reminders } });
    return sendSuccess(res, 'Reminder job completed', { statuses, reminders });
  },
  /**
   * Runs task generation across all eligible businesses.
   */
  async regenerateAll(req: Request, res: Response) {
    const result = await taskGenerationService.generateForAll();
    await auditService.log(auditContext(req), 'TASKS_REGENERATED_ALL', 'System', undefined, { metadata: result });
    return sendSuccess(res, 'Task generation completed', result);
  },
};
