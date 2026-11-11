/**
 * Module purpose: Provides reusable test setup and authenticated request helpers.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongo: MongoMemoryServer | null = null;

export async function startDb() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function stopDb() {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

export async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}
