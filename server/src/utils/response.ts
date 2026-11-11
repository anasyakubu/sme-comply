/**
 * Module purpose: Wraps successful API responses in one predictable envelope for the frontend API helper.
 */
import { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Uses a consistent JSON response structure that frontend API calls can unwrap.
 */
export function sendSuccess<T>(res: Response, message: string, data: T, status = 200, meta?: PageMeta) {
  return res.status(status).json({ success: true, message, data, ...(meta ? { meta } : {}) });
}
