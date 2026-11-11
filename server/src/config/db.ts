/**
 * Module purpose: Connects to and disconnects from MongoDB through Mongoose. The server waits for a database connection before serving API requests.
 */
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';
import { EmailLogModel } from '../models/EmailLog';

/**
 * Opens the MongoDB connection before the app accepts requests.
 */
export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  // Delivery idempotency must be enforced by MongoDB even if autoIndex is off.
  await EmailLogModel.createIndexes();
  logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

/**
 * Closes MongoDB cleanly during server shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
