import { ConversationFlow, ConversationState } from './states/beauty.js';

export interface ConversationResult {
  state: string;
  message: string;
  quickReplies?: string[];
}

export class ConversationEngine {
  /**
   * Process user input and return next conversation state
   */
  static processMessage(
    flow: ConversationFlow,
    currentState: string,
    userInput: string,
    businessData: any
  ): ConversationResult {
    // Get current state definition
    const stateDefinition = flow[currentState];
    if (!stateDefinition) {
      // Fallback to START if state doesn't exist
      return this.processMessage(flow, 'START', userInput, businessData);
    }

    // Check if user input matches a quick reply
    let nextState = currentState;
    if (stateDefinition.quickReplies) {
      const matchingReply = stateDefinition.quickReplies.find(reply => 
        this.normalizeInput(userInput) === this.normalizeInput(reply.title) ||
        this.normalizeInput(userInput).includes(this.normalizeInput(reply.next))
      );
      
      if (matchingReply) {
        nextState = matchingReply.next;
      } else {
        // Try to match keywords to navigate intelligently
        nextState = this.matchKeywords(userInput) || currentState;
      }
    }

    // Get next state definition
    const nextStateDefinition = flow[nextState];
    if (!nextStateDefinition) {
      // Fallback to START if next state doesn't exist
      nextState = 'START';
    }

    // Generate response
    const response = this.generateResponse(flow[nextState], businessData);
    
    return {
      state: nextState,
      message: response.message,
      quickReplies: response.quickReplies
    };
  }

  /**
   * Generate response from state definition
   */
  private static generateResponse(
    stateDefinition: ConversationState,
    businessData: any
  ): { message: string; quickReplies?: string[] } {
    // Generate message
    let message: string;
    if (typeof stateDefinition.message === 'function') {
      message = stateDefinition.message(businessData);
    } else {
      message = stateDefinition.message;
    }

    // Generate quick replies
    let quickReplies: string[] | undefined;
    if (stateDefinition.quickReplies) {
      quickReplies = stateDefinition.quickReplies.map(reply => reply.title);
    }

    return { message, quickReplies };
  }

  /**
   * Match user input to conversation flow based on keywords
   */
  private static matchKeywords(userInput: string): string | null {
    const normalizedInput = this.normalizeInput(userInput);

    // Booking keywords
    if (this.containsKeywords(normalizedInput, ['book', 'appointment', 'schedule', 'reserve'])) {
      return 'BOOK';
    }

    // Pricing keywords
    if (this.containsKeywords(normalizedInput, ['price', 'cost', 'how much', 'pricing', 'rates'])) {
      return 'PRICES';
    }

    // Location keywords
    if (this.containsKeywords(normalizedInput, ['location', 'where', 'address', 'hours', 'when', 'time'])) {
      return 'LOCATION';
    }

    // Question keywords
    if (this.containsKeywords(normalizedInput, ['question', 'ask', 'help', 'info', 'about'])) {
      return 'QUESTION';
    }

    // Greeting keywords
    if (this.containsKeywords(normalizedInput, ['hi', 'hello', 'hey', 'start', 'menu', 'begin'])) {
      return 'START';
    }

    // End keywords
    if (this.containsKeywords(normalizedInput, ['bye', 'goodbye', 'thanks', 'thank you', 'done'])) {
      return 'END';
    }

    return null;
  }

  /**
   * Normalize user input for comparison
   */
  private static normalizeInput(input: string): string {
    return input.toLowerCase().trim();
  }

  /**
   * Check if input contains any of the specified keywords
   */
  private static containsKeywords(normalizedInput: string, keywords: string[]): boolean {
    return keywords.some(keyword => normalizedInput.includes(keyword));
  }

  /**
   * Get initial state for a conversation
   */
  static getInitialState(): string {
    return 'START';
  }

  /**
   * Check if a state exists in the flow
   */
  static isValidState(flow: ConversationFlow, state: string): boolean {
    return state in flow;
  }
}