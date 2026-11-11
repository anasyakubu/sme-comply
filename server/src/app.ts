/**
 * Module purpose: Assembles the Express application: security headers, CORS, parsing, rate limits, API routes, and centralized error handling.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFound } from './middleware/error';
import { sanitizeInput } from './middleware/sanitize';
import { apiLimiter } from './middleware/rateLimit';
import { UPLOAD_DIR } from './services/storage.service';
import { openApiSpec } from './docs/openapi';

/**
 * Configures and returns the Express app so tests can exercise routes without starting a listening server.
 */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const allowed = env.CLIENT_URL.split(',').map((s) => s.trim());
  app.use(
    cors({
      origin: (origin, cb) => (!origin || allowed.includes(origin) ? cb(null, true) : cb(new Error('Origin not allowed by CORS'))),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(sanitizeInput);
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => res.json({ success: true, message: 'OK', data: { uptime: process.uptime() } }));
  app.use('/uploads', express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny' }));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'SME Comply API' }));
  app.get('/api-docs.json', (_req, res) => res.json(openApiSpec));
  // All versioned endpoints share the global rate limiter; route-level middleware adds stricter checks as needed.
  app.use('/api/v1', apiLimiter, routes);

  // The 404 and centralized error handlers run after routes so any thrown errors reach a consistent response.
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
