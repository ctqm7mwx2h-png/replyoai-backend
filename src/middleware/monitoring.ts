import { Request, Response, NextFunction } from 'express';
import { promRegister, metricsMiddleware } from '../utils/metrics';

/**
 * Metrics endpoint handler
 * GET /metrics - Prometheus metrics endpoint
 */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const metrics = await promRegister.metrics();
    res.set('Content-Type', promRegister.contentType);
    res.end(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to generate metrics',
    });
  }
}

/**
 * Health check endpoint handler
 * GET /health - Basic health check
 */
export function healthCheckHandler(_req: Request, res: Response): void {
  const healthData = {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: 'pending', // TODO: Add actual DB health check
      redis: 'pending',    // TODO: Add actual Redis health check
    },
  };

  res.json(healthData);
}

/**
 * Middleware to track request metrics
 */
export function requestMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Override res.end to capture response time and status
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
    const duration = Date.now() - start;
    
    // Track metrics using our metrics utility
    if (metricsMiddleware) {
      metricsMiddleware.recordRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration
      );
    }

    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
}