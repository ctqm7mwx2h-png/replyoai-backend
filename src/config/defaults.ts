/**
 * Default configuration values for the enterprise platform
 */

export const DEFAULT_CONFIG = {
  // Revenue estimation defaults
  REVENUE: {
    DEFAULT_CONVERSION_MULTIPLIER: 0.65, // 65% of booking clicks convert to paid customers
    DEFAULT_AVG_ORDER_VALUE: {
      beauty: 150,
      hair: 120,
      fitness: 80,
      cleaning: 200,
      plumbing: 300,
      electrical: 250,
      detailing: 180,
      default: 150,
    },
  },

  // Business tiers and pricing
  PRICING: {
    TIERS: {
      starter: {
        price: 29,
        currency: 'GBP',
        features: ['basic_conversations', 'email_support', 'basic_analytics'],
        limits: {
          conversations_per_month: 500,
          follow_ups: true,
        },
      },
      growth: {
        price: 59,
        currency: 'GBP',
        features: ['advanced_conversations', 'priority_support', 'advanced_analytics', 'custom_templates'],
        limits: {
          conversations_per_month: 2000,
          follow_ups: true,
        },
      },
      pro: {
        price: 99,
        currency: 'GBP',
        features: ['unlimited_conversations', 'white_label', 'api_access', 'custom_integration'],
        limits: {
          conversations_per_month: -1, // Unlimited
          follow_ups: true,
        },
      },
    },
  },

  // Job queue settings
  JOBS: {
    FOLLOW_UP_DELAYS: {
      first: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
      second: 48 * 60 * 60 * 1000, // 48 hours in milliseconds
    },
    STATS_AGGREGATION_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
    MAX_ATTEMPTS: 3,
    DEFAULT_TTL: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Rate limiting
  RATE_LIMITS: {
    MESSAGE_ENDPOINT: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Max requests per window
    },
    BUSINESS_ENDPOINT: {
      windowMs: 60 * 1000, // 1 minute
      max: 10, // Max requests per minute per IP
    },
    GLOBAL: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Max requests per window per IP
    },
  },

  // Email templates
  EMAIL_TEMPLATES: {
    ONBOARDING: [
      {
        delay: 0, // Send immediately
        subject: 'Welcome to ReplyoAI - Let\'s get you set up!',
        template: 'welcome',
      },
      {
        delay: 24 * 60 * 60 * 1000, // 24 hours
        subject: 'Quick setup guide for your Instagram automation',
        template: 'setup_guide',
      },
      {
        delay: 3 * 24 * 60 * 60 * 1000, // 72 hours
        subject: 'How to maximize bookings with ReplyoAI',
        template: 'best_practices',
      },
    ],
  },

  // Cache settings
  CACHE: {
    BUSINESS_CONFIG_TTL: 5 * 60 * 1000, // 5 minutes
    SESSION_TTL: 30 * 60 * 1000, // 30 minutes
    MAX_CACHE_SIZE: 1000,
  },

  // Observability
  METRICS: {
    ENABLED: true,
    COLLECT_DEFAULT_METRICS: true,
    BUCKETS: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // Response time buckets in seconds
  },

  // Security
  SECURITY: {
    BCRYPT_ROUNDS: 12,
    JWT_EXPIRY: '24h',
    CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  },
} as const;

export type ConfigType = typeof DEFAULT_CONFIG;