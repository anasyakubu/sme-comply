/**
 * Module purpose: Stores registered accounts, roles, email state, and hashed credential material. Private hashes are excluded from normal query results.
 */
import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { PLATFORM_ROLES } from '../config/constants';

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    // Unique normalized email is the account identity and email recipient address.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    // Bcrypt hash is excluded from ordinary queries to reduce accidental credential exposure.
    passwordHash: { type: String, required: true, select: false },
    // Platform role determines admin/super-admin API permissions.
    role: { type: String, enum: PLATFORM_ROLES, default: 'OWNER', index: true },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.emailVerificationTokenHash;
        delete ret.passwordResetTokenHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Text index supports efficient name/keyword searching.
userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
