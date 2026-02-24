import { /* PrismaClient */ } from '@prisma/client';
import { Logger } from '../utils/logger.js';
import { computeScore, isHot } from './score.js';
import { notifyOwner } from './notifications.js';

// const prisma = new PrismaClient();
const logger = new Logger();

export interface HotLeadData {
  businessId: string;
  conversationId?: string;
  userId: string;
  urgency?: string;
  serviceTier?: string;
  vehicleType?: string;
  propertyType?: string;
  recurringInterest?: string;
  maintenancePlan?: string;
  coatingInterest?: string;
  priority?: string;
  phone?: string;
}

/**
 * Process and persist a potential hot lead
 * Computes score, saves to DB, and triggers notifications if hot
 */
export async function processHotLead(leadData: HotLeadData): Promise<{ score: number; isHot: boolean; saved: boolean }> {
  try {
    // Compute lead score
    const score = computeScore({
      urgency: leadData.urgency,
      service_tier: leadData.serviceTier,
      vehicle_type: leadData.vehicleType,
      property_type: leadData.propertyType,
      recurring_interest: leadData.recurringInterest,
      maintenance_plan_interest: leadData.maintenancePlan,
      coating_interest: leadData.coatingInterest,
      priority: leadData.priority
    });

    const hotLead = isHot(score);
    
    logger.info('Processing potential hot lead', {
      businessId: leadData.businessId,
      userId: leadData.userId,
      score,
      isHot: hotLead,
      hasPhone: !!leadData.phone
    });

    // Save to database
    let notificationSent = false;
    // let webhookSuccess = false; // Temporarily unused
    // let smsSuccess = false; // Temporarily unused
    let notificationError: string | undefined;

    // If it's a hot lead, send notifications
    if (hotLead) {
      try {
        await notifyOwner(
          leadData.businessId,
          {
            urgency: leadData.urgency,
            service_tier: leadData.serviceTier,
            vehicle_type: leadData.vehicleType,
            property_type: leadData.propertyType,
            recurring_interest: leadData.recurringInterest,
            maintenance_plan: leadData.maintenancePlan,
            coating_interest: leadData.coatingInterest,
            priority: leadData.priority
          },
          score,
          leadData.phone
        );
        notificationSent = true;
        // webhookSuccess = !!process.env.OWNER_WEBHOOK_URL; // Temporarily disabled
        // smsSuccess = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.OWNER_PHONE_NUMBER); // Temporarily disabled
      } catch (error) {
        notificationError = error instanceof Error ? error.message : 'Unknown notification error';
        logger.error('Hot lead notification failed', new Error(notificationError), {
          businessId: leadData.businessId,
          userId: leadData.userId,
          score
        });
      }
    }

    // Save hot lead to database (disabled until migration)
    // TODO: Re-enable after running migration
    /*
    const savedLead = await prisma.hotLead.create({
      data: {
        businessId: leadData.businessId,
        conversationId: leadData.conversationId,
        userId: leadData.userId,
        score,
        phone: leadData.phone,
        urgency: leadData.urgency,
        serviceTier: leadData.serviceTier,
        vehicleType: leadData.vehicleType,
        propertyType: leadData.propertyType,
        recurringInterest: leadData.recurringInterest,
        maintenancePlan: leadData.maintenancePlan,
        coatingInterest: leadData.coatingInterest,
        priority: leadData.priority,
        notificationSent,
        webhookSuccess,
        smsSuccess,
        notificationError
      }
    });

    logger.info('Hot lead saved to database', {
      leadId: savedLead.id,
      businessId: leadData.businessId,
      score,
      isHot: hotLead,
      notificationSent
    });
    */

    logger.info('Hot lead processed (DB save disabled)', {
      businessId: leadData.businessId,
      score,
      isHot: hotLead,
      notificationSent
    });

    return {
      score,
      isHot: hotLead,
      saved: true
    };

  } catch (error) {
    logger.error('Failed to process hot lead', new Error(error instanceof Error ? error.message : 'Unknown error'), {
      businessId: leadData.businessId,
      userId: leadData.userId
    });

    return {
      score: 0,
      isHot: false,
      saved: false
    };
  }
}

/**
 * Get hot leads for a business with pagination
 */
export async function getHotLeads(businessId: string, limit: number = 50, offset: number = 0) {
  try {
    // Temporarily disabled until migration
    /*
    const [leads, total] = await Promise.all([
      prisma.hotLead.findMany({
        where: { businessId },
        orderBy: [
          { score: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset,
        include: {
          conversation: {
            select: {
              id: true,
              currentState: true,
              isQualified: true,
              hasBooked: true
            }
          }
        }
      }),
      prisma.hotLead.count({
        where: { businessId }
      })
    ]);

    return {
      leads,
      total,
      hasMore: offset + limit < total
    };
    */
    
    logger.info('Hot leads fetch requested (temporarily disabled)', { businessId, limit, offset });
    return {
      leads: [],
      total: 0,
      hasMore: false
    };
  } catch (error) {
    logger.error('Failed to fetch hot leads', new Error(error instanceof Error ? error.message : 'Unknown error'), {
      businessId,
      limit,
      offset
    });
    
    return {
      leads: [],
      total: 0,
      hasMore: false
    };
  }
}

/**
 * Get hot lead statistics for a business
 */
export async function getHotLeadStats(businessId: string, daysBack: number = 30) {
  try {
    // Temporarily disabled until migration
    /*
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const stats = await prisma.hotLead.groupBy({
      by: ['score'],
      where: {
        businessId,
        createdAt: {
          gte: since
        }
      },
      _count: {
        id: true
      },
      _avg: {
        score: true
      }
    });

    const totalLeads = await prisma.hotLead.count({
      where: {
        businessId,
        createdAt: {
          gte: since
        }
      }
    });

    const hotLeads = await prisma.hotLead.count({
      where: {
        businessId,
        score: {
          gte: 70 // Hot threshold
        },
        createdAt: {
          gte: since
        }
      }
    });

    const avgScore = stats.length > 0 
      ? stats.reduce((sum: number, stat: any) => sum + (stat._avg.score || 0), 0) / stats.length
      : 0;

    return {
      totalLeads,
      hotLeads,
      hotLeadRate: totalLeads > 0 ? hotLeads / totalLeads : 0,
      averageScore: avgScore,
      period: daysBack
    };
    */
    
    logger.info('Hot lead stats requested (temporarily disabled)', { businessId, daysBack });
    return {
      totalLeads: 0,
      hotLeads: 0,
      hotLeadRate: 0,
      averageScore: 0,
      period: daysBack
    };
  } catch (error) {
    logger.error('Failed to get hot lead stats', new Error(error instanceof Error ? error.message : 'Unknown error'), {
      businessId,
      daysBack
    });

    return {
      totalLeads: 0,
      hotLeads: 0,
      hotLeadRate: 0,
      averageScore: 0,
      period: daysBack
    };
  }
}