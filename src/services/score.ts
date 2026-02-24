import { Logger } from '../utils/logger.js';

const logger = new Logger();

export interface ScorePayload {
  urgency?: string;
  vehicle_type?: string;
  service_tier?: string;
  property_type?: string;
  recurring_interest?: string;
  coating_interest?: string;
  maintenance_plan_interest?: string;
  priority?: string;
  [key: string]: any;
}

/**
 * Compute lead score based on qualification data
 * @param payload - Lead qualification data
 * @returns Score from 0-100
 */
export function computeScore(payload: ScorePayload): number {
  let score = 0;
  
  try {
    // Urgency scoring
    if (payload.urgency === 'emergency') {
      score += 50;
    } else if (payload.urgency === 'immediate') {
      score += 40;
    } else if (payload.urgency === 'this_week') {
      score += 25;
    }
    
    // Vehicle/service tier scoring
    if (payload.vehicle_type?.includes('supercar') || payload.vehicle_type?.includes('luxury')) {
      score += 30;
    } else if (payload.service_tier === 'premium' || payload.property_type?.includes('commercial')) {
      score += 30;
    } else if (payload.vehicle_type?.includes('sports') || payload.property_type?.includes('office')) {
      score += 20;
    }
    
    // Recurring interest scoring
    if (payload.recurring_interest === 'yes' || payload.recurring_interest === 'interested') {
      score += 15;
    } else if (payload.maintenance_plan_interest === 'platinum' || payload.maintenance_plan_interest === 'accepted') {
      score += 15;
    }
    
    // Premium services interest
    if (payload.coating_interest === 'full_suite' || payload.coating_interest === 'coating_only') {
      score += 10;
    }
    
    // Priority tier bonus
    if (payload.priority === 'platinum') {
      score += 10;
    } else if (payload.priority === 'gold') {
      score += 5;
    }
    
    // Cap score at 100
    score = Math.min(score, 100);
    
    logger.info('Lead score computed', { score, payload: Object.keys(payload) });
    
    return score;
  } catch (error) {
    logger.error('Error computing lead score', new Error('Score computation failed'), { payload });
    return 0;
  }
}

/**
 * Check if lead is hot based on score threshold
 * @param score - Lead score
 * @param threshold - Hot lead threshold (default: 70)
 * @returns True if lead is hot
 */
export function isHot(score: number, threshold: number = 70): boolean {
  return score >= threshold;
}