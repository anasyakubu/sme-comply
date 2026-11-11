/**
 * Module purpose: Provides consistent timestamped logs for background work and server errors.
 */
/* eslint-disable no-console */
const ts = () => new Date().toISOString();

export const logger = {
  info: (...args: unknown[]) => process.env.NODE_ENV !== 'test' && console.log(`[${ts()}] INFO`, ...args),
  warn: (...args: unknown[]) => process.env.NODE_ENV !== 'test' && console.warn(`[${ts()}] WARN`, ...args),
  error: (...args: unknown[]) => console.error(`[${ts()}] ERROR`, ...args),
};
