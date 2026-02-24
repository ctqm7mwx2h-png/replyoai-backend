import { ConversationEngine } from './engine';
import { 
  ConversationResult,
  ConversationSession,
  ConversationFlow
} from './types.js';
import { createDefaultBeautyFlow } from './templates/beauty.js';
import { hairFlow } from './templates/hair.js';
import { fitnessFlow } from './templates/fitness.js';
import { cleaningFlow } from './templates/cleaning.js';
import { plumbingFlow } from './templates/plumbing.js';
import { electricalFlow } from './templates/electrical.js';
import { detailingFlow } from './templates/detailing.js';
import { ConversationService } from '../services/conversation.service.js';
import { ConversationPersistenceService } from '../services/conversation-persistence.service.js';
import { StatsService } from '../services/stats.service.js';
import { computeScore, isHot } from '../services/score.js';
import { notifyOwner } from '../services/notifications.js';
import { saveLead } from '../services/leads.js';
import { validateUrl } from '../utils/validateUrl.js';
import { generateCalendlyLink } from '../utils/calendly.js';
import { trackEvent } from '../services/analytics.js';

export class ConversationRouter {
  private static sessions = new Map<string, ConversationSession>();

  /**
   * Process incoming message and generate response
   */
  static async processMessage(
    igUsername: string,
    userId: string,
    message: string
  ): Promise<ConversationResult> {
    try {
      // Get business data
      const businessData = await ConversationService.getBusinessData(igUsername);
      if (!businessData) {
        throw new Error('Business not found');
      }

      // Get or create conversation session
      let session = await ConversationPersistenceService.getOrCreateConversation(
        businessData.id, 
        userId
      );
      
      // Set industry from business data
      session.industry = businessData.industry || 'beauty';

      // Get appropriate conversation flow
      const flow = this.getConversationFlow(session.industry);

      // Process message using conversation engine
      const result = ConversationEngine.processMessage(
        flow,
        session,
        message,
        businessData
      );

      // Save the user message
      await ConversationPersistenceService.saveMessage(
        session.conversationId,
        message,
        false // from user
      );

      // Save the bot response
      await ConversationPersistenceService.saveMessage(
        session.conversationId,
        result.message,
        true, // from business
        result.state
      );

      // Update conversation state and lead qualification
      await ConversationPersistenceService.updateConversation(
        session.conversationId,
        result,
        result.qualificationData
      );

      // Update stats
      if (result.state === 'START') {
        await StatsService.recordConversationEvent(businessData.id, 'start');
      }
      if (result.shouldQualify) {
        await StatsService.recordConversationEvent(businessData.id, 'qualify');
      }
      if (result.isBookingAttempt) {
        await StatsService.recordConversationEvent(businessData.id, 'book');
      }

      // Update session in memory
      session.currentState = result.state;
      session.lastActivity = Date.now();
      if (result.qualificationData) {
        session.leadData = { ...session.leadData, ...result.qualificationData };
      }
      this.sessions.set(`${businessData.id}:${userId}`, session);

      return result;

    } catch (error) {
      console.error('Conversation processing error:', error);
      return {
        state: 'ERROR',
        message: 'Sorry, I\'m having trouble right now. Please try again or contact us directly.',
        quickReplies: []
      };
    }
  }

  /**
   * Reset conversation for a user
   */
  static async resetConversation(igUsername: string, userId: string): Promise<void> {
    const businessData = await ConversationService.getBusinessData(igUsername);
    if (businessData) {
      const sessionKey = `${businessData.id}:${userId}`;
      this.sessions.delete(sessionKey);
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
      case 'fitness':
      case 'gym':
      case 'personal training':
      case 'trainer':
        return fitnessFlow;
      case 'cleaning':
      case 'house cleaning':
      case 'office cleaning':
      case 'maid service':
        return cleaningFlow;
      case 'plumbing':
      case 'plumber':
      case 'pipes':
        return plumbingFlow;
      case 'electrical':
      case 'electrician':
      case 'electric':
        return electricalFlow;
      case 'detailing':
      case 'car detailing':
      case 'auto detailing':
      case 'car wash':
        return detailingFlow;
      case 'beauty':
      case 'salon':
      case 'spa':
      case 'cosmetics':
      default:
        // Create beauty flow with proper adapters
        return createDefaultBeautyFlow({
          // Lead management
          saveLead: async (tenantId: string, leadData: any) => {
            // Wrapper to match expected signature
            await saveLead(tenantId, leadData);
          },
          // Scoring
          computeScore,
          isHot,
          // Notifications
          notifyOwner: async (tenantId: string, leadData: any, score: number, phone?: string) => {
            await notifyOwner(tenantId, leadData, score, phone);
          },
          // Booking
          generateBookingLink: async (tenantId: string, options: { service: string }) => {
            // Wrapper to handle nullability
            const link = await generateCalendlyLink(tenantId, { service: options.service });
            return link || '';
          },
          // Payment processing - stubs for now
          generateDepositLink: async (_tenantId: string, _leadData: any, _amount: number) => '',
          scheduleSlotRelease: async (_tenantId: string, _leadId: string, _minutes: number) => {},
          // Escalation & reminders - stubs for now
          scheduleEscalation: async (_tenantId: string, _leadId: string, _minutes: number) => {},
          sendPhoneReminder: async (_tenantId: string, _conversationId: string, _hours: number) => {},
          // Utilities
          validateUrl,
          // Metrics
          metrics: {
            trackEvent: async (tenantId: string, event: string, data?: Record<string, unknown>) => {
              await trackEvent(tenantId, event, data);
            }
          }
        });
    }
  }

  /**
   * Get session information for debugging
   */
  static getSession(businessId: string, userId: string): ConversationSession | undefined {
    return this.sessions.get(`${businessId}:${userId}`);
  }

  /**
   * Clean up old sessions (call periodically)
   */
  static cleanupSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, session] of this.sessions) {
      if (now - session.lastActivity > maxAge) {
        this.sessions.delete(key);
      }
    }
  }
}