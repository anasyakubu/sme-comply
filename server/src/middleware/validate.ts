/**
 * Module purpose: Checks incoming request bodies, parameters, or queries against Zod schemas and reports validation errors.
 */
import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type Part = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, part: Part = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(
        ApiError.badRequest(
          'Validation failed',
          result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }
    if (part === 'query') {
      // req.query is a getter in Express; overwrite its keys instead of reassigning.
      Object.keys(req.query).forEach((k) => delete (req.query as any)[k]);
      Object.assign(req.query, result.data);
    } else {
      (req as any)[part] = result.data;
    }
    next();
  };
