/**
 * Module purpose: Implements registration, login, token rotation, email verification, password recovery, and credential checks.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { signAccessToken } from '../middleware/auth';
import { memberRepository, refreshTokenRepository, userRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { randomToken, sha256 } from '../utils/crypto';
import { emailTemplates } from '../utils/emailTemplates';
import { AuditContext, auditService } from './audit.service';
import { emailService } from './email.service';
import { UserRole } from '../config/constants';
import { UserModel } from '../models';

const BCRYPT_ROUNDS = 12;

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  inviteToken?: string;
}

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

/**
 * Creates a random refresh token, stores only its hash and expiry, and returns the token for the secure browser cookie.
 */
async function issueRefreshToken(userId: string, family: string, meta: SessionMeta) {
  const token = randomToken(48);
  await refreshTokenRepository.create({
    user: userId as any,
    tokenHash: sha256(token),
    family,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return token;
}

/**
 * Issues a short-lived JWT and a new rotating refresh token for one authenticated session.
 */
async function sessionFor(user: { _id: unknown; email: string; role: string }, family: string, meta: SessionMeta) {
  const accessToken = signAccessToken({ sub: String(user._id), email: user.email, role: user.role as UserRole });
  const refreshToken = await issueRefreshToken(String(user._id), family, meta);
  return { accessToken, refreshToken };
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const authService = {
  /**
   * Creates an account with a hashed password and sends a verification message.
   */
  async register(input: RegisterInput, meta: SessionMeta) {
    const email = input.email.toLowerCase();
    if (await userRepository.findOne({ email })) throw ApiError.conflict('An account with this email already exists');

    const verification = randomToken();
    const user = await userRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone: input.phone,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      role: 'OWNER',
      emailVerificationTokenHash: sha256(verification),
      emailVerificationExpires: new Date(Date.now() + 24 * 3_600_000),
    });

    // Link pending invitations sent to this email address.
    // Registration also accepts any invitations that were issued to this email before the account existed.
    const pending = await memberRepository.find({ invitedEmail: email, status: 'INVITED' });
    for (const invite of pending) {
      // NOTE: `BusinessMember.user` is currently typed as the ObjectId constructor in the schema
      // (should be an ObjectId instance). Cast to satisfy the compiler; the runtime value is a
      // valid ObjectId. Proper fix belongs in the BusinessMember model definition.
      invite.user = user._id as unknown as typeof mongoose.Types.ObjectId;
      invite.status = 'ACTIVE';
      invite.joinedAt = new Date();
      await invite.save();
    }
    if (pending.length > 0) {
      user.role = pending[0].role as UserRole;
      await user.save();
    }

    await emailService.send(email, emailTemplates.verifyEmail(user.firstName, verification));
    await emailService.send(email, emailTemplates.welcome(user.firstName));
    await auditService.log({ userId: String(user._id), ...meta }, 'USER_REGISTERED', 'User', String(user._id));

    const tokens = await sessionFor(user, randomToken(12), meta);
    return { user: user.toJSON(), ...tokens };
  },

  /**
   * Validates the password and creates access and refresh credentials for the session.
   */
  async login(email: string, password: string, meta: SessionMeta) {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    // Same message for unknown email and wrong password.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw ApiError.unauthorized('Email or password is incorrect');
    }
    if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact support.');
    user.lastLoginAt = new Date();
    await user.save();
    await auditService.log({ userId: String(user._id), ...meta }, 'LOGIN', 'User', String(user._id));
    const tokens = await sessionFor(user, randomToken(12), meta);
    return { user: user.toJSON(), ...tokens };
  },

  /** Rotates the refresh token. Reusing an old token revokes the whole session family. */
  async refresh(token: string | undefined, meta: SessionMeta) {
    if (!token) throw ApiError.unauthorized('No session');
    const stored = await refreshTokenRepository.findOne({ tokenHash: sha256(token) });
    if (!stored || stored.expiresAt < new Date()) throw ApiError.unauthorized('Session expired');
    // Refresh-token replay invalidates the entire session family to limit reuse of stolen tokens.
    if (stored.revokedAt) {
      await refreshTokenRepository.updateMany({ family: stored.family }, { revokedAt: new Date() });
      throw ApiError.unauthorized('Session expired');
    }
    const user = await userRepository.findById(String(stored.user));
    if (!user || !user.isActive) throw ApiError.unauthorized('Session expired');

    const tokens = await sessionFor(user, stored.family, meta);
    stored.revokedAt = new Date();
    stored.replacedBy = sha256(tokens.refreshToken);
    await stored.save();
    return { user: user.toJSON(), ...tokens };
  },

  /**
   * Revokes the refresh-token session so it cannot be used again.
   */
  async logout(token: string | undefined, ctx: AuditContext) {
    if (token) {
      const stored = await refreshTokenRepository.findOne({ tokenHash: sha256(token) });
      if (stored) {
        await refreshTokenRepository.updateMany({ family: stored.family }, { revokedAt: new Date() });
      }
    }
    if (ctx.userId) await auditService.log(ctx, 'LOGOUT', 'User', ctx.userId);
  },

  /**
   * Creates a temporary password-reset token without disclosing whether an account exists.
   */
  async forgotPassword(email: string) {
    const user = await userRepository.findOne({ email: email.toLowerCase() });
    // Always respond the same way so the endpoint can't be used to discover accounts.
    if (!user || !user.isActive) return;
    const token = randomToken();
    user.passwordResetTokenHash = sha256(token);
    user.passwordResetExpires = new Date(Date.now() + 3_600_000);
    await user.save();
    await emailService.send(user.email, emailTemplates.passwordReset(user.firstName, token));
  },

  /**
   * Validates the reset token and changes the stored password hash.
   */
  async resetPassword(token: string, password: string) {
    const user = await UserModel.findOne({
      passwordResetTokenHash: sha256(token),
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.');
    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    await refreshTokenRepository.updateMany({ user: user._id }, { revokedAt: new Date() });
    await auditService.log({ userId: String(user._id) }, 'PASSWORD_RESET', 'User', String(user._id));
  },

  /**
   * Marks an account as verified after a valid verification token.
   */
  async verifyEmail(token: string) {
    const user = await UserModel.findOne({
      emailVerificationTokenHash: sha256(token),
      emailVerificationExpires: { $gt: new Date() },
    });
    if (!user) throw ApiError.badRequest('This confirmation link is invalid or has expired.');
    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    return user.toJSON();
  },

  /**
   * Issues a new verification email for an unverified user while respecting the account state.
   */
  async resendVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.emailVerified) return;
    const token = randomToken();
    user.emailVerificationTokenHash = sha256(token);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 3_600_000);
    await user.save();
    await emailService.send(user.email, emailTemplates.verifyEmail(user.firstName, token));
  },

  /**
   * Checks the current password before storing the replacement hash.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, ctx: AuditContext) {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) throw ApiError.notFound('User not found');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Current password is incorrect', [{ path: 'currentPassword', message: 'Incorrect password' }]);
    }
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await user.save();
    await auditService.log(ctx, 'PASSWORD_CHANGED', 'User', userId);
  },

  hashPassword: (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS),
};