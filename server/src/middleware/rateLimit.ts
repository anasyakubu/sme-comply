/**
 * Module purpose: Limits frequent requests to protect login and manual-email routes against abuse or accidental rapid sending.
 */
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const skip = () => env.NODE_ENV === 'test';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many requests. Try again in a few minutes.', errors: [] },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many sign-in attempts. Try again in 15 minutes.', errors: [] },
});

/** Limits outgoing manual emails separately from normal API browsing. */
export const manualEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many manual emails. Try again in 15 minutes.', errors: [] },
});
