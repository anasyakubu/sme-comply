/**
 * Module purpose: Handles regulatory agencies, requirements, and lookup options; administrator writes are authorized at the route layer.
 */
import { Request, Response } from 'express';
import { agencyService } from '../services/agency.service';
import { auditContext } from '../services/audit.service';
import { lookupService } from '../services/lookup.service';
import { requirementService } from '../services/requirement.service';
import { sendSuccess } from '../utils/response';

export const agencyController = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(req: Request, res: Response) {
    const { items, meta } = await agencyService.list(req.query as Record<string, unknown>);
    return sendSuccess(res, 'Agencies retrieved', items, 200, meta);
  },
  /**
   * Loads the requested record and returns it or reports that it cannot be found.
   */
  async get(req: Request, res: Response) {
    return sendSuccess(res, 'Agency retrieved', await agencyService.get(req.params.id));
  },
  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(req: Request, res: Response) {
    return sendSuccess(res, 'Agency created', await agencyService.create(req.body, auditContext(req)), 201);
  },
  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(req: Request, res: Response) {
    return sendSuccess(res, 'Agency updated', await agencyService.update(req.params.id, req.body, auditContext(req)));
  },
};

export const requirementController = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(req: Request, res: Response) {
    const { items, meta } = await requirementService.list(req.query as Record<string, unknown>);
    return sendSuccess(res, 'Requirements retrieved', items, 200, meta);
  },
  /**
   * Loads the requested record and returns it or reports that it cannot be found.
   */
  async get(req: Request, res: Response) {
    return sendSuccess(res, 'Requirement retrieved', await requirementService.get(req.params.id));
  },
  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(req: Request, res: Response) {
    return sendSuccess(res, 'Requirement created', await requirementService.create(req.body, auditContext(req)), 201);
  },
  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(req: Request, res: Response) {
    return sendSuccess(res, 'Requirement updated', await requirementService.update(req.params.id, req.body, auditContext(req)));
  },
  /**
   * Evaluates draft regulatory rules without saving them to the database.
   */
  async preview(req: Request, res: Response) {
    return sendSuccess(res, 'Preview generated', await requirementService.preview(req.body.applicabilityRules));
  },
};

export const lookupController = {
  /**
   * Loads selectable reference values used by frontend forms.
   */
  async options(_req: Request, res: Response) {
    return sendSuccess(res, 'Options retrieved', await lookupService.options());
  },
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(req: Request, res: Response) {
    return sendSuccess(res, 'Values retrieved', await lookupService.listAll(typeof req.query.kind === 'string' ? req.query.kind : undefined));
  },
  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(req: Request, res: Response) {
    return sendSuccess(res, 'Value added', await lookupService.create(req.body, auditContext(req)), 201);
  },
  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(req: Request, res: Response) {
    return sendSuccess(res, 'Value updated', await lookupService.update(req.params.id, req.body, auditContext(req)));
  },
};
