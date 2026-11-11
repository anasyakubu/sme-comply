/**
 * Module purpose: Stores administrator-managed options, such as business types and industries, used by validated input forms.
 */
import { Schema, model, InferSchemaType } from 'mongoose';

/** Admin-configurable dropdown values such as business types and industries. */
const lookupSchema = new Schema(
  {
    kind: { type: String, enum: ['BUSINESS_TYPE', 'INDUSTRY'], required: true, index: true },
    value: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// The unique index is enforced by MongoDB, including concurrent requests.
lookupSchema.index({ kind: 1, value: 1 }, { unique: true });

export type LookupValue = InferSchemaType<typeof lookupSchema>;
export const LookupValueModel = model('LookupValue', lookupSchema);
