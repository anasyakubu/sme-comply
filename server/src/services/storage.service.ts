/**
 * Module purpose: Saves and removes files through Cloudinary or a local filesystem fallback.
 */
import fs from 'fs/promises';
import path from 'path';
import { cloudinary } from '../config/cloudinary';
import { env, isCloudinaryConfigured } from '../config/env';
import { randomToken } from '../utils/crypto';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

export interface StoredFile {
  url: string;
  publicId: string;
  storage: 'cloudinary' | 'local';
}

/**
 * Stores files in Cloudinary when configured, otherwise on local disk
 * (served from /uploads). Local storage is intended for development only.
 */
export const storageService = {
  async save(buffer: Buffer, originalName: string, businessId: string): Promise<StoredFile> {
    if (isCloudinaryConfigured) {
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { folder: `${env.CLOUDINARY_FOLDER}/${businessId}`, resource_type: 'auto', use_filename: true, unique_filename: true },
            (err, res) => (err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res)),
          )
          .end(buffer);
      });
      return { url: result.secure_url, publicId: result.public_id, storage: 'cloudinary' };
    }
    const ext = path.extname(originalName).toLowerCase();
    const dir = path.join(UPLOAD_DIR, businessId);
    await fs.mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${randomToken(8)}${ext}`;
    await fs.writeFile(path.join(dir, name), buffer);
    return { url: `${env.SERVER_URL}/uploads/${businessId}/${name}`, publicId: `${businessId}/${name}`, storage: 'local' };
  },

  async remove(publicId: string, storage: 'cloudinary' | 'local', fileType?: string): Promise<void> {
    if (storage === 'cloudinary') {
      const resourceType = fileType?.startsWith('image/') ? 'image' : 'raw';
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => undefined);
      return;
    }
    const target = path.resolve(UPLOAD_DIR, publicId);
    if (!target.startsWith(UPLOAD_DIR)) return; // path traversal guard
    await fs.unlink(target).catch(() => undefined);
  },
};
