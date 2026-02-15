import winston from 'winston';
import { config } from '../config/index.js';

/**
 * Configure Winston logger with structured JSON logging
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: {
    service: 'replyoai-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
        })
      )
    }),
  ],
});

// Add file transport for production
if (config.nodeEnv === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: logFormat
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: logFormat
  }));
}

/**
 * Logger wrapper with business context
 */
export class Logger {
  private context: Record<string, any>;

  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  private formatMessage(message: string, meta: Record<string, any> = {}): [string, Record<string, any>] {
    return [message, { ...this.context, ...meta }];
  }

  debug(message: string, meta: Record<string, any> = {}): void {
    const [msg, metaData] = this.formatMessage(message, meta);
    logger.debug(msg, metaData);
  }

  info(message: string, meta: Record<string, any> = {}): void {
    const [msg, metaData] = this.formatMessage(message, meta);
    logger.info(msg, metaData);
  }

  warn(message: string, meta: Record<string, any> = {}): void {
    const [msg, metaData] = this.formatMessage(message, meta);
    logger.warn(msg, metaData);
  }

  error(message: string, error?: Error, meta: Record<string, any> = {}): void {
    const [msg, metaData] = this.formatMessage(message, meta);
    logger.error(msg, {
      ...metaData,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    });
  }

  // Business-specific logging methods
  logConversation(businessId: string, userId: string, action: string, meta: Record<string, any> = {}): void {
    this.info(`Conversation ${action}`, {
      businessId,
      userId,
      action,
      type: 'conversation',
      ...meta,
    });
  }

  logBooking(businessId: string, userId: string, service: string, meta: Record<string, any> = {}): void {
    this.info('Booking generated', {
      businessId,
      userId,
      service,
      type: 'booking',
      ...meta,
    });
  }

  logRevenue(businessId: string, amount: number, meta: Record<string, any> = {}): void {
    this.info('Revenue estimated', {
      businessId,
      amount,
      type: 'revenue',
      ...meta,
    });
  }

  logJob(jobType: string, status: string, duration?: number, meta: Record<string, any> = {}): void {
    this.info(`Job ${status}`, {
      jobType,
      status,
      duration,
      type: 'job',
      ...meta,
    });
  }
}

// Export default logger instance
export const defaultLogger = new Logger();

// Export specific business loggers
export const conversationLogger = new Logger({ component: 'conversation' });
export const revenueLogger = new Logger({ component: 'revenue' });
export const jobLogger = new Logger({ component: 'jobs' });
export const billingLogger = new Logger({ component: 'billing' });

// Export Winston logger for advanced use
export { logger as winstonLogger };