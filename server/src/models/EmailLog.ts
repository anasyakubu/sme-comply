/**
 * Module purpose: Stores a Super Admin manual send attempt and its recipient, initiating admin, optional obligation, result, and idempotency request ID.
 */
import { Schema, model, Types, InferSchemaType } from 'mongoose';

/** A durable record of each Super Admin manual delivery attempt. */
const emailLogSchema = new Schema(
  {
    // Registered user selected by the Super Admin.
    recipient: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    recipientName: { type: String, required: true },
    recipientEmail: { type: String, required: true },
    // Administrator responsible for the attempt, retained for accountability.
    initiatedBy: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 20000 },
    format: { type: String, enum: ['TEXT', 'RICH_TEXT'], required: true },
    type: { type: String, enum: ['GENERAL', 'MANUAL_REMINDER'], required: true, index: true },
    task: { type: Types.ObjectId, ref: 'ComplianceTask' },
    obligationName: { type: String },
    businessName: { type: String },
    dueDate: { type: Date },
    obligationDetails: { type: String },
    // PENDING is recorded before SMTP; SENT/FAILED capture the final transport result.
    status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], required: true, default: 'PENDING', index: true },
    attemptedAt: { type: Date, required: true, default: Date.now },
    sentAt: { type: Date },
    failureCode: { type: String },
    /** The same request can never initiate two SMTP deliveries. */
    requestId: { type: String, required: true },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// The unique index is enforced by MongoDB, including concurrent requests.
emailLogSchema.index({ initiatedBy: 1, requestId: 1 }, { unique: true });
emailLogSchema.index({ attemptedAt: -1 });

export type EmailLog = InferSchemaType<typeof emailLogSchema>;
export const EmailLogModel = model('EmailLog', emailLogSchema);
