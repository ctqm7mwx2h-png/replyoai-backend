import Redis from 'ioredis';
import { config } from '../config/index.js';

class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis(config.redis.url, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        // Add connection event handlers
        connectTimeout: 10000,
        commandTimeout: 5000,
      });

      this.instance.on('connect', () => {
        console.log('Redis connected successfully');
      });

      this.instance.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      this.instance.on('ready', () => {
        console.log('Redis is ready');
      });

      this.instance.on('close', () => {
        console.log('Redis connection closed');
      });
    }

    return this.instance;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
    }
  }

  static async isConnected(): Promise<boolean> {
    try {
      if (!this.instance) return false;
      await this.instance.ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const redis = RedisClient.getInstance();
export { RedisClient };