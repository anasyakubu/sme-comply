/**
 * Module purpose: Stores traceable records of who changed a resource, what was changed, and when.
 */
import { Schema, model, Types, InferSchemaType } from 'mongoose';

const auditLogSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String },
    businessId: { type: Types.ObjectId, ref: 'Business', index: true },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { toJSON: { versionKey: false } },
);

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel = model('AuditLog', auditLogSchema);
