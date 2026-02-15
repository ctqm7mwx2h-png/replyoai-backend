import dotenv from 'dotenv';
import { DEFAULT_CONFIG } from './defaults.js';

// Load environment variables first
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL!,
  
  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  
  // Meta (Facebook/Instagram)
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN!,
  },
  
  // Sentry
  sentry: {
    dsn: process.env.SENTRY_DSN || null,
    environment: process.env.NODE_ENV || 'development',
  },
  
  // Email (SMTP)
  email: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@replyoai.com',
  },
  
  // API
  api: {
    basePath: process.env.API_BASE_PATH || '/api',
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || DEFAULT_CONFIG.SECURITY.CORS_ORIGINS,
  },
  
  // Feature flags
  features: {
    enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
    enableJobs: process.env.ENABLE_JOBS !== 'false',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
  },
  
  // Revenue estimation
  revenue: {
    defaultConversionMultiplier: parseFloat(process.env.DEFAULT_CONVERSION_MULTIPLIER || '0.65'),
    avgOrderValues: {
      ...DEFAULT_CONFIG.REVENUE.DEFAULT_AVG_ORDER_VALUE,
      // Allow override per industry via env vars
      beauty: parseFloat(process.env.AOV_BEAUTY || String(DEFAULT_CONFIG.REVENUE.DEFAULT_AVG_ORDER_VALUE.beauty)),
      hair: parseFloat(process.env.AOV_HAIR || String(DEFAULT_CONFIG.REVENUE.DEFAULT_AVG_ORDER_VALUE.hair)),
      fitness: parseFloat(process.env.AOV_FITNESS || String(DEFAULT_CONFIG.REVENUE.DEFAULT_AVG_ORDER_VALUE.fitness)),
      cleaning: parseFloat(process.env.AOV_CLEANING || String(DEFAULT_CONFIG.REVENUE.DEFAULT_AVG_ORDER_VALUE.cleaning)),
      plumbing: parseFloat(process.env.AOV_PLUMBING || String(DEFAULT_CONFIG.REVENUE.DEFAULT_AVG_ORDER_VALUE.plumbing)),
      electrical: parseFloat(process.env.AOV_ELECTRICAL || String(DEFAULT_CONFIG.REVENUE.DEFAULT_AVG_ORDER_VALUE.electrical)),
      detailing: parseFloat(process.env.AOV_DETAILING || String(DEFAULT_CONFIG.REVENUE.DEFAULT_AVG_ORDER_VALUE.detailing)),
    },
  },
  
  // Default config values
  defaults: DEFAULT_CONFIG,
} as const;

// Validate required environment variables
function validateConfig() {
  const required = [
    'DATABASE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'META_VERIFY_TOKEN',
  ] as const;

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();