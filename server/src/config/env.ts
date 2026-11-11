/**
 * Module purpose: Validates environment variables on startup. SMTP credentials and other secrets must stay on the server, never in frontend code.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  APP_NAME: z.string().default('SME Comply'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  SERVER_URL: z.string().default('http://localhost:5000'),
  APP_TIMEZONE: z.string().default('Africa/Lagos'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/sme_comply'),
  JWT_ACCESS_SECRET: z.string().min(8).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(8).default('dev-refresh-secret-change-me'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(7),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().default('SME Comply <no-reply@smecomply.ng>'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  CLOUDINARY_FOLDER: z.string().default('sme-comply'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  REMINDER_CRON: z.string().default('0 7 * * *'),
  ENABLE_JOBS: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  TASK_HORIZON_MONTHS: z.coerce.number().default(12),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === 'production') {
  if (env.JWT_ACCESS_SECRET.startsWith('dev-') || env.JWT_REFRESH_SECRET.startsWith('dev-')) {
    // eslint-disable-next-line no-console
    console.error('Refusing to start: set real JWT secrets in production.');
    process.exit(1);
  }
}

export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
export const isSmtpConfigured = Boolean(env.SMTP_HOST);
