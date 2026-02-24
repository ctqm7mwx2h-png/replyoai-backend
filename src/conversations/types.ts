// Universal conversation types for all industries

/**
 * Business data interface for conversation templates
 */
export interface BusinessData {
  business_name?: string;
  phone?: string;
  location?: string;
  hours?: string;
  booking_link?: string;
  website?: string;
  email?: string;
  [key: string]: any; // Allow additional custom fields
}

/**
 * Conversation session data and lead information
 */
export interface ConversationData {
  conversationId?: string;
  leadData?: Record<string, any>;
  followUpCount?: number;
  isQualified?: boolean;
  platform?: string;
  payload?: Record<string, any>; // Payload for state transitions
  [key: string]: any; // Allow additional custom fields
}

/**
 * Quick reply button with optional payload for structured data
 */
export interface QuickReply {
  title: string;
  next: string;
  action?: 'qualify' | 'book' | 'location' | 'question';
  payload?: Record<string, any>; // Structured data payload
}

/**
 * Conversation flow state definition
 */
export interface FlowState {
  message: string | ((businessData: BusinessData, conversationData?: ConversationData) => string | Promise<string>);
  quickReplies?: QuickReply[];
  isQualifying?: boolean; // Indicates this state collects lead data
  qualificationField?: string; // Field to store in lead data
  phoneValidation?: boolean; // Enables phone number validation
  isBookingState?: boolean; // Indicates this is a booking conversion point
  followUpAfterHours?: number; // Auto follow-up if no response
}

// Legacy interface for backward compatibility
export interface ConversationState extends FlowState {}

/**
 * Conversation flow type with required states
 */
export type ConversationFlow = Record<string, FlowState> & {
  // Required states for all industries
  START: FlowState;
  QUALIFY: FlowState;
  BOOK: FlowState;
  PRICES: FlowState;
  LOCATION: FlowState;
  QUESTION: FlowState;
  FOLLOW_UP: FlowState;
  END: FlowState;
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
  payload?: Record<string, any>; // Payload for state data
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