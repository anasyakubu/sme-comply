/**
 * Module purpose: Accepts filing CRUD requests and delegates business access and persistence rules to the filing service.
 */
import { Request, Response } from 'express';
import { auditContext } from '../services/audit.service';
import { filingService } from '../services/filing.service';
import { sendSuccess } from '../utils/response';

export const filingController = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(req: Request, res: Response) {
    const { items, meta } = await filingService.list(req.user!, req.query as Record<string, unknown>);
    return sendSuccess(res, 'Filings retrieved', items, 200, meta);
  },
  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(req: Request, res: Response) {
    return sendSuccess(res, 'Filing recorded', await filingService.create(req.body, req.user!, auditContext(req)), 201);
  },
  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(req: Request, res: Response) {
    return sendSuccess(res, 'Filing updated', await filingService.update(req.params.id, req.body, req.user!, auditContext(req)));
  },
  /**
   * Checks access and removes the requested entry.
   */
  async remove(req: Request, res: Response) {
    await filingService.remove(req.params.id, req.user!, auditContext(req));
    return sendSuccess(res, 'Filing deleted', null);
  },
};
