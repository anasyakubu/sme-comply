/**
 * Module purpose: Stores document metadata and links uploaded evidence to a business, task, or filing record.
 */
import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { DOCUMENT_TYPES } from '../config/constants';

const documentSchema = new Schema(
  {
    // Optional compliance task to which the evidence belongs.
    taskId: { type: Types.ObjectId, ref: 'ComplianceTask', index: true },
    businessId: { type: Types.ObjectId, ref: 'Business', required: true, index: true },
    // Optional filing record that includes this document.
    filingId: { type: Types.ObjectId, ref: 'FilingRecord' },
    uploadedBy: { type: Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    /** Public URL — a Cloudinary URL, or a local /uploads URL when Cloudinary isn't configured. */
    cloudinaryUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    storage: { type: String, enum: ['cloudinary', 'local'], default: 'cloudinary' },
    documentType: { type: String, enum: DOCUMENT_TYPES, default: 'OTHER' },
    description: { type: String, trim: true, maxlength: 500 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// Text index supports efficient name/keyword searching.
documentSchema.index({ fileName: 'text', description: 'text' });

export type ComplianceDocument = InferSchemaType<typeof documentSchema>;
export const DocumentModel = model('Document', documentSchema);
