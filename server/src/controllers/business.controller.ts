/**
 * Module purpose: Maps business, membership, dashboard, and reminder-settings endpoints to permission-aware services.
 */
import { Request, Response } from 'express';
import { auditContext } from '../services/audit.service';
import { businessService } from '../services/business.service';
import { dashboardService } from '../services/dashboard.service';
import { reminderService } from '../services/reminder.service';
import { sendSuccess } from '../utils/response';

export const businessController = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(req: Request, res: Response) {
    const { items, meta } = await businessService.list(req.user!, req.query as Record<string, unknown>);
    return sendSuccess(res, 'Businesses retrieved', items, 200, meta);
  },
  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(req: Request, res: Response) {
    const result = await businessService.create(req.user!.id, req.body, auditContext(req));
    return sendSuccess(res, `Business created with ${result.generation.created} compliance tasks`, result, 201);
  },
  /**
   * Loads the requested record and returns it or reports that it cannot be found.
   */
  async get(req: Request, res: Response) {
    return sendSuccess(res, 'Business retrieved', await businessService.get(req.params.id, req.access!));
  },
  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(req: Request, res: Response) {
    return sendSuccess(res, 'Business updated', await businessService.update(req.params.id, req.body, auditContext(req)));
  },
  /**
   * Closes the selected business and prevents further open-business operations.
   */
  async close(req: Request, res: Response) {
    return sendSuccess(res, 'Business closed', await businessService.close(req.params.id, auditContext(req)));
  },
  /**
   * Requests compliance task regeneration after relevant business changes.
   */
  async regenerate(req: Request, res: Response) {
    return sendSuccess(res, 'Obligations refreshed', await businessService.regenerate(req.params.id, auditContext(req)));
  },
  /**
   * Aggregates a business’s task and progress data for its dashboard.
   */
  async dashboard(req: Request, res: Response) {
    return sendSuccess(res, 'Dashboard retrieved', await dashboardService.forBusiness(req.params.id, req.user!.id));
  },
  /**
   * Returns users and invitations associated with the selected business.
   */
  async members(req: Request, res: Response) {
    return sendSuccess(res, 'Members retrieved', await businessService.listMembers(req.params.id));
  },
  /**
   * Invites a user to join a business with a defined membership role.
   */
  async invite(req: Request, res: Response) {
    const member = await businessService.invite(req.params.id, req.body.email, req.body.role, req.user!, auditContext(req));
    return sendSuccess(res, member?.status === 'ACTIVE' ? 'Member added' : 'Invitation sent', member, 201);
  },
  /**
   * Changes a member’s role or invitation state under the business permission rules.
   */
  async updateMember(req: Request, res: Response) {
    return sendSuccess(res, 'Member updated', await businessService.updateMember(req.params.id, req.params.memberId, req.body, auditContext(req)));
  },
  /**
   * Revokes a user’s access to the selected business.
   */
  async removeMember(req: Request, res: Response) {
    await businessService.removeMember(req.params.id, req.params.memberId, auditContext(req));
    return sendSuccess(res, 'Member removed', null);
  },
  /**
   * Returns the business’s scheduled reminder preferences.
   */
  async getReminders(req: Request, res: Response) {
    return sendSuccess(res, 'Reminder settings retrieved', await reminderService.getSettings(req.params.id));
  },
  /**
   * Saves the business’s scheduled reminder preferences.
   */
  async updateReminders(req: Request, res: Response) {
    return sendSuccess(res, 'Reminder settings saved', await reminderService.updateSettings(req.params.id, req.body, req.user!.id));
  },
};
