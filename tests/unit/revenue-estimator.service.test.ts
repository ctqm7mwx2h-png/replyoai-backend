import { RevenueEstimator } from '../../src/services/revenue-estimator.service';

describe('RevenueEstimator', () => {
  describe('calculateRevenue', () => {
    it('should calculate revenue for beauty industry', () => {
      const result = RevenueEstimator.calculateRevenue(
        10, // bookingClicks
        'business123',
        'beauty'
      );

      expect(result.estimatedRevenue).toBeGreaterThan(0);
      expect(result.avgOrderValue).toBeGreaterThan(0);
      expect(result.bookingClicks).toBe(10);
      expect(['low', 'medium', 'high']).toContain(result.confidence);
    });

    it('should use custom AOV when provided', () => {
      const customAOV = 250;
      const result = RevenueEstimator.calculateRevenue(
        10, // bookingClicks
        'business123',
        'beauty',
        customAOV
      );

      expect(result.avgOrderValue).toBe(customAOV);
      expect(result.estimatedRevenue).toBeGreaterThan(0);
    });

    it('should handle unknown industry with default values', () => {
      const result = RevenueEstimator.calculateRevenue(
        5, // bookingClicks
        'business123',
        'unknown' as any
      );

      expect(result.estimatedRevenue).toBeGreaterThan(0);
      expect(result.confidence).toBe('medium'); // Medium confidence because industry is provided
    });

    it('should have low confidence when no additional data is provided', () => {
      const result = RevenueEstimator.calculateRevenue(
        5, // bookingClicks
        'business123'
        // No industry, no custom AOV, no custom multiplier
      );

      expect(result.estimatedRevenue).toBeGreaterThan(0);
      expect(result.confidence).toBe('low'); // Lowest confidence with minimal data
    });

    it('should scale revenue with booking clicks', () => {
      const lowVolumeResult = RevenueEstimator.calculateRevenue(
        2, // bookingClicks
        'business123',
        'fitness'
      );

      const highVolumeResult = RevenueEstimator.calculateRevenue(
        20, // bookingClicks
        'business123',
        'fitness'
      );

      expect(highVolumeResult.estimatedRevenue).toBeGreaterThan(lowVolumeResult.estimatedRevenue);
    });

    it('should return zero revenue for zero booking clicks', () => {
      const result = RevenueEstimator.calculateRevenue(
        0, // bookingClicks
        'business123',
        'beauty'
      );

      expect(result.estimatedRevenue).toBe(0);
      expect(result.bookingClicks).toBe(0);
    });

    it('should use high confidence when both custom AOV and multiplier provided', () => {
      const result = RevenueEstimator.calculateRevenue(
        10, // bookingClicks
        'business123',
        'beauty',
        200, // custom AOV
        0.3 // custom conversion multiplier
      );

      expect(result.confidence).toBe('high');
      expect(result.avgOrderValue).toBe(200);
      expect(result.conversionMultiplier).toBe(0.3);
    });
  });

  describe('industry differences', () => {
    it('should apply different AOVs for different industries', () => {
      const beautyResult = RevenueEstimator.calculateRevenue(10, 'business123', 'beauty');
      const cleaningResult = RevenueEstimator.calculateRevenue(10, 'business123', 'cleaning');

      // Different industries should have different default AOVs
      expect(beautyResult.avgOrderValue).not.toBe(cleaningResult.avgOrderValue);
    });
  });
});