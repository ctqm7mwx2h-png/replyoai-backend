import { ConversationEngine, ConversationResult } from './engine.js';
import { beautyFlow } from './states/beauty.js';
import { ConversationService } from '../services/conversation.service.js';

interface ConversationSession {
  currentState: string;
  lastActivity: number;
  industry?: string;
}

interface ConversationResponse {
  text: string;
  quickReplies?: string[];
}

export class ConversationRouter {
  private static sessions = new Map<string, ConversationSession>();
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Main entry point for processing conversation messages
   */
  static async processMessage(
    igUsername: string,
    messageText: string
  ): Promise<ConversationResponse> {
    try {
      // Clean up expired sessions periodically
      this.cleanExpiredSessions();

      // Get or create session
      let session = this.getSession(igUsername);
      if (!session) {
        session = this.createSession(igUsername);
      }

      // Get business data
      const businessData = await ConversationService.getBusinessData(igUsername);
      if (!businessData) {
        return {
          text: "Sorry, I couldn't find your business profile. Please make sure your account is set up correctly.",
          quickReplies: []
        };
      }

      // Determine conversation flow based on industry or default to beauty
      const flow = this.getConversationFlow(businessData.industry || 'beauty');
      
      // Process the message through conversation engine
      const result: ConversationResult = ConversationEngine.processMessage(
        flow,
        session.currentState,
        messageText,
        businessData
      );

      // Update session
      session.currentState = result.state;
      session.lastActivity = Date.now();
      this.sessions.set(igUsername, session);

      return {
        text: result.message,
        quickReplies: result.quickReplies
      };

    } catch (error) {
      console.error('Conversation router error:', error);
      
      // Fallback response
      return {
        text: "I'm having trouble right now, but I'll be back shortly! Please try again in a moment. 🙏",
        quickReplies: ["🔄 Try Again"]
      };
    }
  }

  /**
   * Get existing session for user
   */
  private static getSession(igUsername: string): ConversationSession | null {
    const session = this.sessions.get(igUsername);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      this.sessions.delete(igUsername);
      return null;
    }

    return session;
  }

  /**
   * Create new session for user
   */
  private static createSession(igUsername: string): ConversationSession {
    const session: ConversationSession = {
      currentState: ConversationEngine.getInitialState(),
      lastActivity: Date.now()
    };

    this.sessions.set(igUsername, session);
    return session;
  }

  /**
   * Get conversation flow based on industry
   */
  private static getConversationFlow(industry: string) {
    switch (industry?.toLowerCase()) {
      case 'beauty':
      case 'salon':
      case 'spa':
      case 'cosmetics':
      default:
        return beautyFlow;
    }
  }

  /**
   * Clean up expired sessions to prevent memory leaks
   */
  private static cleanExpiredSessions(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.sessions.delete(key);
    }
  }

  /**
   * Reset conversation for a user (start over)
   */
  static resetConversation(igUsername: string): void {
    this.sessions.delete(igUsername);
  }

  /**
   * Get current session state for a user
   */
  static getSessionState(igUsername: string): string | null {
    const session = this.getSession(igUsername);
    return session ? session.currentState : null;
  }

  /**
   * Get session statistics (for monitoring)
   */
  static getSessionStats(): { activeUsers: number; totalSessions: number } {
    this.cleanExpiredSessions();
    
    return {
      activeUsers: this.sessions.size,
      totalSessions: this.sessions.size
    };
  }

  /**
   * Force cleanup all sessions (for development/testing)
   */
  static clearAllSessions(): void {
    this.sessions.clear();
  }
}