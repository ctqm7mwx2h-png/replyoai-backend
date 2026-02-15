import { PrismaClient } from '@prisma/client';
import { ConversationResult, ConversationSession } from '../conversations/types.js';

const prisma = new PrismaClient();

export class ConversationPersistenceService {
  /**
   * Get or create conversation for a user with a business
   */
  static async getOrCreateConversation(
    businessId: string, 
    userId: string
  ): Promise<ConversationSession> {
    // Try to find existing active conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        businessId,
        userId,
        currentState: { not: 'END' }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    // Create new conversation if none exists
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          businessId,
          userId,
          currentState: 'START',
          lastMessageAt: new Date()
        }
      });
    }

    return {
      conversationId: conversation.id,
      currentState: conversation.currentState,
      lastActivity: conversation.lastMessageAt.getTime(),
      industry: '', // Will be set from business profile
      leadData: {
        lead_service: conversation.leadService || '',
        lead_urgency: conversation.leadUrgency || '',
        lead_intent: conversation.leadIntent || '',
        followUpCount: conversation.followUpCount.toString()
      },
      isQualified: conversation.isQualified,
      hasBooked: conversation.hasBooked
    };
  }

  /**
   * Update conversation state and lead qualification data
   */
  static async updateConversation(
    conversationId: string,
    result: ConversationResult,
    qualificationData?: Record<string, string>
  ): Promise<void> {
    const updateData: any = {
      currentState: result.state,
      lastMessageAt: new Date()
    };

    // Update lead qualification data if provided
    if (qualificationData) {
      if (qualificationData.lead_service) {
        updateData.leadService = qualificationData.lead_service;
      }
      if (qualificationData.lead_urgency) {
        updateData.leadUrgency = qualificationData.lead_urgency;
      }
      if (qualificationData.lead_intent) {
        updateData.leadIntent = qualificationData.lead_intent;
      }
    }

    // Mark as qualified if we have essential lead data
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (conversation && (conversation.leadService || qualificationData?.lead_service)) {
      updateData.isQualified = true;
    }

    // Mark as booked if this was a booking attempt
    if (result.isBookingAttempt) {
      updateData.hasBooked = true;
    }

    // Set follow-up timing if needed
    if (result.shouldFollowUp && result.followUpHours) {
      const followUpDate = new Date();
      followUpDate.setHours(followUpDate.getHours() + result.followUpHours);
      updateData.nextFollowUpAt = followUpDate;
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData
    });
  }

  /**
   * Save conversation message for audit trail
   */
  static async saveMessage(
    conversationId: string,
    message: string,
    fromBusiness: boolean,
    state?: string
  ): Promise<void> {
    await prisma.conversationMessage.create({
      data: {
        conversationId,
        message,
        fromBusiness,
        state
      }
    });
  }

  /**
   * Get conversations that need follow-ups
   */
  static async getConversationsForFollowUp(): Promise<any[]> {
    const now = new Date();
    
    return await prisma.conversation.findMany({
      where: {
        nextFollowUpAt: {
          lte: now
        },
        currentState: { not: 'END' },
        hasBooked: false,
        followUpCount: { lt: 2 }
      },
      include: {
        business: true
      }
    });
  }

  /**
   * Mark follow-up as sent
   */
  static async markFollowUpSent(conversationId: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        followUpCount: { increment: 1 },
        nextFollowUpAt: null,
        lastMessageAt: new Date()
      }
    });
  }

  /**
   * Get conversation analytics for a business
   */
  static async getBusinessAnalytics(businessId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const conversations = await prisma.conversation.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate }
      }
    });

    const qualifiedLeads = conversations.filter((c: any) => c.isQualified).length;
    const bookingClicks = conversations.filter((c: any) => c.hasBooked).length;

    // Get most requested service
    const serviceCounts: Record<string, number> = {};
    conversations.forEach((conv: any) => {
      if (conv.leadService) {
        serviceCounts[conv.leadService] = (serviceCounts[conv.leadService] || 0) + 1;
      }
    });

    const mostRequestedService = Object.entries(serviceCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

    return {
      conversations: conversations.length,
      qualifiedLeads,
      bookingClicks,
      topService: mostRequestedService,
      conversionRate: conversations.length > 0 ? (bookingClicks / conversations.length) : 0,
      qualificationRate: conversations.length > 0 ? (qualifiedLeads / conversations.length) : 0
    };
  }
}