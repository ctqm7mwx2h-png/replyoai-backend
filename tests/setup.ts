import { beforeAll, afterAll } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/replyoai_test';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_secret';
process.env.META_VERIFY_TOKEN = 'test_verify_token_12345';
process.env.META_APP_ID = 'test_meta_app_id';
process.env.META_APP_SECRET = 'test_meta_app_secret';
process.env.META_REDIRECT_URI = 'http://localhost:3000/api/meta/oauth/callback';

// Mock external services during testing
jest.mock('../src/utils/stripe.ts', () => ({
  stripe: {
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

// Mock Redis
jest.mock('../src/utils/redis.ts', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    disconnect: jest.fn(),
  },
}));

// Mock Sentry
jest.mock('../src/utils/sentry.ts', () => ({
  initSentry: jest.fn(),
  SentryLogger: {
    captureError: jest.fn(),
    captureMessage: jest.fn(),
    setBusinessContext: jest.fn(),
  },
  setupSentryMiddleware: jest.fn(),
  setupSentryErrorHandler: jest.fn(),
  businessContextMiddleware: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock Prisma Client
jest.mock('../src/models/index.ts', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    businessProfile: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    installation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aggregatedStats: {
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    jobQueue: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Global test setup
beforeAll(async () => {
  // Set test environment
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup after tests
  console.log('Cleaning up test environment...');
});