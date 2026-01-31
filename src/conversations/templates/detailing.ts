import { ConversationFlow } from '../types.js';

export const detailingFlow: ConversationFlow = {
  START: {
    message: (businessData: any) => 
      `🚗 Hey! Welcome to ${businessData.business_name || 'our detailing shop'}\n\nReady to make your car look brand new?`,
    quickReplies: [
      { title: '✨ Book detailing', next: 'QUALIFY', action: 'book' },
      { title: '💰 See packages', next: 'PRICES', action: 'qualify' },
      { title: '📍 Our location', next: 'LOCATION', action: 'location' },
      { title: '❓ Ask question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 12
  },

  QUALIFY: {
    message: 'Awesome! 🔥\n\nWhat type of detailing does your car need? (e.g., full detail, wash/wax, interior, paint correction)',
    quickReplies: [
      { title: '✨ Full detail package', next: 'QUALIFY_TIMING' },
      { title: '🧽 Wash & wax', next: 'QUALIFY_TIMING' },
      { title: '🪑 Interior detailing', next: 'QUALIFY_TIMING' },
      { title: '🎨 Paint correction', next: 'QUALIFY_TIMING' },
      { title: '🚗 Other service', next: 'QUALIFY_TIMING' }
    ],
    isQualifying: true,
    qualificationField: 'lead_service'
  },

  QUALIFY_TIMING: {
    message: 'Perfect choice! 🌟\n\nWhen would you like to bring your car in?',
    quickReplies: [
      { title: '📅 This week', next: 'BOOK' },
      { title: '🗓️ Next week', next: 'BOOK' },
      { title: '📋 This month', next: 'BOOK' },
      { title: '🤔 Just browsing', next: 'BOOK' }
    ],
    isQualifying: true,
    qualificationField: 'lead_urgency'
  },

  BOOK: {
    message: (businessData: any, conversationData?: any) => {
      const service = conversationData?.leadData?.lead_service || 'your car detailing';
      const bookingLink = businessData.booking_link || '#';
      
      return `Your car will look incredible! 🤩\n\nBook ${service} here:\n${bookingLink}\n\nOr call ${businessData.phone || 'us'} to schedule now!`;
    },
    quickReplies: [
      { title: '📞 Call to book', next: 'LOCATION' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '✅ All set!', next: 'END' }
    ],
    isBookingState: true,
    followUpAfterHours: 12
  },

  PRICES: {
    message: 'Premium detailing at competitive prices! 💎\n\nWe offer packages from basic wash to full paint protection. Every car gets VIP treatment:',
    quickReplies: [
      { title: '📅 Book & see pricing', next: 'QUALIFY', action: 'book' },
      { title: '📍 Visit our shop', next: 'LOCATION' },
      { title: '❓ Package questions', next: 'QUESTION' }
    ]
  },

  LOCATION: {
    message: (businessData: any) =>
      `📍 **Shop Location:**\n${businessData.location || 'Contact us for location'}\n\n⏰ **Hours:**\n${businessData.hours || 'Contact us for hours'}\n\n📞 **Phone:**\n${businessData.phone || 'Contact us'}`,
    quickReplies: [
      { title: '🚗 Book detailing', next: 'QUALIFY', action: 'book' },
      { title: '💰 See packages', next: 'PRICES' },
      { title: '❓ Ask question', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: 'Absolutely! 🚗\n\nWhat would you like to know? We\'re passionate about making cars look amazing!',
    quickReplies: [
      { title: '💰 Pricing info', next: 'PRICES' },
      { title: '✨ Book service', next: 'QUALIFY' },
      { title: '📍 Location & hours', next: 'LOCATION' }
    ]
  },

  FOLLOW_UP: {
    message: (businessData: any, conversationData?: any) => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      
      if (followUpCount === 0) {
        return `Hey! 🚗\n\nStill want to give your car that showroom shine at ${businessData.business_name}?\n\nDon't let your car stay dirty - book today! ✨`;
      } else {
        return `Your car deserves better! 🔥\n\n${businessData.business_name} will make it look incredible.\n\nBook now and drive with pride! 🌟`;
      }
    },
    quickReplies: [
      { title: '✨ Yes, let\'s book!', next: 'QUALIFY' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '🚫 Not interested', next: 'END' }
    ],
    followUpAfterHours: 48
  },

  END: {
    message: 'Thank you! 🙏\n\nWe\'re here whenever your car needs that VIP treatment! 🚗✨',
    quickReplies: [
      { title: '✨ Actually, let\'s book', next: 'QUALIFY' },
      { title: '📍 Get location', next: 'LOCATION' }
    ]
  }
};