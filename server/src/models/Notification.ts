/**
 * Module purpose: Stores in-app notifications for users and related businesses/tasks; reminder keys prevent duplicate scheduled notifications.
 */
import { Schema, model, Types, InferSchemaType } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'REMINDER',
  'DUE_TODAY',
  'OVERDUE',
  'TASK_COMPLETED',
  'FILING_RECORDED',
  'DOCUMENT_UPLOADED',
  'INVITATION',
  'SYSTEM',
] as const;

const notificationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    businessId: { type: Types.ObjectId, ref: 'Business', index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    // Connects a reminder or update back to its compliance task.
    relatedTaskId: { type: Types.ObjectId, ref: 'ComplianceTask' },
    /** Reminder dedupe key, e.g. BEFORE_7 or OVERDUE_1. */
    reminderKey: { type: String },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// Only notifications with a reminderKey are deduplicated; normal notifications remain unrestricted.
notificationSchema.index(
  { userId: 1, relatedTaskId: 1, reminderKey: 1 },
  { unique: true, partialFilterExpression: { reminderKey: { $type: 'string' } } },
);
notificationSchema.index({ userId: 1, createdAt: -1 });

export type Notification = InferSchemaType<typeof notificationSchema>;
export const NotificationModel = model('Notification', notificationSchema);
