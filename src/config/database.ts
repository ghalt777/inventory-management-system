import mongoose from 'mongoose';
import { logger } from './logger';

export class Database {
  private static instance: Database;
  private connected = false;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(uri: string): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      await mongoose.connect(uri);
      this.connected = true;
      logger.info('Connected to MongoDB');
    } catch (error) {
      logger.error('MongoDB connection error', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await mongoose.disconnect();
    this.connected = false;
    logger.info('Disconnected from MongoDB');
  }

  isConnected(): boolean {
    return this.connected;
  }
}

