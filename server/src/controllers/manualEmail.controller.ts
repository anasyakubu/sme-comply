/**
 * Module purpose: Provides Super Admin endpoints for obligation lookup, sending manual emails/reminders, and reviewing delivery attempts.
 */
import { Request, Response } from 'express';
import { auditContext } from '../services/audit.service';
import { manualEmailService } from '../services/manualEmail.service';
import { sendSuccess } from '../utils/response';

export const manualEmailController = {
  /**
   * Finds obligations available to the selected recipient for a manual reminder.
   */
  async obligations(req: Request, res: Response) {
    return sendSuccess(res, 'Obligations retrieved',
      await manualEmailService.obligations(req.query.recipientId as string, req.query.search as string | undefined));
  },
  /**
   * Attempts to send the configured message and records the result.
   */
  async send(req: Request, res: Response) {
    return sendSuccess(res, 'Email accepted by SMTP',
      await manualEmailService.send(req.body, req.user!.id, auditContext(req)), 201);
  },
  /**
   * Retrieves past records with paging and filtering for administrative review.
   */
  async history(req: Request, res: Response) {
    const { items, meta } = await manualEmailService.history(req.query as Record<string, unknown>);
    return sendSuccess(res, 'Email history retrieved', items, 200, meta);
  },
  /**
   * Loads the requested record and returns it or reports that it cannot be found.
   */
  async get(req: Request, res: Response) {
    return sendSuccess(res, 'Email details retrieved', await manualEmailService.get(req.params.id));
  },
};
