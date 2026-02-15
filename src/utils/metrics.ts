import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { config } from '../config/index.js';

// Create a custom registry
export const promRegister = register;

// Collect default metrics if enabled
if (config.defaults.METRICS.ENABLED && config.defaults.METRICS.COLLECT_DEFAULT_METRICS) {
  collectDefaultMetrics({ 
    register: promRegister,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });
}

// Custom metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [promRegister],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [...config.defaults.METRICS.BUCKETS],
  registers: [promRegister],
});

// Business metrics
export const totalConversations = new Counter({
  name: 'conversations_total',
  help: 'Total number of conversations processed',
  labelNames: ['business_id', 'industry'],
  registers: [promRegister],
});

export const qualifiedLeads = new Counter({
  name: 'qualified_leads_total',
  help: 'Total number of qualified leads generated',
  labelNames: ['business_id', 'industry', 'lead_type'],
  registers: [promRegister],
});

export const successfulBookings = new Counter({
  name: 'successful_bookings_total',
  help: 'Total number of successful bookings',
  labelNames: ['business_id', 'industry', 'service'],
  registers: [promRegister],
});

export const estimatedRevenue = new Counter({
  name: 'estimated_revenue_total',
  help: 'Total estimated revenue generated',
  labelNames: ['business_id', 'industry'],
  registers: [promRegister],
});

// Job queue metrics
export const jobsProcessed = new Counter({
  name: 'jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue_name', 'job_type', 'status'],
  registers: [promRegister],
});

export const queueLength = new Gauge({
  name: 'queue_length',
  help: 'Current length of job queues',
  labelNames: ['queue_name'],
  registers: [promRegister],
});

export const jobProcessingDuration = new Histogram({
  name: 'job_processing_duration_seconds',
  help: 'Time spent processing jobs',
  labelNames: ['queue_name', 'job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [promRegister],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint', 'business_id'],
  registers: [promRegister],
});

// Database metrics
export const dbQueriesTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table'],
  registers: [promRegister],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query execution time',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [promRegister],
});

// Active connections and sessions
export const activeSessions = new Gauge({
  name: 'active_sessions_total',
  help: 'Number of active conversation sessions',
  labelNames: ['business_id'],
  registers: [promRegister],
});

export const redisConnections = new Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections',
  registers: [promRegister],
});

/**
 * Metrics helper class for easy metric recording
 */
export class MetricsCollector {
  static recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    httpRequestsTotal.labels(method, route, statusCode.toString()).inc();
    httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration / 1000);
  }

  static recordConversation(businessId: string, industry: string): void {
    totalConversations.labels(businessId, industry).inc();
  }

  static recordQualifiedLead(businessId: string, industry: string, leadType: string): void {
    qualifiedLeads.labels(businessId, industry, leadType).inc();
  }

  static recordBooking(businessId: string, industry: string, service: string): void {
    successfulBookings.labels(businessId, industry, service).inc();
  }

  static recordRevenue(businessId: string, industry: string, amount: number): void {
    estimatedRevenue.labels(businessId, industry).inc(amount);
  }

  static recordJobProcessed(queueName: string, jobType: string, status: 'success' | 'failed', duration?: number): void {
    jobsProcessed.labels(queueName, jobType, status).inc();
    
    if (duration !== undefined) {
      jobProcessingDuration.labels(queueName, jobType).observe(duration / 1000);
    }
  }

  static updateQueueLength(queueName: string, length: number): void {
    queueLength.labels(queueName).set(length);
  }

  static recordError(type: string, endpoint: string, businessId?: string): void {
    errorsTotal.labels(type, endpoint, businessId || 'unknown').inc();
  }

  static recordDbQuery(operation: string, table: string, duration: number): void {
    dbQueriesTotal.labels(operation, table).inc();
    dbQueryDuration.labels(operation, table).observe(duration / 1000);
  }

  static updateActiveSessions(businessId: string, count: number): void {
    activeSessions.labels(businessId).set(count);
  }

  static updateRedisConnections(count: number): void {
    redisConnections.set(count);
  }
}

// Export middleware for easier use
export const metricsMiddleware = {
  recordRequest: MetricsCollector.recordHttpRequest,
  recordConversation: MetricsCollector.recordConversation,
  recordLead: MetricsCollector.recordQualifiedLead,
  recordBooking: MetricsCollector.recordBooking,
  recordRevenue: MetricsCollector.recordRevenue,
  recordJob: MetricsCollector.recordJobProcessed,
  recordError: MetricsCollector.recordError,
};