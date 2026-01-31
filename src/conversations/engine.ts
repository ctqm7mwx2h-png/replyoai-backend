import { 
  ConversationFlow, 
  ConversationResult, 
  ConversationSession,
  QuickReply,
  INTENT_PATTERNS
} from './types.js';

export class ConversationEngine {
  /**
   * Process user input and determine next conversation state
   * Now includes intelligent intent detection and lead qualification
   */
  static processMessage(
    flow: ConversationFlow,
    session: ConversationSession,
    userInput: string,
    businessData: any
  ): ConversationResult {
    const currentState = flow[session.currentState];
    if (!currentState) {
      return this.processMessage(flow, { ...session, currentState: 'START' }, userInput, businessData);
    }

    // Detect user intent and determine next state
    const nextState = this.determineNextState(currentState, userInput, session);
    const nextStateDefinition = flow[nextState];

    // Extract qualification data if current state is qualifying
    const qualificationData: Record<string, string> = {};
    if (currentState.isQualifying && currentState.qualificationField) {
      qualificationData[currentState.qualificationField] = this.extractQualificationValue(
        currentState.qualificationField, 
        userInput
      );
    }

    // Generate contextual response
    const message = this.generateMessage(nextStateDefinition, businessData, {
      ...session,
      leadData: { ...session.leadData, ...qualificationData }
    });

    return {
      state: nextState,
      message,
      quickReplies: nextStateDefinition.quickReplies,
      shouldQualify: nextStateDefinition.isQualifying || false,
      qualificationData,
      isBookingAttempt: nextStateDefinition.isBookingState || false,
      shouldFollowUp: !!nextStateDefinition.followUpAfterHours,
      followUpHours: nextStateDefinition.followUpAfterHours
    };
  }

  /**
   * Determine next conversation state using intelligent intent detection
   */
  private static determineNextState(
    currentState: any, 
    userInput: string, 
    session: ConversationSession
  ): string {
    const normalizedInput = userInput.toLowerCase();

    // First check for exact quick reply matches
    if (currentState.quickReplies) {
      const exactMatch = currentState.quickReplies.find((reply: QuickReply) => 
        this.normalizeText(userInput) === this.normalizeText(reply.title)
      );
      if (exactMatch) return exactMatch.next;
    }

    // Intent-based routing for natural language
    const intent = this.detectIntent(normalizedInput);
    
    switch (intent) {
      case 'BOOKING':
        return session.isQualified ? 'BOOK' : 'QUALIFY';
      case 'PRICING':
        return 'PRICES';
      case 'LOCATION':
        return 'LOCATION';
      case 'SERVICES':
        return 'QUALIFY';
      default:
        // If no clear intent and we have quick replies, try fuzzy matching
        if (currentState.quickReplies) {
          const fuzzyMatch = this.findBestMatch(userInput, currentState.quickReplies);
          if (fuzzyMatch) return fuzzyMatch.next;
        }
        return 'QUESTION'; // Default to question handling
    }
  }

  /**
   * Detect user intent from natural language input
   */
  private static detectIntent(input: string): string | null {
    const words = input.split(/\\s+/);
    
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (Array.isArray(patterns)) {
        if (patterns.some(pattern => words.some(word => word.includes(pattern)))) {
          return intent;
        }
      }
    }
    return null;
  }

  /**
   * Extract qualification data from user input
   */
  private static extractQualificationValue(field: string, input: string): string {
    const normalized = input.toLowerCase().trim();
    
    switch (field) {
      case 'lead_urgency':
        if (INTENT_PATTERNS.URGENCY.HIGH.some(pattern => normalized.includes(pattern))) {
          return 'today';
        }
        if (INTENT_PATTERNS.URGENCY.MEDIUM.some(pattern => normalized.includes(pattern))) {
          return 'this_week';
        }
        if (INTENT_PATTERNS.URGENCY.LOW.some(pattern => normalized.includes(pattern))) {
          return 'planning';
        }
        return 'this_week'; // Default
        
      case 'lead_intent':
        if (INTENT_PATTERNS.QUALIFICATION.FIRST_TIME.some(pattern => normalized.includes(pattern))) {
          return 'first_time';
        }
        if (INTENT_PATTERNS.QUALIFICATION.RETURNING.some(pattern => normalized.includes(pattern))) {
          return 'returning';
        }
        if (INTENT_PATTERNS.QUALIFICATION.COMPARISON.some(pattern => normalized.includes(pattern))) {
          return 'comparison';
        }
        return 'first_time'; // Default
        
      case 'lead_service':
        // Return the raw input for service descriptions
        return input.trim();
        
      default:
        return input.trim();
    }
  }

  /**
   * Generate message with business context and lead data
   */
  private static generateMessage(
    state: any, 
    businessData: any, 
    session: ConversationSession
  ): string {
    if (typeof state.message === 'function') {
      return state.message(businessData, session);
    }
    
    let message = state.message;
    
    // Replace business data placeholders
    message = message.replace(/\\{\\{business_name\\}\\}/g, businessData.business_name || 'us');
    message = message.replace(/\\{\\{location\\}\\}/g, businessData.location || 'our location');
    message = message.replace(/\\{\\{phone\\}\\}/g, businessData.phone || 'us');
    
    // Replace lead data placeholders if available
    if (session.leadData.lead_service) {
      message = message.replace(/\\{\\{service\\}\\}/g, session.leadData.lead_service);
    }
    
    return message;
  }

  /**
   * Find best matching quick reply using fuzzy matching
   */
  private static findBestMatch(input: string, quickReplies: QuickReply[]): QuickReply | null {
    const normalizedInput = this.normalizeText(input);
    let bestMatch = null;
    let bestScore = 0;

    for (const reply of quickReplies) {
      const score = this.calculateSimilarity(normalizedInput, this.normalizeText(reply.title));
      if (score > bestScore && score > 0.6) { // 60% similarity threshold
        bestScore = score;
        bestMatch = reply;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate text similarity for fuzzy matching
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\\s+/);
    const words2 = str2.split(/\\s+/);
    
    let matches = 0;
    for (const word1 of words1) {
      if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
        matches++;
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
  }

  /**
   * Normalize text for comparison
   */
  private static normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\\w\\s]/g, '')
      .replace(/\\s+/g, ' ')
      .trim();
  }

  /**
   * Check if conversation should receive follow-up
   */
  static shouldSendFollowUp(
    session: ConversationSession, 
    hoursInactive: number
  ): boolean {
    // Don't follow up if already booked or ended conversation
    if (session.hasBooked || session.currentState === 'END') {
      return false;
    }
    
    // Don't send too many follow-ups
    const followUpCount = parseInt(session.leadData.followUpCount || '0');
    if (followUpCount >= 2) {
      return false;
    }
    
    // Send first follow-up after 12 hours
    if (hoursInactive >= 12 && followUpCount === 0) {
      return true;
    }
    
    // Send second follow-up after 48 hours
    if (hoursInactive >= 48 && followUpCount === 1) {
      return true;
    }
    
    return false;
  }
}