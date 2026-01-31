// Universal conversation types for all industries
export interface QuickReply {
  title: string;
  next: string;
  action?: 'qualify' | 'book' | 'location' | 'question';
}

export interface ConversationState {
  message: string | ((businessData: any, conversationData?: any) => string);
  quickReplies?: QuickReply[];
  isQualifying?: boolean; // Indicates this state collects lead data
  qualificationField?: string; // Field to store in lead data
  isBookingState?: boolean; // Indicates this is a booking conversion point
  followUpAfterHours?: number; // Auto follow-up if no response
}

export interface ConversationFlow {
  // Required states for all industries
  START: ConversationState;
  QUALIFY: ConversationState;
  BOOK: ConversationState;
  PRICES: ConversationState;
  LOCATION: ConversationState;
  QUESTION: ConversationState;
  FOLLOW_UP: ConversationState;
  END: ConversationState;
  
  // Optional industry-specific states
  [key: string]: ConversationState;
}

export interface ConversationResult {
  state: string;
  message: string;
  quickReplies?: QuickReply[];
  shouldQualify?: boolean;
  qualificationData?: Record<string, string>;
  isBookingAttempt?: boolean;
  shouldFollowUp?: boolean;
  followUpHours?: number;
}

export interface ConversationSession {
  conversationId: string;
  currentState: string;
  lastActivity: number;
  industry: string;
  leadData: Record<string, string>;
  isQualified: boolean;
  hasBooked: boolean;
}

// Intent detection patterns for natural language processing
export const INTENT_PATTERNS = {
  BOOKING: [
    'book', 'appointment', 'schedule', 'reserve', 'when', 'available',
    'time', 'slot', 'calendar', 'today', 'tomorrow', 'this week'
  ],
  PRICING: [
    'price', 'cost', 'how much', 'rate', 'fee', 'expensive', 'cheap',
    'affordable', 'discount', 'deal', 'special', 'offer'
  ],
  LOCATION: [
    'where', 'location', 'address', 'directions', 'how to get',
    'parking', 'near', 'close', 'far', 'drive', 'walk'
  ],
  SERVICES: [
    'what', 'service', 'do you', 'offer', 'provide', 'specialize',
    'type', 'kind', 'style', 'treatment', 'package'
  ],
  URGENCY: {
    HIGH: ['today', 'now', 'urgent', 'asap', 'emergency', 'immediately'],
    MEDIUM: ['this week', 'soon', 'quickly', 'fast', 'tomorrow'],
    LOW: ['next week', 'next month', 'planning', 'eventually', 'future']
  },
  QUALIFICATION: {
    FIRST_TIME: ['first time', 'never been', 'new', 'never tried', 'first visit'],
    RETURNING: ['been before', 'came here', 'regular', 'usual', 'again'],
    COMPARISON: ['comparing', 'other places', 'vs', 'better', 'different', 'cheaper']
  }
};