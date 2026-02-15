import rateLimit from 'express-rate-limit';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../utils/redis.js';
import { config } from '../config/index.js';
import { Request, Response, NextFunction } from 'express';

/**
 * Redis-based rate limiter for business-specific limits
 */
class BusinessRateLimiter {
  private limiter: RateLimiterRedis;
  private keyPrefix: string;

  constructor(options: {
    keyPrefix: string;
    points: number;    // Number of requests
    duration: number;  // Per duration in seconds
  }) {
    this.keyPrefix = options.keyPrefix;
    this.limiter = new RateLimiterRedis({
      storeClient: redis,
      points: options.points,
      duration: options.duration,
      blockDuration: options.duration, // Block for same duration
    });
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const businessId = req.body?.ig_username || req.params?.ig_username || req.ip;
        const key = `${this.keyPrefix}:${businessId}`;
        
        await this.limiter.consume(key);
        next();
      } catch (rateLimiterRes: any) {
        const msBeforeNext = rateLimiterRes?.msBeforeNext || 60000;
        
        res.set('Retry-After', String(Math.round(msBeforeNext / 1000)));
        res.set('X-RateLimit-Limit', String(this.limiter.points));
        res.set('X-RateLimit-Reset', String(new Date(Date.now() + msBeforeNext)));

        res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.round(msBeforeNext / 1000),
        });
      }
    };
  }
}

// Create rate limiters for different endpoints
export const messageEndpointLimiter = new BusinessRateLimiter({
  keyPrefix: 'message-endpoint',
  points: config.defaults.RATE_LIMITS.MESSAGE_ENDPOINT.max,
  duration: config.defaults.RATE_LIMITS.MESSAGE_ENDPOINT.windowMs / 1000,
});

export const businessEndpointLimiter = new BusinessRateLimiter({
  keyPrefix: 'business-endpoint',
  points: config.defaults.RATE_LIMITS.BUSINESS_ENDPOINT.max,
  duration: config.defaults.RATE_LIMITS.BUSINESS_ENDPOINT.windowMs / 1000,
});

/**
 * Express rate limiting middleware (fallback for when Redis is unavailable)
 */
export const globalRateLimit = rateLimit({
  windowMs: config.defaults.RATE_LIMITS.GLOBAL.windowMs,
  max: config.defaults.RATE_LIMITS.GLOBAL.max,
  message: {
    success: false,
    error: 'Too many requests from this IP',
    message: 'Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health checks
  skip: (req: Request) => {
    return req.path === '/health' || req.path === '/metrics';
  },
  // Custom key generator to handle different scenarios
  keyGenerator: (req: Request) => {
    // Use business ID if available, otherwise use IP
    return req.body?.ig_username || req.params?.ig_username || req.ip;
  },
});

/**
 * Enhanced rate limiting with different tiers based on subscription
 */
export class TieredRateLimiter {
  private freeLimit: RateLimiterRedis;
  private paidLimit: RateLimiterRedis;

  constructor() {
    this.freeLimit = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'free-tier',
      points: 100, // 100 requests
      duration: 3600, // per hour
      blockDuration: 3600,
    });

    this.paidLimit = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'paid-tier',
      points: 1000, // 1000 requests
      duration: 3600, // per hour
      blockDuration: 600, // 10 minute block for paid users
    });
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // TODO: Check user's subscription status
        // For now, assume everyone is on free tier
        const isFreeTier = true;
        const limiter = isFreeTier ? this.freeLimit : this.paidLimit;

        await limiter.consume(req.body?.ig_username || req.ip);
        next();
      } catch (rateLimiterRes: any) {
        const msBeforeNext = rateLimiterRes?.msBeforeNext || 60000;
        
        res.set('Retry-After', String(Math.round(msBeforeNext / 1000)));
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Upgrade your plan for higher limits.',
          retryAfter: Math.round(msBeforeNext / 1000),
        });
      }
    };
  }
}

export const tieredRateLimit = new TieredRateLimiter();

/**
 * DDoS protection middleware
 */
export const ddosProtection = rateLimit({
  windowMs: 1000, // 1 second
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Slow down! You are making too many requests.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful responses
});

/**
 * Webhook-specific rate limiting
 */
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit webhooks to 100 per minute
  message: {
    success: false,
    error: 'Webhook rate limit exceeded',
  },
  keyGenerator: (req: Request): string => {
    // Use webhook source or IP
    return (req.headers['x-webhook-source'] as string) || req.ip || 'unknown';
  },
});

/**
 * Rate limiting for expensive operations (dashboard, exports)
 */
export const expensiveOperationLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per 5 minutes
  message: {
    success: false,
    error: 'Too many expensive operations',
    message: 'Please wait before requesting more data.',
  },
  keyGenerator: (req: Request): string => {
    return req.params?.ig_username || req.ip || 'unknown';
  },
});

/**
 * Middleware to apply appropriate rate limiting based on endpoint
 */
export function getRateLimitMiddleware(endpointType: string) {
  switch (endpointType) {
    case 'message':
      return config.features.enableRateLimit 
        ? messageEndpointLimiter.middleware()
        : (_req: Request, _res: Response, next: NextFunction) => next();
    
    case 'business':
      return config.features.enableRateLimit
        ? businessEndpointLimiter.middleware()
        : (_req: Request, _res: Response, next: NextFunction) => next();
    
    case 'webhook':
      return webhookRateLimit;
    
    case 'expensive':
      return expensiveOperationLimit;
    
    case 'ddos':
      return ddosProtection;
    
    default:
      return globalRateLimit;
  }
}