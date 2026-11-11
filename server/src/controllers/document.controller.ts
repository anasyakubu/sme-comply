/**
 * Module purpose: Handles document upload, listing, and deletion requests after middleware has parsed and validated the input.
 */
import { Request, Response } from 'express';
import { auditContext } from '../services/audit.service';
import { documentService } from '../services/document.service';
import { sendSuccess } from '../utils/response';

export const documentController = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(req: Request, res: Response) {
    const { items, meta } = await documentService.list(req.user!, req.query as Record<string, unknown>);
    return sendSuccess(res, 'Documents retrieved', items, 200, meta);
  },
  /**
   * Validates the file and association before saving the uploaded document.
   */
  async upload(req: Request, res: Response) {
    return sendSuccess(res, 'Document uploaded', await documentService.upload(req.file, req.body, req.user!, auditContext(req)), 201);
  },
  /**
   * Checks access and removes the requested entry.
   */
  async remove(req: Request, res: Response) {
    await documentService.remove(req.params.id, req.user!, auditContext(req));
    return sendSuccess(res, 'Document deleted', null);
  },
};
