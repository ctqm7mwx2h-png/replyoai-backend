import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Express, Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

/**
 * Initialize Sentry error tracking
 */
export function initSentry(): void {
  if (!config.sentry.dsn) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    integrations: [
      new ProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
    // Profiling sample rate
    profilesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
    // Release information
    release: process.env.npm_package_version || '1.0.0',
    // Additional context
    beforeSend(event, _hint) {
      // Filter out sensitive data
      if (event.request?.data) {
        const data = event.request.data;
        // Remove sensitive fields
        if (typeof data === 'object' && data !== null) {
          delete data.password;
          delete data.email;
          delete data.phone;
          delete data.stripe_secret_key;
        }
      }
      return event;
    },
  });

  console.log('Sentry error tracking initialized');
}

/**
 * Setup Sentry middleware for Express app
 */
export function setupSentryMiddleware(app: Express): void {
  if (!config.sentry.dsn) {
    return;
  }

  // Request handler must be first middleware
  app.use(Sentry.Handlers.requestHandler());

  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

/**
 * Setup Sentry error handler (must be after all other middleware)
 */
export function setupSentryErrorHandler(app: Express): void {
  if (!config.sentry.dsn) {
    return;
  }

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());
}

/**
 * Custom Sentry wrapper for business errors
 */
export class SentryLogger {
  static captureBusinessError(
    error: Error,
    context: {
      businessId?: string;
      userId?: string;
      operation?: string;
      additionalData?: Record<string, any>;
    }
  ): string {
    return Sentry.captureException(error, {
      tags: {
        component: 'business_logic',
        operation: context.operation || 'unknown',
      },
      extra: {
        businessId: context.businessId,
        userId: context.userId,
        ...context.additionalData,
      },
    });
  }

  static captureConversationError(
    error: Error,
    businessId: string,
    userId: string,
    messageData?: any
  ): string {
    return Sentry.captureException(error, {
      tags: {
        component: 'conversation',
        business: businessId,
      },
      extra: {
        businessId,
        userId,
        messageData,
      },
    });
  }

  static captureJobError(
    error: Error,
    jobType: string,
    jobData?: any
  ): string {
    return Sentry.captureException(error, {
      tags: {
        component: 'job_queue',
        job_type: jobType,
      },
      extra: {
        jobData,
      },
    });
  }

  static captureBillingError(
    error: Error,
    operation: string,
    customerId?: string,
    subscriptionId?: string
  ): string {
    return Sentry.captureException(error, {
      tags: {
        component: 'billing',
        operation,
      },
      extra: {
        customerId,
        subscriptionId,
      },
    });
  }

  static captureMessage(
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    context?: Record<string, any>
  ): string {
    return Sentry.withScope((scope) => {
      if (context) {
        scope.setExtra('context', context);
      }
      return Sentry.captureMessage(message, level);
    });
  }

  static addBreadcrumb(
    message: string,
    category: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  static setUserContext(userId: string, businessId?: string): void {
    Sentry.setUser({
      id: userId,
      business_id: businessId,
    });
  }

  static setBusinessContext(businessId: string, industry?: string): void {
    Sentry.setTag('business_id', businessId);
    if (industry) {
      Sentry.setTag('industry', industry);
    }
  }
}

/**
 * Express middleware to add business context to Sentry
 */
export function businessContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Extract business context from request
  const businessId = req.body?.business_id || req.params?.business_id || req.body?.ig_username;
  const userId = req.body?.user_id || req.params?.user_id;

  if (businessId) {
    SentryLogger.setBusinessContext(businessId);
  }

  if (userId) {
    SentryLogger.setUserContext(userId, businessId);
  }

  next();
}

// Export Sentry instance for direct use
export { Sentry };