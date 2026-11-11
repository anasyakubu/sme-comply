/**
 * Module purpose: Creates random tokens and one-way hashes for security-sensitive token workflows.
 */
import crypto from 'crypto';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
