import { config } from '../config/index.js';
import { prisma } from '../models/index.js';

export interface RevenueCalculation {
  bookingClicks: number;
  avgOrderValue: number;
  conversionMultiplier: number;
  estimatedRevenue: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface PeriodStats {
  conversations: number;
  qualifiedLeads: number;
  bookingClicks: number;
  estimatedRevenue: number;
  avgResponseTime?: number;
  topService?: string;
  conversionRate: number;
  revenueGrowth?: number; // Month-over-month percentage
}

export class RevenueEstimator {
  /**
   * Calculate estimated revenue for a business based on booking clicks
   */
  static calculateRevenue(
    bookingClicks: number,
    _businessId?: string,
    industry?: string,
    businessAvgOrderValue?: number,
    businessConversionMultiplier?: number
  ): RevenueCalculation {
    // Use business-specific values first, then industry defaults, then global defaults
    const avgOrderValue = 
      businessAvgOrderValue ||
      (industry ? config.revenue.avgOrderValues[industry as keyof typeof config.revenue.avgOrderValues] : undefined) ||
      config.revenue.avgOrderValues.default;

    const conversionMultiplier = 
      businessConversionMultiplier ||
      config.revenue.defaultConversionMultiplier;

    const estimatedRevenue = bookingClicks * avgOrderValue * conversionMultiplier;

    // Determine confidence level based on data availability
    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (businessAvgOrderValue && businessConversionMultiplier) {
      confidence = 'high';
    } else if (businessAvgOrderValue || businessConversionMultiplier || industry) {
      confidence = 'medium';
    }

    return {
      bookingClicks,
      avgOrderValue,
      conversionMultiplier,
      estimatedRevenue,
      confidence,
    };
  }

  /**
   * Get aggregated stats for a business for a specific period
   */
  static async getBusinessStats(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PeriodStats | null> {
    try {
      // Get business details for revenue calculation
      const business = await prisma.businessProfile.findUnique({
        where: { id: businessId },
        select: {
          industry: true,
          avgOrderValue: true,
          conversionMultiplier: true,
        },
      });

      if (!business) {
        return null;
      }

      // Get conversation stats
      const conversationStats = await prisma.conversation.aggregate({
        where: {
          businessId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        _count: {
          id: true,
        },
      });

      const qualifiedLeadsStats = await prisma.conversation.aggregate({
        where: {
          businessId,
          isQualified: true,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        _count: {
          id: true,
        },
      });

      const bookingClicksStats = await prisma.conversation.aggregate({
        where: {
          businessId,
          hasBooked: true,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        _count: {
          id: true,
        },
      });

      // Get most requested service
      const serviceStats = await prisma.conversation.groupBy({
        by: ['leadService'],
        where: {
          businessId,
          leadService: { not: null },
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        _count: {
          leadService: true,
        },
        orderBy: {
          _count: {
            leadService: 'desc',
          },
        },
        take: 1,
      });

      // Calculate average response time (approximate)
      const responseTimeQuery = await prisma.$queryRaw<{ avg_response_time: number }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (
          SELECT MIN(cm.created_at) 
          FROM conversation_messages cm 
          WHERE cm.conversation_id = c.id 
          AND cm.from_business = true
        )) - EXTRACT(EPOCH FROM c.created_at)) / 60.0 as avg_response_time
        FROM conversations c
        WHERE c.business_id = ${businessId}
        AND c.created_at >= ${periodStart}
        AND c.created_at <= ${periodEnd}
      `;

      const avgResponseTime = responseTimeQuery[0]?.avg_response_time || undefined;

      // Calculate revenue
      const revenueCalc = this.calculateRevenue(
        bookingClicksStats._count.id,
        businessId,
        business.industry || undefined,
        business.avgOrderValue || undefined,
        business.conversionMultiplier || undefined
      );

      const conversionRate = conversationStats._count.id > 0 
        ? bookingClicksStats._count.id / conversationStats._count.id 
        : 0;

      return {
        conversations: conversationStats._count.id,
        qualifiedLeads: qualifiedLeadsStats._count.id,
        bookingClicks: bookingClicksStats._count.id,
        estimatedRevenue: revenueCalc.estimatedRevenue,
        avgResponseTime,
        topService: serviceStats[0]?.leadService || undefined,
        conversionRate,
      };
    } catch (error) {
      console.error('Error getting business stats:', error);
      return null;
    }
  }

  /**
   * Calculate month-over-month growth for revenue
   */
  static async getRevenueGrowth(
    businessId: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date
  ): Promise<number | undefined> {
    try {
      // Calculate previous period (same duration, shifted back)
      const periodDuration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
      const previousPeriodEnd = new Date(currentPeriodStart);
      const previousPeriodStart = new Date(currentPeriodStart.getTime() - periodDuration);

      const currentStats = await this.getBusinessStats(businessId, currentPeriodStart, currentPeriodEnd);
      const previousStats = await this.getBusinessStats(businessId, previousPeriodStart, previousPeriodEnd);

      if (!currentStats || !previousStats || previousStats.estimatedRevenue === 0) {
        return undefined;
      }

      return ((currentStats.estimatedRevenue - previousStats.estimatedRevenue) / previousStats.estimatedRevenue) * 100;
    } catch (error) {
      console.error('Error calculating revenue growth:', error);
      return undefined;
    }
  }

  /**
   * Get or create aggregated stats for a period
   */
  static async aggregateStatsForPeriod(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ id: string } | null> {
    try {
      // Check if stats already exist
      const existing = await prisma.aggregatedStats.findUnique({
        where: {
          businessId_periodStart_periodEnd: {
            businessId,
            periodStart,
            periodEnd,
          },
        },
      });

      if (existing) {
        return { id: existing.id };
      }

      // Calculate fresh stats
      const stats = await this.getBusinessStats(businessId, periodStart, periodEnd);
      if (!stats) {
        return null;
      }

      // Create aggregated stats record
      const aggregatedStats = await prisma.aggregatedStats.create({
        data: {
          businessId,
          periodStart,
          periodEnd,
          conversations: stats.conversations,
          qualifiedLeads: stats.qualifiedLeads,
          bookingClicks: stats.bookingClicks,
          estimatedRevenue: stats.estimatedRevenue,
          avgResponseTime: stats.avgResponseTime,
          topService: stats.topService,
        },
      });

      return { id: aggregatedStats.id };
    } catch (error) {
      console.error('Error aggregating stats:', error);
      return null;
    }
  }
}