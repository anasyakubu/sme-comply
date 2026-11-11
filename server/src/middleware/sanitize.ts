/**
 * Module purpose: Sanitizes incoming request values before they reach controllers or database queries.
 */
import { NextFunction, Request, Response } from 'express';

/**
 * Strips keys that start with "$" or contain "." from user input, blocking
 * MongoDB operator injection such as { "email": { "$ne": null } }.
 */
function clean(value: unknown, depth = 0): unknown {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k.startsWith('$') || k.includes('.')) continue;
    out[k] = clean(v, depth + 1);
  }
  return out;
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params) as any;
  if (req.query) {
    const cleaned = clean({ ...req.query }) as Record<string, unknown>;
    Object.keys(req.query).forEach((k) => delete (req.query as any)[k]);
    Object.assign(req.query, cleaned);
  }
  next();
}
