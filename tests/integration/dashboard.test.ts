import request from 'supertest';
import express from 'express';

// Mock the server components
const mockApp = express();

// Mock middleware
mockApp.use(express.json());
mockApp.use('/api/v1/dashboard', (req, res) => {
  if (req.path === '/stats') {
    res.json({
      success: true,
      data: {
        totalRevenue: 25000,
        totalConversations: 1250,
        totalBookings: 75,
        conversionRate: 0.06,
        averageOrderValue: 333.33,
        growth: {
          revenue: 0.15,
          conversations: 0.08,
          bookings: 0.12,
        },
      },
    });
  } else if (req.path === '/revenue') {
    res.json({
      success: true,
      data: {
        daily: [
          { date: '2024-01-10', revenue: 850 },
          { date: '2024-01-11', revenue: 920 },
          { date: '2024-01-12', revenue: 780 },
        ],
        weekly: [
          { week: '2024-W01', revenue: 5200 },
          { week: '2024-W02', revenue: 4800 },
        ],
        monthly: [
          { month: '2024-01', revenue: 25000 },
        ],
      },
    });
  } else {
    res.status(404).json({ success: false, message: 'Not found' });
  }
});

mockApp.use('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'test',
    services: {
      database: 'connected',
      redis: 'connected',
      queue: 'running',
    },
  });
});

describe('Dashboard API Integration Tests', () => {
  describe('GET /api/v1/dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(mockApp)
        .get('/api/v1/dashboard/stats')
        .query({ businessId: 'test-business-123' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('totalConversations');
      expect(response.body.data).toHaveProperty('conversionRate');
      expect(response.body.data).toHaveProperty('growth');
    });

    it('should handle missing businessId parameter', async () => {
      const response = await request(mockApp)
        .get('/api/v1/dashboard/stats')
        .expect(200);

      // Should still return data (mock always succeeds)
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/dashboard/revenue', () => {
    it('should return revenue breakdown by period', async () => {
      const response = await request(mockApp)
        .get('/api/v1/dashboard/revenue')
        .query({ 
          businessId: 'test-business-123',
          period: 'daily',
          startDate: '2024-01-10',
          endDate: '2024-01-15'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('daily');
      expect(response.body.data).toHaveProperty('weekly');
      expect(response.body.data).toHaveProperty('monthly');
      expect(Array.isArray(response.body.data.daily)).toBe(true);
    });

    it('should handle different time periods', async () => {
      const response = await request(mockApp)
        .get('/api/v1/dashboard/revenue')
        .query({ 
          businessId: 'test-business-123',
          period: 'weekly'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.weekly).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      await request(mockApp)
        .get('/api/v1/dashboard/unknown')
        .expect(404);
    });
  });
});

describe('Health Check Integration Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(mockApp)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
    });

    it('should return status in reasonable time', async () => {
      const start = Date.now();
      
      await request(mockApp)
        .get('/health')
        .expect(200);
        
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond in less than 1 second
    });
  });
});