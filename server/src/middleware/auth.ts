/**
 * Module purpose: Verifies access tokens and platform roles before protected handlers run; the token payload becomes the authenticated request user.
 */
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { UserModel } from '../models';

interface AccessPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/**
 * Signs a short-lived JWT that identifies the authenticated user and platform role.
 */
export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any });
}

/** Verifies the Bearer access token and confirms the account is still active. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();
    let payload: AccessPayload;
    try {
      payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as AccessPayload;
    } catch {
      throw ApiError.unauthorized('Your session has expired. Sign in again.');
    }
    const user = await UserModel.findById(payload.sub).select('email role isActive').lean();
    if (!user || !user.isActive) throw ApiError.unauthorized('This account is not active');
    req.user = { id: String(user._id), email: user.email, role: user.role as UserRole };
    next();
  } catch (err) {
    next(err);
  }
}

/** Restricts a route to specific platform roles (e.g. ADMIN, SUPER_ADMIN). */
export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
