import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/validation.js';
import { prisma } from './models/index.js';
import { initSentry, setupSentryMiddleware, setupSentryErrorHandler, businessContextMiddleware } from './utils/sentry.js';
import { metricsHandler, healthCheckHandler, requestMetricsMiddleware } from './middleware/monitoring.js';
import { getRateLimitMiddleware } from './middleware/rateLimiting.js';
import { defaultLogger } from './utils/logger.js';

// Initialize error tracking
initSentry();

const app = express();

// Setup Sentry request handling (must be first)
setupSentryMiddleware(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate limiting (applied globally)
app.use(getRateLimitMiddleware('ddos'));

// Metrics middleware
app.use(requestMetricsMiddleware);

// Business context for Sentry
app.use(businessContextMiddleware);

// Special middleware for Stripe webhooks (raw body needed)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON middleware for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health and metrics endpoints (before API routes to avoid rate limiting)
app.get('/health', healthCheckHandler);
app.get('/metrics', metricsHandler);

// API routes
app.use(config.api.basePath, routes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'ReplyoAI Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      api: `${config.api.basePath}`,
      onboard: `${config.api.basePath}/onboard`,
      registerIg: `${config.api.basePath}/register-ig`,
      checkAccess: `${config.api.basePath}/check-access`,
      businessProfile: `${config.api.basePath}/business-profile`,
      getBusinessData: `${config.api.basePath}/get-business-data`,
      stripeWebhook: `${config.api.basePath}/webhooks/stripe`,
      dashboard: `${config.api.basePath}/dashboard`,
      billing: `${config.api.basePath}/billing`,
      conversations: `${config.api.basePath}/conversations`,
    },
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Sentry error handler (must be before other error handlers)
setupSentryErrorHandler(app);

// Global error handler
app.use(errorHandler);

// Database connection test
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    defaultLogger.info('Database connected successfully');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    defaultLogger.error(`Database connection failed: ${err.message}`);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    await testDatabaseConnection();
    
    const server = app.listen(config.port, () => {
      defaultLogger.info('Server started successfully', {
        port: config.port,
        environment: config.nodeEnv,
        apiBasePath: config.api.basePath,
        healthCheck: `http://localhost:${config.port}/health`,
        metrics: `http://localhost:${config.port}/metrics`,
      });
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      defaultLogger.info(`Received ${signal}, shutting down gracefully`);
      
      server.close(async () => {
        try {
          await prisma.$disconnect();
          defaultLogger.info('Server shutdown complete');
          process.exit(0);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          defaultLogger.error(`Error during shutdown: ${err.message}`);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    defaultLogger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  defaultLogger.error(`Unhandled error during server startup: ${err.message}`);
  process.exit(1);
});