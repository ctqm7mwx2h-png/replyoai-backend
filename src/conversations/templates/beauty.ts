import { ConversationFlow } from '../types.js';

export const beautyFlow: ConversationFlow = {
  START: {
    message: (businessData: any) => 
      `💄 Hi there! Welcome to ${businessData.business_name || 'our salon'}\n\nHow can we help you today?`,
    quickReplies: [
      { title: '💅 Book an appointment', next: 'QUALIFY', action: 'book' },
      { title: '💰 Prices & services', next: 'PRICES', action: 'qualify' },
      { title: '📍 Location & hours', next: 'LOCATION', action: 'location' },
      { title: '❓ Ask a question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 12
  },

  QUALIFY: {
    message: 'Perfect! 💕\n\nWhat service are you looking for? (e.g., nails, lashes, facial, massage)',
    quickReplies: [
      { title: '💅 Nail services', next: 'QUALIFY_TIMING' },
      { title: '👁️ Lash services', next: 'QUALIFY_TIMING' },
      { title: '✨ Facial treatment', next: 'QUALIFY_TIMING' },
      { title: '💆 Massage therapy', next: 'QUALIFY_TIMING' },
      { title: '🎨 Other service', next: 'QUALIFY_TIMING' }
    ],
    isQualifying: true,
    qualificationField: 'lead_service'
  },

  QUALIFY_TIMING: {
    message: 'Great choice! ⭐\n\nWhen are you looking to book?',
    quickReplies: [
      { title: '📅 Today', next: 'BOOK' },
      { title: '📆 This week', next: 'BOOK' },
      { title: '🗓️ Next week', next: 'BOOK' },
      { title: '🔮 Just planning ahead', next: 'BOOK' }
    ],
    isQualifying: true,
    qualificationField: 'lead_urgency'
  },

  BOOK: {
    message: (businessData: any, conversationData?: any) => {
      const service = conversationData?.leadData?.lead_service || 'your service';
      const bookingLink = businessData.booking_link || '#';
      
      return `Excellent! 🎉\n\nClick here to book ${service}:\n${bookingLink}\n\nOr call us at ${businessData.phone || 'our number'} for immediate booking.`;
    },
    quickReplies: [
      { title: '📞 Call instead', next: 'LOCATION' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '✅ All set, thanks!', next: 'END' }
    ],
    isBookingState: true,
    followUpAfterHours: 12
  },

  PRICES: {
    message: (businessData: any) =>
      `Our prices vary by service and treatment time 💎\n\nMost clients find our rates very competitive! Here's how to see our full price list:\n\n${businessData.booking_link || 'Contact us for pricing'}`,
    quickReplies: [
      { title: '📅 Book consultation', next: 'QUALIFY', action: 'book' },
      { title: '📍 Visit our location', next: 'LOCATION' },
      { title: '❓ Specific questions', next: 'QUESTION' }
    ]
  },

  LOCATION: {
    message: (businessData: any) =>
      `📍 **Location:**\n${businessData.location || 'Contact us for location'}\n\n⏰ **Hours:**\n${businessData.hours || 'Contact us for hours'}\n\n📞 **Phone:**\n${businessData.phone || 'Contact us'}`,
    quickReplies: [
      { title: '📅 Book appointment', next: 'QUALIFY', action: 'book' },
      { title: '💰 See prices', next: 'PRICES' },
      { title: '❓ Ask question', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: 'Of course! 💬\n\nWhat would you like to know? Type your question below and we\'ll help you out.',
    quickReplies: [
      { title: '💰 Pricing info', next: 'PRICES' },
      { title: '📅 Book appointment', next: 'QUALIFY' },
      { title: '📍 Location & hours', next: 'LOCATION' }
    ]
  },

  FOLLOW_UP: {
    message: (businessData: any, conversationData?: any) => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      
      if (followUpCount === 0) {
        return `Hi again! 👋\n\nJust wanted to check if you're still interested in booking with ${businessData.business_name}?\n\nWe'd love to help you look and feel amazing! ✨`;
      } else {
        return `Last chance! 💎\n\nWe have some availability opening up this week at ${businessData.business_name}.\n\nBook now to secure your spot! 📅`;
      }
    },
    quickReplies: [
      { title: '✅ Yes, let\'s book!', next: 'QUALIFY' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '🚫 Not interested', next: 'END' }
    ],
    followUpAfterHours: 48
  },

  END: {
    message: 'Thank you so much! 💕\n\nWe can\'t wait to see you soon. Have a beautiful day! ✨',
    quickReplies: [
      { title: '📅 Actually, let me book', next: 'QUALIFY' },
      { title: '📍 Get location', next: 'LOCATION' }
    ]
  }
};