/**
 * Module purpose: Stores each generated or manually managed obligation for a business and reporting period, with due date, assignment, notes, and progress.
 */
import { Schema, model, Types, InferSchemaType, HydratedDocument } from 'mongoose';
import { TASK_PRIORITIES, TASK_STATUSES } from '../config/constants';

const complianceTaskSchema = new Schema(
  {
    // Every task belongs to one business.
    businessId: { type: Types.ObjectId, ref: 'Business', required: true, index: true },
    // Links the task to the regulatory rule that produced its deadline.
    requirementId: { type: Types.ObjectId, ref: 'RegulatoryRequirement', required: true, index: true },
    agencyId: { type: Types.ObjectId, ref: 'RegulatoryAgency', index: true },
    title: { type: String, required: true },
    category: { type: String },
    // Identifies the reporting period; together with business and requirement this makes generated tasks unique.
    period: { type: String, required: true },
    periodLabel: { type: String },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    dueDate: { type: Date, required: true, index: true },
    status: { type: String, enum: TASK_STATUSES, default: 'UPCOMING', index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'LOW' },
    // Optional user responsible for following up on this obligation.
    assignedTo: { type: Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    completedBy: { type: Types.ObjectId, ref: 'User' },
    notes: [
      {
        body: { type: String, required: true, maxlength: 2000 },
        author: { type: Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    generatedAutomatically: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// One task per business, requirement and period — the guard against duplicates.
// This compound index makes task generation idempotent across repeated jobs.
complianceTaskSchema.index({ businessId: 1, requirementId: 1, period: 1 }, { unique: true });
complianceTaskSchema.index({ businessId: 1, status: 1, dueDate: 1 });
// Text index supports efficient name/keyword searching.
complianceTaskSchema.index({ title: 'text' });

export type ComplianceTask = InferSchemaType<typeof complianceTaskSchema>;
export type ComplianceTaskDocument = HydratedDocument<ComplianceTask>;
export const ComplianceTaskModel = model('ComplianceTask', complianceTaskSchema);
