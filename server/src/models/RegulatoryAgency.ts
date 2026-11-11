/**
 * Module purpose: Stores government and regulatory agencies that issue compliance requirements.
 */
import { Schema, model, Types, InferSchemaType } from 'mongoose';

const agencySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    acronym: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    level: { type: String, enum: ['FEDERAL', 'STATE', 'LOCAL'], default: 'FEDERAL' },
    website: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    active: { type: Boolean, default: true },
    isSampleData: { type: Boolean, default: false },
    createdBy: { type: Types.ObjectId, ref: 'User' },
    updatedBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// The unique index is enforced by MongoDB, including concurrent requests.
agencySchema.index({ acronym: 1 }, { unique: true });
// Text index supports efficient name/keyword searching.
agencySchema.index({ name: 'text', acronym: 'text' });

export type RegulatoryAgency = InferSchemaType<typeof agencySchema>;
export const RegulatoryAgencyModel = model('RegulatoryAgency', agencySchema);
