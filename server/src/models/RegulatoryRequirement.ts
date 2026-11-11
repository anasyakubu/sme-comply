/**
 * Module purpose: Defines each regulatory obligation: frequency, due-date rule, applicability conditions, required evidence, and issuing agency.
 */
import { Schema, model, Types, InferSchemaType, HydratedDocument } from 'mongoose';
import { FREQUENCIES, REQUIREMENT_CATEGORIES } from '../config/constants';

const requirementSchema = new Schema(
  {
    agencyId: { type: Types.ObjectId, ref: 'RegulatoryAgency', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    category: { type: String, enum: REQUIREMENT_CATEGORIES, required: true },
    frequency: { type: String, enum: FREQUENCIES, required: true },
    /** Only used when frequency is CUSTOM. */
    customIntervalMonths: { type: Number, min: 1, max: 12 },
    /** Data-driven due rule, e.g. { type: 'DAY_OF_MONTH', day: 21, monthOffset: 1 }. */
    dueRule: { type: Schema.Types.Mixed, required: true },
    /** Rule group evaluated against business facts; empty = applies to everyone. */
    applicabilityRules: { type: Schema.Types.Mixed, default: { match: 'ALL', conditions: [] } },
    requiredDocuments: [{ type: String, trim: true }],
    penaltyInformation: { type: String, trim: true },
    officialWebsite: { type: String, trim: true },
    guidanceUrl: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    effectiveFrom: { type: Date },
    effectiveUntil: { type: Date },
    isSampleData: { type: Boolean, default: false },
    createdBy: { type: Types.ObjectId, ref: 'User' },
    updatedBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// The unique index is enforced by MongoDB, including concurrent requests.
// Codes are unique so requirements can be identified consistently across updates.
requirementSchema.index({ code: 1 }, { unique: true });
// Text index supports efficient name/keyword searching.
requirementSchema.index({ name: 'text', code: 'text', description: 'text' });

export type RegulatoryRequirement = InferSchemaType<typeof requirementSchema>;
export type RequirementDocument = HydratedDocument<RegulatoryRequirement>;
export const RegulatoryRequirementModel = model('RegulatoryRequirement', requirementSchema);
