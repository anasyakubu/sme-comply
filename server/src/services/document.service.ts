/**
 * Module purpose: Checks document ownership and permissions before storing, listing, or deleting files.
 */
import path from 'path';
import { Types } from 'mongoose';
import { documentRepository, taskRepository } from '../repositories';
import { hasValidSignature, isAllowedFile } from '../middleware/upload';
import { ApiError } from '../utils/ApiError';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { accessService } from './access.service';
import { AuditContext, auditService } from './audit.service';
import { storageService } from './storage.service';

export interface UploadInput {
  businessId: string;
  taskId?: string;
  documentType?: string;
  description?: string;
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const documentService = {
  /**
   * Validates the file and association before saving the uploaded document.
   */
  async upload(file: Express.Multer.File | undefined, input: UploadInput, user: Express.AuthUser, ctx: AuditContext) {
    if (!file) throw ApiError.badRequest('Choose a file to upload');
    if (!isAllowedFile(file.originalname, file.mimetype) || !hasValidSignature(file.buffer, file.originalname)) {
      throw ApiError.badRequest("This file's contents don't match its type. Upload a PDF, DOC, DOCX, JPG or PNG.");
    }
    await accessService.require(user, input.businessId, 'documents:upload');
    if (input.taskId) {
      const task = await taskRepository.findOne({ _id: input.taskId, businessId: input.businessId });
      if (!task) throw ApiError.badRequest('That task does not belong to this business');
    }
    const stored = await storageService.save(file.buffer, file.originalname, input.businessId);
    const safeName = path.basename(file.originalname).replace(/[^\w.\- ()]/g, '_').slice(0, 180);
    const doc = await documentRepository.create({
      businessId: input.businessId as any,
      taskId: (input.taskId as any) || undefined,
      uploadedBy: user.id as any,
      fileName: safeName,
      fileType: file.mimetype,
      fileSize: file.size,
      cloudinaryUrl: stored.url,
      publicId: stored.publicId,
      storage: stored.storage,
      documentType: (input.documentType as any) ?? 'OTHER',
      description: input.description,
      uploadedAt: new Date(),
    });
    await auditService.log(ctx, 'DOCUMENT_UPLOADED', 'Document', String(doc._id), {
      businessId: input.businessId,
      metadata: { fileName: safeName, taskId: input.taskId, size: file.size },
    });
    return doc;
  },

  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(user: Express.AuthUser, query: Record<string, unknown>) {
    const q = parseListQuery(query, ['uploadedAt', 'fileName', 'fileSize'], '-uploadedAt');
    const filter: Record<string, any> = {};
    const visible = await accessService.visibleBusinessIds(user);
    if (typeof query.businessId === 'string' && query.businessId) {
      if (visible && !visible.includes(query.businessId)) throw ApiError.notFound('Business not found');
      filter.businessId = new Types.ObjectId(query.businessId);
    } else if (visible) {
      filter.businessId = { $in: visible.map((id) => new Types.ObjectId(id)) };
    }
    if (typeof query.taskId === 'string' && Types.ObjectId.isValid(query.taskId)) filter.taskId = query.taskId;
    if (typeof query.documentType === 'string' && query.documentType) filter.documentType = query.documentType;
    if (q.search) filter.fileName = { $regex: escapeRegex(q.search), $options: 'i' };
    const { items, total } = await documentRepository.paginate(filter, {
      sort: q.sort,
      skip: q.skip,
      limit: q.limit,
      populate: [
        { path: 'uploadedBy', select: 'firstName lastName' },
        { path: 'taskId', select: 'title periodLabel' },
        { path: 'businessId', select: 'businessName' },
      ],
    });
    return { items, meta: pageMeta(q.page, q.limit, total) };
  },

  /**
   * Checks access and removes the requested entry.
   */
  async remove(id: string, user: Express.AuthUser, ctx: AuditContext) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw ApiError.notFound('Document not found');
    const access = await accessService.resolve(user, String(doc.businessId));
    if (!access) throw ApiError.notFound('Document not found');
    const isUploader = String(doc.uploadedBy) === user.id;
    if (!access.permissions.includes('documents:delete') && !isUploader) throw ApiError.forbidden();
    await storageService.remove(doc.publicId, doc.storage as 'cloudinary' | 'local', doc.fileType);
    await doc.deleteOne();
    await auditService.log(ctx, 'DOCUMENT_DELETED', 'Document', id, { businessId: String(doc.businessId), metadata: { fileName: doc.fileName } });
  },
};
