import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class StatsService {
  /**
   * Update daily stats for a business
   */
  static async updateDailyStats(businessId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get conversations for today
    const todayConversations = await prisma.conversation.findMany({
      where: {
        businessId,
        createdAt: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    const totalConversations = todayConversations.length;
    const qualifiedLeads = todayConversations.filter(c => c.isQualified).length;
    const bookingClicks = todayConversations.filter(c => c.hasBooked).length;

    // Calculate response rate (conversations that got past START state)
    const responseRate = totalConversations > 0 
      ? todayConversations.filter(c => c.currentState !== 'START').length / totalConversations 
      : 0;

    // Calculate conversion rate
    const conversionRate = totalConversations > 0 ? bookingClicks / totalConversations : 0;

    // Get most requested service
    const serviceCounts: Record<string, number> = {};
    todayConversations.forEach(conv => {
      if (conv.leadService) {
        serviceCounts[conv.leadService] = (serviceCounts[conv.leadService] || 0) + 1;
      }
    });

    const mostRequestedService = Object.entries(serviceCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

    // Upsert daily stats
    await prisma.businessStats.upsert({
      where: {
        businessId_date: {
          businessId,
          date: today
        }
      },
      update: {
        totalConversations,
        qualifiedLeads,
        bookingClicks,
        mostRequestedService,
        responseRate,
        conversionRate
      },
      create: {
        businessId,
        date: today,
        totalConversations,
        qualifiedLeads,
        bookingClicks,
        mostRequestedService,
        responseRate,
        conversionRate
      }
    });
  }

  /**
   * Get dashboard stats for a business
   */
  static async getDashboardStats(businessId: string, days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get aggregated stats for the period
    const stats = await prisma.businessStats.findMany({
      where: {
        businessId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'desc' }
    });

    if (stats.length === 0) {
      return {
        conversations: 0,
        qualifiedLeads: 0,
        bookingClicks: 0,
        topService: null,
        responseRate: 0,
        conversionRate: 0,
        trend: {
          conversations: 0,
          bookings: 0
        }
      };
    }

    // Aggregate totals
    const totals = stats.reduce((acc, stat) => ({
      conversations: acc.conversations + stat.totalConversations,
      qualifiedLeads: acc.qualifiedLeads + stat.qualifiedLeads,
      bookingClicks: acc.bookingClicks + stat.bookingClicks,
      responseRate: acc.responseRate + stat.responseRate,
      conversionRate: acc.conversionRate + stat.conversionRate
    }), {
      conversations: 0,
      qualifiedLeads: 0,
      bookingClicks: 0,
      responseRate: 0,
      conversionRate: 0
    });

    // Get most common service across the period
    const serviceCounts: Record<string, number> = {};
    stats.forEach(stat => {
      if (stat.mostRequestedService) {
        serviceCounts[stat.mostRequestedService] = 
          (serviceCounts[stat.mostRequestedService] || 0) + 1;
      }
    });

    const topService = Object.entries(serviceCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

    // Calculate trend (last 7 days vs previous 7 days)
    const last7Days = stats.slice(0, 7);
    const previous7Days = stats.slice(7, 14);

    const last7Total = last7Days.reduce((acc, s) => acc + s.totalConversations, 0);
    const last7Bookings = last7Days.reduce((acc, s) => acc + s.bookingClicks, 0);
    const prev7Total = previous7Days.reduce((acc, s) => acc + s.totalConversations, 0);
    const prev7Bookings = previous7Days.reduce((acc, s) => acc + s.bookingClicks, 0);

    const conversationTrend = prev7Total > 0 ? 
      ((last7Total - prev7Total) / prev7Total) * 100 : 0;
    const bookingTrend = prev7Bookings > 0 ? 
      ((last7Bookings - prev7Bookings) / prev7Bookings) * 100 : 0;

    return {
      conversations: totals.conversations,
      qualifiedLeads: totals.qualifiedLeads,
      bookingClicks: totals.bookingClicks,
      topService,
      responseRate: stats.length > 0 ? totals.responseRate / stats.length : 0,
      conversionRate: stats.length > 0 ? totals.conversionRate / stats.length : 0,
      trend: {
        conversations: Math.round(conversationTrend * 100) / 100,
        bookings: Math.round(bookingTrend * 100) / 100
      },
      dailyStats: stats.map(stat => ({
        date: stat.date,
        conversations: stat.totalConversations,
        bookings: stat.bookingClicks,
        conversionRate: stat.conversionRate
      }))
    };
  }

  /**
   * Get stats for multiple businesses (admin view)
   */
  static async getMultiBusinessStats(businessIds: string[], days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await prisma.businessStats.groupBy({
      by: ['businessId'],
      where: {
        businessId: { in: businessIds },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        totalConversations: true,
        qualifiedLeads: true,
        bookingClicks: true
      },
      _avg: {
        responseRate: true,
        conversionRate: true
      }
    });

    return stats.map(stat => ({
      businessId: stat.businessId,
      conversations: stat._sum.totalConversations || 0,
      qualifiedLeads: stat._sum.qualifiedLeads || 0,
      bookings: stat._sum.bookingClicks || 0,
      avgResponseRate: stat._avg.responseRate || 0,
      avgConversionRate: stat._avg.conversionRate || 0
    }));
  }

  /**
   * Update stats for a specific conversation event
   */
  static async recordConversationEvent(
    businessId: string, 
    _eventType: 'start' | 'qualify' | 'book'
  ): Promise<void> {
    // This runs in real-time to update today's stats immediately
    await this.updateDailyStats(businessId);

    // Could also trigger webhook notifications here for real-time dashboards
  }
}