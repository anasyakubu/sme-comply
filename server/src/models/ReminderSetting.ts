/**
 * Module purpose: Stores per-business automatic reminder preferences; it does not control the separate manual-email feature.
 */
import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { DEFAULT_REMINDER_OFFSETS } from '../config/constants';

const reminderSettingSchema = new Schema(
  {
    // Unique business reference ensures one automatic-reminder configuration per business.
    businessId: { type: Types.ObjectId, ref: 'Business', required: true, unique: true },
    daysBefore: { type: [Number], default: DEFAULT_REMINDER_OFFSETS },
    remindWhenOverdue: { type: Boolean, default: true },
    // Controls scheduled emails only; Super Admin manual sends do not use this toggle.
    emailEnabled: { type: Boolean, default: true },
    inAppEnabled: { type: Boolean, default: true },
    updatedBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

export type ReminderSetting = InferSchemaType<typeof reminderSettingSchema>;
export const ReminderSettingModel = model('ReminderSetting', reminderSettingSchema);
