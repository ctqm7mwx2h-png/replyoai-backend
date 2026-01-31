import { ConversationFlow } from '../types.js';

export const plumbingFlow: ConversationFlow = {
  START: {
    message: (businessData: any) => 
      `🔧 Hello! Welcome to ${businessData.business_name || 'our plumbing service'}\n\nWhat plumbing issue can we help you with?`,
    quickReplies: [
      { title: '🚨 Emergency repair', next: 'QUALIFY', action: 'book' },
      { title: '🔧 Schedule service', next: 'QUALIFY', action: 'book' },
      { title: '💰 Get estimate', next: 'PRICES', action: 'qualify' },
      { title: '❓ Ask question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 6
  },

  QUALIFY: {
    message: 'We\'re here to help! 💪\n\nWhat type of plumbing work do you need? (e.g., leak repair, drain cleaning, installation, emergency)',
    quickReplies: [
      { title: '💧 Leak repair', next: 'QUALIFY_TIMING' },
      { title: '🚽 Toilet/drain issues', next: 'QUALIFY_TIMING' },
      { title: '🔧 Installation/replacement', next: 'QUALIFY_TIMING' },
      { title: '🚨 Emergency service', next: 'QUALIFY_TIMING' },
      { title: '🔍 Other issue', next: 'QUALIFY_TIMING' }
    ],
    isQualifying: true,
    qualificationField: 'lead_service'
  },

  QUALIFY_TIMING: {
    message: 'Got it! ⚡\n\nHow urgent is this?',
    quickReplies: [
      { title: '🚨 Emergency NOW', next: 'BOOK' },
      { title: '⚡ Today if possible', next: 'BOOK' },
      { title: '📅 This week', next: 'BOOK' },
      { title: '🗓️ Planning ahead', next: 'BOOK' }
    ],
    isQualifying: true,
    qualificationField: 'lead_urgency'
  },

  BOOK: {
    message: (businessData: any, conversationData?: any) => {
      const service = conversationData?.leadData?.lead_service || 'your plumbing issue';
      const urgency = conversationData?.leadData?.lead_urgency;
      const bookingLink = businessData.booking_link || '#';
      
      if (urgency === 'Emergency NOW') {
        return `🚨 Emergency service for ${service}!\n\nCall us RIGHT NOW: ${businessData.phone || 'our emergency line'}\n\nWe'll be there fast!`;
      }
      
      return `We'll fix ${service} quickly! 🔧\n\nSchedule here:\n${bookingLink}\n\nOr call ${businessData.phone || 'us'} for immediate dispatch!`;
    },
    quickReplies: [
      { title: '📞 Call now', next: 'LOCATION' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '✅ All set!', next: 'END' }
    ],
    isBookingState: true,
    followUpAfterHours: 6
  },

  PRICES: {
    message: 'Fair, transparent pricing with no surprises! 💯\n\nWe provide free estimates and upfront pricing. Emergency rates may apply for after-hours service.',
    quickReplies: [
      { title: '📅 Get free estimate', next: 'QUALIFY', action: 'book' },
      { title: '📍 Service areas', next: 'LOCATION' },
      { title: '❓ Pricing questions', next: 'QUESTION' }
    ]
  },

  LOCATION: {
    message: (businessData: any) =>
      `📍 **Service Areas:**\n${businessData.location || 'Contact us for service coverage'}\n\n⏰ **Availability:**\n${businessData.hours || '24/7 Emergency Service Available'}\n\n📞 **Emergency Line:**\n${businessData.phone || 'Contact us'}`,
    quickReplies: [
      { title: '🔧 Book service', next: 'QUALIFY', action: 'book' },
      { title: '💰 Get estimate', next: 'PRICES' },
      { title: '❓ Ask question', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: 'Absolutely! 🔧\n\nWhat can I help you with? We\'re the plumbing experts you can trust!',
    quickReplies: [
      { title: '💰 Pricing info', next: 'PRICES' },
      { title: '🔧 Book service', next: 'QUALIFY' },
      { title: '📍 Service areas', next: 'LOCATION' }
    ]
  },

  FOLLOW_UP: {
    message: (businessData: any, conversationData?: any) => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      
      if (followUpCount === 0) {
        return `Hi! 🔧\n\nDid you get that plumbing issue resolved? ${businessData.business_name} is still ready to help!\n\nDon't let small problems become big ones! 💧`;
      } else {
        return `Plumbing problems don't fix themselves! 🚨\n\n${businessData.business_name} offers quick, reliable service.\n\nCall now before it gets worse! 🔧`;
      }
    },
    quickReplies: [
      { title: '🔧 Yes, need help!', next: 'QUALIFY' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '✅ All fixed', next: 'END' }
    ],
    followUpAfterHours: 24
  },

  END: {
    message: 'Thank you! 🙏\n\nWe\'re always here for your plumbing needs. Stay leak-free! 🔧',
    quickReplies: [
      { title: '🔧 Actually, need service', next: 'QUALIFY' },
      { title: '📍 Service areas', next: 'LOCATION' }
    ]
  }
};