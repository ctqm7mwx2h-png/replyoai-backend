import { Request, Response } from 'express';
import { z } from 'zod';

const GetDashboardParamsSchema = z.object({
  ig_username: z.string().min(1),
});

export class DashboardController {
  static async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { ig_username } = GetDashboardParamsSchema.parse(req.params);

      // Placeholder dashboard data
      const dashboardData = {
        success: true,
        data: {
          business: {
            instagram: ig_username,
            name: `${ig_username} Business`,
          },
          stats: {
            conversations: 25,
            qualifiedLeads: 18,
            bookingClicks: 12,
            estimatedRevenue: 1800,
            conversionRate: 0.48,
          },
          period: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date(),
            type: 'monthly',
          },
        },
      };

      res.json(dashboardData);
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async exportStats(req: Request, res: Response): Promise<void> {
    try {
      const { ig_username } = GetDashboardParamsSchema.parse(req.params);

      // Placeholder export data
      const exportData = {
        success: true,
        data: {
          business: {
            instagram: ig_username,
          },
          stats: [
            {
              date: '2026-01-01',
              conversations: 10,
              qualified_leads: 8,
              booking_clicks: 5,
              estimated_revenue: 750,
            },
          ],
        },
      };

      res.json(exportData);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}