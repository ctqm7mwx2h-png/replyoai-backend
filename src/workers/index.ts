#!/usr/bin/env node

/**
 * Background worker process for job queue processing
 */

import { config } from '../config/index.js';
import { createWorkers } from '../services/job-queue.service.js';
import { initSentry } from '../utils/sentry.js';
import { defaultLogger, jobLogger } from '../utils/logger.js';
import { MetricsCollector } from '../utils/metrics.js';

// Initialize error tracking
initSentry();

// Graceful shutdown handling
let workers: ReturnType<typeof createWorkers>;
let isShuttingDown = false;

async function startWorkers(): Promise<void> {
  try {
    defaultLogger.info('Starting background workers...', {
      environment: config.nodeEnv,
      features: config.features,
    });

    // Create and start workers
    workers = createWorkers();

    // Log worker startup
    jobLogger.info('All workers started successfully', {
      workers: ['followUpWorker', 'statsWorker', 'emailWorker'],
    });

    // Monitor queue lengths periodically
    if (config.features.enableMetrics) {
      setInterval(async () => {
        try {
          // Update queue metrics
          // This would typically query the actual queue lengths
          MetricsCollector.updateQueueLength('follow-up', 0);
          MetricsCollector.updateQueueLength('stats-aggregation', 0);
          MetricsCollector.updateQueueLength('onboarding-email', 0);
        } catch (error) {
          jobLogger.error('Error updating queue metrics', error);
        }
      }, 30000); // Every 30 seconds
    }

    defaultLogger.info('Background worker process initialized successfully');

  } catch (error) {
    defaultLogger.error('Failed to start workers', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  defaultLogger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    if (workers) {
      // Close workers gracefully
      await Promise.all([
        workers.followUpWorker.close(),
        workers.statsWorker.close(),
        workers.emailWorker.close(),
      ]);

      defaultLogger.info('All workers closed successfully');
    }
  } catch (error) {
    defaultLogger.error('Error during graceful shutdown', error);
  }

  process.exit(0);
}

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  defaultLogger.error('Uncaught exception in worker process', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  defaultLogger.error('Unhandled rejection in worker process', reason as Error, {
    promise: promise.toString(),
  });
});

// Start the workers
startWorkers().catch((error) => {
  defaultLogger.error('Failed to initialize worker process', error);
  process.exit(1);
});

export {}; // Make this a module