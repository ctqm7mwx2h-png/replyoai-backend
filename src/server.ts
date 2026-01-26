import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/validation.js';
import { prisma } from './models/index.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Special middleware for Stripe webhooks (raw body needed)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON middleware for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use(config.api.basePath, routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ReplyoAI Backend API',
    version: '1.0.0',
    endpoints: {
      health: `${config.api.basePath}/health`,
      onboard: `${config.api.basePath}/onboard`,
      connectInstagram: `${config.api.basePath}/connect-instagram`,
      checkAccess: `${config.api.basePath}/check-access`,
      stripeWebhook: `${config.api.basePath}/webhooks/stripe`,
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Global error handler
app.use(errorHandler);

// Database connection test
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    await testDatabaseConnection();
    
    app.listen(config.port, () => {
      console.log(`🚀 ReplyoAI Backend running on port ${config.port}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`🔗 API Base Path: ${config.api.basePath}`);
      console.log(`🏥 Health Check: http://localhost:${config.port}${config.api.basePath}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
startServer();