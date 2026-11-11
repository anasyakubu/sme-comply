/**
 * Module purpose: Records submissions for compliance tasks and links associated evidence documents and the user who filed them.
 */
import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { FILING_STATUSES } from '../config/constants';

const filingRecordSchema = new Schema(
  {
    // Identifies the compliance task for which evidence of filing was submitted.
    taskId: { type: Types.ObjectId, ref: 'ComplianceTask', required: true, index: true },
    businessId: { type: Types.ObjectId, ref: 'Business', required: true, index: true },
    filedBy: { type: Types.ObjectId, ref: 'User', required: true },
    filingDate: { type: Date, required: true },
    referenceNumber: { type: String, trim: true },
    status: { type: String, enum: FILING_STATUSES, default: 'SUBMITTED' },
    notes: { type: String, trim: true, maxlength: 2000 },
    submittedTo: { type: String, trim: true },
    amountPaid: { type: Number, min: 0 },
    // Optional references to document records accompanying the submission.
    documents: [{ type: Types.ObjectId, ref: 'Document' }],
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

filingRecordSchema.index({ businessId: 1, filingDate: -1 });
// Text index supports efficient name/keyword searching.
filingRecordSchema.index({ referenceNumber: 'text', notes: 'text' });

export type FilingRecord = InferSchemaType<typeof filingRecordSchema>;
export const FilingRecordModel = model('FilingRecord', filingRecordSchema);
