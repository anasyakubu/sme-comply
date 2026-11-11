/**
 * Module purpose: Routes task listing, detail, status updates, completion, notes, and assignments to the task service.
 */
import { Request, Response } from 'express';
import { auditContext } from '../services/audit.service';
import { taskService } from '../services/task.service';
import { sendSuccess } from '../utils/response';

export const taskController = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(req: Request, res: Response) {
    const { items, meta } = await taskService.list(req.user!, req.query as Record<string, unknown>);
    return sendSuccess(res, 'Compliance tasks retrieved', items, 200, meta);
  },
  /**
   * Retrieves tasks for a requested calendar date range.
   */
  async calendar(req: Request, res: Response) {
    return sendSuccess(res, 'Calendar retrieved', await taskService.calendar(req.user!, req.query as Record<string, unknown>));
  },
  /**
   * Loads the requested record and returns it or reports that it cannot be found.
   */
  async get(req: Request, res: Response) {
    return sendSuccess(res, 'Compliance task retrieved', await taskService.detail(req.params.id, req.user!));
  },
  /**
   * Applies the requested task status through the service after route-level validation.
   */
  async updateStatus(req: Request, res: Response) {
    return sendSuccess(res, 'Status updated', await taskService.updateStatus(req.params.id, req.body.status, req.user!, auditContext(req)));
  },
  /**
   * Marks a task complete and records supporting completion information.
   */
  async complete(req: Request, res: Response) {
    return sendSuccess(res, 'Marked as completed', await taskService.complete(req.params.id, req.user!, auditContext(req), req.body?.note));
  },
  /**
   * Appends an audit-friendly note to the selected compliance task.
   */
  async addNote(req: Request, res: Response) {
    return sendSuccess(res, 'Note added', await taskService.addNote(req.params.id, req.body.body, req.user!, auditContext(req)), 201);
  },
  /**
   * Updates who is responsible for a compliance task after checking access.
   */
  async assign(req: Request, res: Response) {
    return sendSuccess(res, 'Assignee updated', await taskService.assign(req.params.id, req.body.assigneeId, req.user!, auditContext(req)));
  },
};
