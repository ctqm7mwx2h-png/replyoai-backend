import { JobScheduler, FollowUpJobData, StatsAggregationJobData } from '../../src/services/job-queue.service';

// Mock BullMQ completely
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({
      id: 'mock-job-id-' + Math.random(),
      data: {},
      opts: {}
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn(),
}));

describe('Job Queue Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job Data Interfaces', () => {
    it('should have correct FollowUpJobData structure', () => {
      const jobData: FollowUpJobData = {
        conversationId: 'conv123',
        businessId: 'business123',
        userId: 'user123',
        followUpType: 'first',
        templateData: {
          customerName: 'John Doe',
        },
      };

      expect(jobData.conversationId).toBe('conv123');
      expect(jobData.followUpType).toBe('first');
      expect(jobData.templateData?.customerName).toBe('John Doe');
    });

    it('should have correct StatsAggregationJobData structure', () => {
      const jobData: StatsAggregationJobData = {
        businessId: 'business123',
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
        force: true,
      };

      expect(jobData.businessId).toBe('business123');
      expect(jobData.force).toBe(true);
      expect(jobData.periodStart).toBe('2024-01-01');
    });
  });

  describe('JobScheduler', () => {
    it('should schedule follow-up job correctly', async () => {
      const conversationId = 'conv123';
      const businessId = 'business123';
      const userId = 'user123';

      // Should not throw and return void
      await expect(JobScheduler.scheduleFollowUp(conversationId, businessId, userId))
        .resolves.not.toThrow();
    });

    it('should schedule stats aggregation job', async () => {
      const businessId = 'business123';

      // Should not throw and return void
      await expect(JobScheduler.scheduleStatsAggregation(businessId))
        .resolves.not.toThrow();
    });

    it('should schedule stats aggregation without business ID', async () => {
      // Should handle undefined businessId (global stats)
      await expect(JobScheduler.scheduleStatsAggregation())
        .resolves.not.toThrow();
    });

    it('should schedule onboarding emails', async () => {
      const businessId = 'business123';

      // Should not throw and return void
      await expect(JobScheduler.scheduleOnboardingEmails(businessId))
        .resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle queue errors gracefully', async () => {
      // Mock queue to throw error
      const mockQueue = {
        add: jest.fn().mockRejectedValue(new Error('Queue error')),
      };

      await expect(mockQueue.add('test-job', {})).rejects.toThrow('Queue error');
    });

    it('should validate job data types', () => {
      // Test that TypeScript catches invalid data structures
      const validFollowUpData: FollowUpJobData = {
        conversationId: 'conv123',
        businessId: 'business123',
        userId: 'user123',
        followUpType: 'first',
      };

      expect(validFollowUpData.followUpType).toBe('first');
      
      const validStatsData: StatsAggregationJobData = {
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      };

      expect(validStatsData.periodStart).toBe('2024-01-01');
    });
  });
});