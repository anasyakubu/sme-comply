/**
 * Module purpose: Joins users to businesses with membership roles and invitation status; invited email addresses also support pending invitations.
 */
import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { BUSINESS_PERMISSIONS, BUSINESS_ROLES } from '../config/constants';

const businessMemberSchema = new Schema(
  {
    // Points to an existing user; invitations may instead begin with an email address.
    user: { type: Types.ObjectId, ref: 'User', index: true },
    // The business this membership or invitation grants access to.
    business: { type: Types.ObjectId, ref: 'Business', required: true, index: true },
    role: { type: String, enum: BUSINESS_ROLES, required: true },
    /** Extra permissions on top of the role's defaults. */
    permissions: [{ type: String, enum: BUSINESS_PERMISSIONS }],
    status: { type: String, enum: ['INVITED', 'ACTIVE', 'REMOVED'], default: 'ACTIVE' },
    invitedEmail: { type: String, lowercase: true, trim: true },
    inviteTokenHash: { type: String, select: false },
    inviteExpires: { type: Date, select: false },
    invitedBy: { type: Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date },
    joinedAt: { type: Date },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// The partial unique index prevents a user from holding duplicate memberships in one business.
businessMemberSchema.index(
  { user: 1, business: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } },
);
businessMemberSchema.index({ business: 1, invitedEmail: 1 });

export type BusinessMember = InferSchemaType<typeof businessMemberSchema>;
export const BusinessMemberModel = model('BusinessMember', businessMemberSchema);
