import { ConversationPersistenceService } from './conversation-persistence.service.js';
import { ConversationEngine } from '../conversations/engine.js';
import { beautyFlow } from '../conversations/templates/beauty.js';
import { hairFlow } from '../conversations/templates/hair.js';
import { ConversationFlow } from '../conversations/types.js';

export class FollowUpService {
  /**
   * Process all pending follow-ups
   * This should be called by a cron job every hour
   */
  static async processPendingFollowUps(): Promise<void> {
    const conversationsToFollowUp = await ConversationPersistenceService.getConversationsForFollowUp();

    for (const conversation of conversationsToFollowUp) {
      await this.sendFollowUpMessage(conversation);
    }
  }

  /**
   * Send a follow-up message for a specific conversation
   */
  private static async sendFollowUpMessage(conversation: any): Promise<void> {
    try {
      // Get the appropriate conversation flow based on business industry
      const flow = this.getConversationFlow(conversation.business.industry);
      
      // Create session object
      const session = {
        conversationId: conversation.id,
        currentState: 'FOLLOW_UP',
        lastActivity: conversation.lastMessageAt.getTime(),
        industry: conversation.business.industry,
        leadData: {
          lead_service: conversation.leadService || '',
          lead_urgency: conversation.leadUrgency || '',
          lead_intent: conversation.leadIntent || '',
          followUpCount: conversation.followUpCount.toString()
        },
        isQualified: conversation.isQualified,
        hasBooked: conversation.hasBooked
      };

      // Generate follow-up message
      const result = ConversationEngine.processMessage(
        flow,
        session,
        'FOLLOW_UP_TRIGGER', // Internal trigger
        conversation.business
      );

      // Save the follow-up message
      await ConversationPersistenceService.saveMessage(
        conversation.id,
        result.message,
        true, // from business
        'FOLLOW_UP'
      );

      // Update conversation state
      await ConversationPersistenceService.updateConversation(
        conversation.id,
        result
      );

      // Mark follow-up as sent
      await ConversationPersistenceService.markFollowUpSent(conversation.id);

      // In a real implementation, this would send the message via Instagram API
      console.log(`Follow-up sent to conversation ${conversation.id}:`, result.message);

      // Schedule next follow-up if appropriate
      if (result.shouldFollowUp && conversation.followUpCount < 1) {
        // Will be handled automatically by the conversation update
      }

    } catch (error) {
      console.error(`Failed to send follow-up for conversation ${conversation.id}:`, error);
    }
  }

  /**
   * Get conversation flow based on industry
   */
  private static getConversationFlow(industry: string): ConversationFlow {
    switch (industry?.toLowerCase()) {
      case 'hair':
      case 'barber':
      case 'barbershop':
      case 'hairdresser':
        return hairFlow;
      case 'beauty':
      case 'salon':
      case 'spa':
      case 'cosmetics':
      default:
        return beautyFlow;
    }
  }

  /**
   * Schedule a follow-up for a specific conversation
   */
  static async scheduleFollowUp(
    _conversationId: string, 
    hoursFromNow: number
  ): Promise<void> {
    const followUpDate = new Date();
    followUpDate.setHours(followUpDate.getHours() + hoursFromNow);

    // This would be handled by the conversation update in the persistence service
    // Just ensuring we have a method to manually trigger follow-up scheduling
  }

  /**
   * Cancel pending follow-ups for a conversation (e.g., when user books)
   */
  static async cancelFollowUps(conversationId: string): Promise<void> {
    // Update conversation to remove follow-up scheduling
    await ConversationPersistenceService.updateConversation(
      conversationId,
      {
        state: 'END',
        message: '',
        shouldFollowUp: false
      }
    );
  }

  /**
   * Get follow-up statistics for a business
   */
  static async getFollowUpStats(_businessId: string, days: number = 30) {
    // This would query the conversation messages to see follow-up effectiveness
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // For now, return basic stats structure
    return {
      totalFollowUpsSent: 0,
      followUpResponseRate: 0,
      followUpConversions: 0,
      avgTimeToResponse: 0
    };
  }

  /**
   * Test follow-up system with a specific conversation
   */
  static async testFollowUp(conversationId: string): Promise<string> {
    const conversations = await ConversationPersistenceService.getConversationsForFollowUp();
    const conversation = conversations.find(c => c.id === conversationId);

    if (!conversation) {
      return 'Conversation not found or not eligible for follow-up';
    }

    await this.sendFollowUpMessage(conversation);
    return 'Follow-up sent successfully';
  }
}