/**
 * Module purpose: Represents a registered SME; its owner references a User, and business fields feed applicability checks in the rule engine.
 */
import { Schema, model, Types, InferSchemaType, HydratedDocument } from 'mongoose';

const businessSchema = new Schema(
  {
    businessName: { type: String, required: true, trim: true, maxlength: 150 },
    legalName: { type: String, trim: true, maxlength: 200 },
    registrationNumber: { type: String, trim: true },
    taxIdentificationNumber: { type: String, trim: true },
    businessType: { type: String, required: true, trim: true },
    industry: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    dateOfIncorporation: { type: Date },
    employeeCount: { type: Number, default: 0, min: 0 },
    annualTurnover: { type: Number, default: 0, min: 0 },
    businessStatus: { type: String, enum: ['ACTIVE', 'DORMANT', 'CLOSED'], default: 'ACTIVE' },
    // Registration and activity flags are facts used by regulatory applicability rules.
    flags: {
      cacRegistered: { type: Boolean, default: false },
      taxRegistered: { type: Boolean, default: false },
      vatRegistered: { type: Boolean, default: false },
      pensionRegistered: { type: Boolean, default: false },
      regulatedProducts: { type: Boolean, default: false },
      importsExports: { type: Boolean, default: false },
    },
    // References the user who owns the business; membership records grant additional users access.
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// Text index supports efficient name/keyword searching.
businessSchema.index({ businessName: 'text', legalName: 'text', registrationNumber: 'text' });
businessSchema.index({ state: 1, businessType: 1 });

export type Business = InferSchemaType<typeof businessSchema>;
export type BusinessDocument = HydratedDocument<Business>;
export const BusinessModel = model('Business', businessSchema);
