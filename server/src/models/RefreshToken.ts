/**
 * Module purpose: Stores hashed refresh tokens with expiration so browser sessions can be rotated or revoked securely.
 */
import { Schema, model, Types } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    // Only a one-way digest is stored; the raw refresh token is never persisted.
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    // MongoDB’s TTL index removes expired session records over time.
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedBy: { type: String },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true },
);

// MongoDB removes expired tokens automatically.
// MongoDB TTL cleanup removes token documents after their expiration time.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
