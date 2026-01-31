import { ConversationFlow } from '../types.js';

export const cleaningFlow: ConversationFlow = {
  START: {
    message: (businessData: any) => 
      `🏠 Hi! Welcome to ${businessData.business_name || 'our cleaning service'}\n\nHow can we help make your space spotless?`,
    quickReplies: [
      { title: '📅 Book cleaning', next: 'QUALIFY', action: 'book' },
      { title: '💰 Get pricing', next: 'PRICES', action: 'qualify' },
      { title: '📍 Service areas', next: 'LOCATION', action: 'location' },
      { title: '❓ Ask question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 12
  },

  QUALIFY: {
    message: 'Perfect! ✨\n\nWhat type of cleaning do you need? (e.g., regular cleaning, deep clean, move-in/out, office)',
    quickReplies: [
      { title: '🏡 Regular home cleaning', next: 'QUALIFY_TIMING' },
      { title: '🧽 Deep cleaning', next: 'QUALIFY_TIMING' },
      { title: '📦 Move-in/out cleaning', next: 'QUALIFY_TIMING' },
      { title: '🏢 Office cleaning', next: 'QUALIFY_TIMING' },
      { title: '✨ Other service', next: 'QUALIFY_TIMING' }
    ],
    isQualifying: true,
    qualificationField: 'lead_service'
  },

  QUALIFY_TIMING: {
    message: 'Great choice! 🌟\n\nWhen do you need this done?',
    quickReplies: [
      { title: '⚡ ASAP', next: 'BOOK' },
      { title: '📅 This week', next: 'BOOK' },
      { title: '🗓️ Next week', next: 'BOOK' },
      { title: '📋 Getting quotes', next: 'BOOK' }
    ],
    isQualifying: true,
    qualificationField: 'lead_urgency'
  },

  BOOK: {
    message: (businessData: any, conversationData?: any) => {
      const service = conversationData?.leadData?.lead_service || 'your cleaning';
      const bookingLink = businessData.booking_link || '#';
      
      return `Excellent! We'll make your space shine! ✨\n\nBook ${service} here:\n${bookingLink}\n\nOr call ${businessData.phone || 'us'} for immediate scheduling!`;
    },
    quickReplies: [
      { title: '📞 Call for quote', next: 'LOCATION' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '✅ All set!', next: 'END' }
    ],
    isBookingState: true,
    followUpAfterHours: 12
  },

  PRICES: {
    message: 'Our pricing depends on space size and service type 🏠\n\nWe offer competitive rates with no hidden fees! Best way to get accurate pricing:',
    quickReplies: [
      { title: '📅 Get free estimate', next: 'QUALIFY', action: 'book' },
      { title: '📍 Check service area', next: 'LOCATION' },
      { title: '❓ Pricing questions', next: 'QUESTION' }
    ]
  },

  LOCATION: {
    message: (businessData: any) =>
      `📍 **Service Areas:**\n${businessData.location || 'Contact us for service areas'}\n\n⏰ **Availability:**\n${businessData.hours || 'Flexible scheduling 7 days/week'}\n\n📞 **Phone:**\n${businessData.phone || 'Contact us'}`,
    quickReplies: [
      { title: '🏠 Book cleaning', next: 'QUALIFY', action: 'book' },
      { title: '💰 Get pricing', next: 'PRICES' },
      { title: '❓ Ask question', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: 'Of course! 💬\n\nWhat would you like to know? We\'re here to help make your life easier!',
    quickReplies: [
      { title: '💰 Pricing info', next: 'PRICES' },
      { title: '📅 Book service', next: 'QUALIFY' },
      { title: '📍 Service areas', next: 'LOCATION' }
    ]
  },

  FOLLOW_UP: {
    message: (businessData: any, conversationData?: any) => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      
      if (followUpCount === 0) {
        return `Hi again! 🏠\n\nStill need help with cleaning from ${businessData.business_name}?\n\nWe'd love to make your space sparkle! ✨`;
      } else {
        return `Don't let cleaning stress you out! 🧽\n\nLet the professionals at ${businessData.business_name} handle it.\n\nBook today for a spotless space! 🌟`;
      }
    },
    quickReplies: [
      { title: '✨ Yes, let\'s book!', next: 'QUALIFY' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '🚫 Not needed', next: 'END' }
    ],
    followUpAfterHours: 48
  },

  END: {
    message: 'Thank you! 🙏\n\nWe\'re here whenever you need a spotless space. Have a wonderful day! ✨',
    quickReplies: [
      { title: '🏠 Actually, let\'s book', next: 'QUALIFY' },
      { title: '📍 Service areas', next: 'LOCATION' }
    ]
  }
};