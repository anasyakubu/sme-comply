/**
 * Module purpose: Sets safe environment defaults before test modules are loaded.
 */
process.env.NODE_ENV = 'test';
process.env.ENABLE_JOBS = 'false';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-123456';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123456';
process.env.APP_TIMEZONE = 'Africa/Lagos';
process.env.SMTP_HOST = '';
process.env.CLOUDINARY_CLOUD_NAME = '';
