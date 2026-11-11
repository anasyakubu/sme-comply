/**
 * Module purpose: Checks file-upload limits and MIME types before forwarding documents to the storage service.
 */
import multer from 'multer';
import path from 'path';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export const ALLOWED_UPLOADS: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
};

/** Checks both the extension and the declared MIME type. */
export function isAllowedFile(originalName: string, mimeType: string): boolean {
  const ext = path.extname(originalName).toLowerCase();
  return Boolean(ALLOWED_UPLOADS[ext]?.includes(mimeType));
}

/** Checks the file's leading bytes so a renamed executable can't pass as a PDF. */
export function hasValidSignature(buffer: Buffer, originalName: string): boolean {
  const ext = path.extname(originalName).toLowerCase();
  const hex = buffer.subarray(0, 8).toString('hex');
  switch (ext) {
    case '.pdf':
      return buffer.subarray(0, 5).toString() === '%PDF-';
    case '.png':
      return hex.startsWith('89504e470d0a1a0a');
    case '.jpg':
    case '.jpeg':
      return hex.startsWith('ffd8ff');
    case '.docx':
      return hex.startsWith('504b0304'); // zip container
    case '.doc':
      return hex.startsWith('d0cf11e0a1b11ae1'); // OLE compound file
    default:
      return false;
  }
}

export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedFile(file.originalname, file.mimetype)) {
      return cb(ApiError.badRequest('Only PDF, DOC, DOCX, JPG and PNG files can be uploaded'));
    }
    cb(null, true);
  },
}).single('file');
