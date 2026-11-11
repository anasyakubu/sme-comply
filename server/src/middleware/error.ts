/**
 * Module purpose: Centralizes HTTP error responses so validation, authentication, and unexpected failures have a consistent shape.
 */
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Converts unknown URLs into a consistent 404 API error.
 */
export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  let error: ApiError;

  if (err instanceof ApiError) {
    error = err;
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = ApiError.badRequest(
      'Validation failed',
      Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for ${err.path}`);
  } else if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    error = ApiError.conflict(`A record with this ${field} already exists`);
  } else if (err instanceof multer.MulterError) {
    error = ApiError.badRequest(
      err.code === 'LIMIT_FILE_SIZE' ? `File is larger than ${env.MAX_UPLOAD_MB} MB` : err.message,
    );
  } else if (err?.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Request body is not valid JSON');
  } else {
    logger.error(err);
    error = new ApiError(500, 'Something went wrong on our side. Try again shortly.');
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errors: error.errors,
    ...(env.NODE_ENV === 'development' && error.statusCode === 500 ? { stack: err?.stack } : {}),
  });
}
