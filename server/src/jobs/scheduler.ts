/**
 * Module purpose: Runs and schedules the daily job that generates tasks, refreshes statuses, and sends configured automatic reminders.
 */
import cron from 'node-cron';
import { env } from '../config/env';
import { reminderService } from '../services/reminder.service';
import { taskGenerationService } from '../services/taskGeneration.service';
import { logger } from '../utils/logger';

let running = false;

/** Daily job: roll task windows forward, refresh statuses, then send reminders. */
export async function runDailyComplianceJob() {
  if (running) {
    logger.warn('Compliance job already running; skipping this tick');
    return null;
  }
  running = true;
  try {
    const generation = await taskGenerationService.generateForAll();
    const statuses = await taskGenerationService.refreshStatuses();
    const reminders = await reminderService.run();
    return { generation, statuses, reminders };
  } catch (err) {
    logger.error('Compliance job failed', err);
    return null;
  } finally {
    running = false;
  }
}

/**
 * Registers the scheduled job using the application timezone; manual messages use a separate endpoint.
 */
// The scheduler uses a timezone-aware cadence; it is not needed for a Super Admin to send mail.
export function startScheduler() {
  if (!env.ENABLE_JOBS) {
    logger.info('Scheduled jobs disabled (ENABLE_JOBS=false)');
    return;
  }
  if (!cron.validate(env.REMINDER_CRON)) {
    logger.error(`Invalid REMINDER_CRON "${env.REMINDER_CRON}"; scheduler not started`);
    return;
  }
  cron.schedule(env.REMINDER_CRON, () => void runDailyComplianceJob(), { timezone: env.APP_TIMEZONE });
  // Hourly status refresh keeps OVERDUE accurate even between daily runs.
  cron.schedule('5 * * * *', () => void taskGenerationService.refreshStatuses().catch((e) => logger.error(e)), { timezone: env.APP_TIMEZONE });
  logger.info(`Scheduler started: "${env.REMINDER_CRON}" (${env.APP_TIMEZONE})`);
}
