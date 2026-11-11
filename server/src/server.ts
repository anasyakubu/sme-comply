/**
 * Module purpose: Starts the HTTP server after database initialization and starts the scheduled compliance job, with graceful shutdown handling.
 */
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { startScheduler } from './jobs/scheduler';
import { logger } from './utils/logger';

async function main() {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`SME Comply API listening on ${env.SERVER_URL} (docs: ${env.SERVER_URL}/api-docs)`);
  });
  startScheduler();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
