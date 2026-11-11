/**
 * Module purpose: Configures Cloudinary credentials for managed document storage; file uploads can fall back to local storage when unavailable.
 */
import { v2 as cloudinary } from 'cloudinary';
import { env, isCloudinaryConfigured } from './env';

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };
