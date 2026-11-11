/**
 * Module purpose: Checks business-specific permissions and membership on protected operations, not just the user’s platform role.
 */
import { NextFunction, Request, Response } from 'express';
import { BusinessPermission } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { accessService } from '../services/access.service';

type Source = 'params' | 'query' | 'body';

/**
 * Loads the caller's access to the business referenced in the request and
 * enforces a permission. Looks for `businessId` (or `id` for /businesses/:id).
 */
export const requireBusinessPermission =
  (permission: BusinessPermission, sources: Source[] = ['params', 'query', 'body']) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized();
      let businessId: unknown;
      for (const s of sources) {
        const bag = (req as any)[s] ?? {};
        businessId = bag.businessId ?? (s === 'params' ? bag.id : undefined);
        if (businessId) break;
      }
      if (typeof businessId !== 'string') throw ApiError.badRequest('businessId is required');
      req.access = await accessService.require(req.user, businessId, permission);
      next();
    } catch (err) {
      next(err);
    }
  };
