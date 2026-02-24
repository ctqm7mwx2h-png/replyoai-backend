import { computeScore, isHot } from '../../src/services/score';

describe('Score Service', () => {
  describe('computeScore', () => {
    it('should return 0 for empty data', () => {
      const result = computeScore({});
      expect(result).toBe(0);
    });

    it('should add 50 points for emergency urgency', () => {
      const result = computeScore({ urgency: 'emergency' });
      expect(result).toBe(50);
    });

    it('should add 40 points for immediate urgency', () => {
      const result = computeScore({ urgency: 'immediate' });
      expect(result).toBe(40);
    });

    it('should add 25 points for this_week urgency', () => {
      const result = computeScore({ urgency: 'this_week' });
      expect(result).toBe(25);
    });

    it('should add no points for unknown urgency', () => {
      const result = computeScore({ urgency: 'low' });
      expect(result).toBe(0);
    });

    it('should add 30 points for luxury/supercar vehicles', () => {
      const result = computeScore({ vehicle_type: 'supercar' });
      expect(result).toBe(30);

      const result2 = computeScore({ vehicle_type: 'luxury sedan' });
      expect(result2).toBe(30);
    });

    it('should add 30 points for premium service tier', () => {
      const result = computeScore({ service_tier: 'premium' });
      expect(result).toBe(30);
    });

    it('should add 30 points for commercial property', () => {
      const result = computeScore({ property_type: 'commercial office' });
      expect(result).toBe(30);
    });

    it('should add 20 points for sports vehicles', () => {
      const result = computeScore({ vehicle_type: 'sports car' });
      expect(result).toBe(20);
    });

    it('should add 20 points for office property', () => {
      const result = computeScore({ property_type: 'office building' });
      expect(result).toBe(20);
    });

    it('should add 15 points for recurring interest', () => {
      const result = computeScore({ recurring_interest: 'yes' });
      expect(result).toBe(15);

      const result2 = computeScore({ recurring_interest: 'interested' });
      expect(result2).toBe(15);
    });

    it('should add 15 points for platinum maintenance plan', () => {
      const result = computeScore({ maintenance_plan_interest: 'platinum' });
      expect(result).toBe(15);

      const result2 = computeScore({ maintenance_plan_interest: 'accepted' });
      expect(result2).toBe(15);
    });

    it('should add 10 points for coating interest', () => {
      const result = computeScore({ coating_interest: 'full_suite' });
      expect(result).toBe(10);

      const result2 = computeScore({ coating_interest: 'coating_only' });
      expect(result2).toBe(10);
    });

    it('should add 10 points for platinum priority', () => {
      const result = computeScore({ priority: 'platinum' });
      expect(result).toBe(10);
    });

    it('should add 5 points for gold priority', () => {
      const result = computeScore({ priority: 'gold' });
      expect(result).toBe(5);
    });

    it('should cap score at 100', () => {
      const result = computeScore({
        urgency: 'emergency',           // 50
        vehicle_type: 'supercar',       // 30  
        recurring_interest: 'yes',      // 15
        coating_interest: 'full_suite', // 10
        priority: 'platinum'            // 10
        // Total would be 115, should cap at 100
      });
      expect(result).toBe(100);
    });

    it('should combine multiple scoring factors', () => {
      const result = computeScore({
        urgency: 'immediate',           // 40
        service_tier: 'premium',        // 30
        recurring_interest: 'yes',      // 15
        priority: 'gold'                // 5
      });
      expect(result).toBe(90); // 40 + 30 + 15 + 5
    });

    it('should handle exact case-sensitive vehicle types', () => {
      const result = computeScore({ vehicle_type: 'SUPERCAR' });
      expect(result).toBe(0); // Case sensitive - 'SUPERCAR' != 'supercar'
      
      const result2 = computeScore({ vehicle_type: 'supercar' });
      expect(result2).toBe(30); // Exact match works
    });
  });

  describe('isHot', () => {
    it('should return true for scores >= 70', () => {
      expect(isHot(70)).toBe(true);
      expect(isHot(80)).toBe(true);
      expect(isHot(100)).toBe(true);
    });

    it('should return false for scores < 70', () => {
      expect(isHot(69)).toBe(false);
      expect(isHot(50)).toBe(false);
      expect(isHot(0)).toBe(false);
    });

    it('should allow custom threshold', () => {
      expect(isHot(60, 50)).toBe(true);
      expect(isHot(40, 50)).toBe(false);
      expect(isHot(50, 50)).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(isHot(0)).toBe(false);
      expect(isHot(-10)).toBe(false);
      expect(isHot(69.9)).toBe(false);
      expect(isHot(70.1)).toBe(true);
    });
  });

  describe('Hot Lead Detection Integration', () => {
    it('should detect hot leads with emergency urgency', () => {
      const score = computeScore({ urgency: 'emergency' }); // 50
      expect(score).toBe(50);
      expect(isHot(score)).toBe(false); // Not quite hot enough
    });

    it('should detect hot leads with premium emergency combo', () => {
      const score = computeScore({ 
        urgency: 'emergency',    // 50
        service_tier: 'premium'  // 30
      });
      expect(score).toBe(80); // 50 + 30
      expect(isHot(score)).toBe(true);
    });

    it('should not trigger hot lead for low scores', () => {
      const score = computeScore({ 
        priority: 'gold' // Just 5 points
      });
      expect(score).toBe(5);
      expect(isHot(score)).toBe(false);
    });

    it('should detect hot leads with multiple positive factors', () => {
      const score = computeScore({
        urgency: 'immediate',             // 40
        vehicle_type: 'sports car',       // 20  
        recurring_interest: 'yes',        // 15
        coating_interest: 'coating_only'  // 10
      });
      expect(score).toBe(85); // 40 + 20 + 15 + 10
      expect(isHot(score)).toBe(true);
    });

    it('should handle realistic car detailing scenarios', () => {
      // High-end luxury client
      const luxuryClient = computeScore({
        urgency: 'emergency',           // 50
        vehicle_type: 'luxury ferrari', // 30
        maintenance_plan_interest: 'platinum' // 15
      });
      expect(luxuryClient).toBe(95); // 50 + 30 + 15
      expect(isHot(luxuryClient)).toBe(true);

      // Regular immediate client  
      const regularClient = computeScore({
        urgency: 'immediate',        // 40
        vehicle_type: 'sports car',  // 20
        recurring_interest: 'yes'    // 15
      });
      expect(regularClient).toBe(75); // 40 + 20 + 15
      expect(isHot(regularClient)).toBe(true);

      // Low priority client
      const lowPriorityClient = computeScore({
        coating_interest: 'coating_only' // 10
      });
      expect(lowPriorityClient).toBe(10);
      expect(isHot(lowPriorityClient)).toBe(false);
    });

    it('should handle commercial cleaning scenarios', () => {
      // High-value commercial client
      const commercialClient = computeScore({
        urgency: 'immediate',           // 40
        property_type: 'commercial',    // 30
        recurring_interest: 'yes',      // 15
        priority: 'platinum'            // 10
      });
      expect(commercialClient).toBe(95); // 40 + 30 + 15 + 10
      expect(isHot(commercialClient)).toBe(true);
    });
  });
});