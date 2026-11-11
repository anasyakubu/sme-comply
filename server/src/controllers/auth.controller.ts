/**
 * Module purpose: Handles authentication-related HTTP requests and secure refresh-token cookie behavior; substantive account logic lives in services.
 */
import { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { authService } from '../services/auth.service';
import { auditContext } from '../services/audit.service';
import { userService } from '../services/user.service';
import { sendSuccess } from '../utils/response';

export const REFRESH_COOKIE = 'smec_rt';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  // Cross-site deployments (e.g. Vercel frontend + Render API) need SameSite=None over HTTPS.
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_DAYS * 86_400_000,
});

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? undefined });

export const authController = {
  /**
   * Handles the register HTTP operation and delegates work to the corresponding service.
   */
  async register(req: Request, res: Response) {
    const { refreshToken, ...rest } = await authService.register(req.body, meta(req));
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
    return sendSuccess(res, 'Account created', rest, 201);
  },

  /**
   * Handles the login HTTP operation and delegates work to the corresponding service.
   */
  async login(req: Request, res: Response) {
    const { refreshToken, ...rest } = await authService.login(req.body.email, req.body.password, meta(req));
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
    return sendSuccess(res, 'Signed in', rest);
  },

  /**
   * Handles the refresh HTTP operation and delegates work to the corresponding service.
   */
  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken, ...rest } = await authService.refresh(req.cookies?.[REFRESH_COOKIE], meta(req));
      res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
      return sendSuccess(res, 'Session refreshed', rest);
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
      throw err;
    }
  },

  /**
   * Handles the logout HTTP operation and delegates work to the corresponding service.
   */
  async logout(req: Request, res: Response) {
    await authService.logout(req.cookies?.[REFRESH_COOKIE], auditContext(req));
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    return sendSuccess(res, 'Signed out', null);
  },

  /**
   * Handles the forgot password HTTP operation and delegates work to the corresponding service.
   */
  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(req.body.email);
    return sendSuccess(res, 'If an account exists for that email, a reset link is on its way.', null);
  },

  /**
   * Handles the reset password HTTP operation and delegates work to the corresponding service.
   */
  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body.token, req.body.password);
    return sendSuccess(res, 'Password updated. Sign in with your new password.', null);
  },

  /**
   * Handles the verify email HTTP operation and delegates work to the corresponding service.
   */
  async verifyEmail(req: Request, res: Response) {
    const user = await authService.verifyEmail(req.body.token);
    return sendSuccess(res, 'Email confirmed', user);
  },

  /**
   * Handles the resend verification HTTP operation and delegates work to the corresponding service.
   */
  async resendVerification(req: Request, res: Response) {
    await authService.resendVerification(req.user!.id);
    return sendSuccess(res, 'Confirmation email sent', null);
  },

  /**
   * Returns the signed-in user’s profile.
   */
  async me(req: Request, res: Response) {
    return sendSuccess(res, 'Current user', await userService.me(req.user!.id));
  },

  /**
   * Validates and saves account profile fields.
   */
  async updateProfile(req: Request, res: Response) {
    return sendSuccess(res, 'Profile updated', await userService.updateProfile(req.user!.id, req.body, auditContext(req)));
  },

  /**
   * Checks the current password before storing the replacement hash.
   */
  async changePassword(req: Request, res: Response) {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword, auditContext(req));
    return sendSuccess(res, 'Password changed', null);
  },
};
