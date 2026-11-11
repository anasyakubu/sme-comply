/**
 * Vercel Express entry point.
 *
 * The regular src/server.ts keeps the local Node.js server and node-cron schedule.
 * Vercel uses this default-exported Express app instead: no app.listen() and no
 * long-running node-cron process are started in a serverless function.
 */
import express from 'express';
import mongoose from 'mongoose';
import { createApp } from './src/app';
import { connectDatabase } from './src/config/db';
import { runDailyComplianceJob } from './src/jobs/scheduler';

const app = express();

// Concurrent requests in the same warm instance share a single connection attempt.
// A failed attempt is cleared, allowing a later request to retry.
let databasePromise: Promise<void> | undefined;

async function ensureDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (!databasePromise) {
    databasePromise = connectDatabase().finally(() => {
      databasePromise = undefined;
    });
  }
  await databasePromise;
}

// Public landing route verifies the Vercel function booted without requiring a DB.
// /health below goes through the DB guard and checks API + database readiness.
app.get('/', (_req, res) => {
  res.json({ success: true, service: 'SME Comply API', health: '/health', api: '/api/v1' });
});

// Vercel Cron: GET at 06:00 UTC, which is 07:00 in Africa/Lagos (WAT).
// CRON_SECRET is provided in the Authorization header by Vercel Cron.
app.get('/internal/cron/daily', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    await ensureDatabase();
    const result = await runDailyComplianceJob();
    if (result === null) {
      res.status(503).json({ success: false, message: 'Daily compliance job was skipped or failed' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Vercel daily compliance job failed:', err);
    res.status(503).json({ success: false, message: 'Daily compliance job could not connect to the database' });
  }
});

// Keep database access ready before processing application requests. Let OPTIONS
// through so the child app's CORS middleware can serve browser preflight requests.
app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  try {
    await ensureDatabase();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    res.status(503).json({ success: false, message: 'Database temporarily unavailable' });
  }
});

// Reuse every existing /api/v1, /health and /api-docs.json route unchanged.
app.use(createApp());

export default app;
