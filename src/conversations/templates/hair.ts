import { ConversationFlow } from '../types.js';

export const hairFlow: ConversationFlow = {
  START: {
    message: (businessData: any) => 
      `✂️ Hey! Thanks for messaging ${businessData.business_name || 'us'}\n\nHow can we help you today?`,
    quickReplies: [
      { title: '📅 Book an appointment', next: 'QUALIFY', action: 'book' },
      { title: '💰 Prices', next: 'PRICES', action: 'qualify' },
      { title: '📍 Location & hours', next: 'LOCATION', action: 'location' },
      { title: '❓ Ask a question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 12
  },

  QUALIFY: {
    message: 'Perfect! 👌\n\nWhat service are you looking for? (e.g., haircut, color, styling, beard trim)',
    quickReplies: [
      { title: '✂️ Haircut', next: 'QUALIFY_TIMING' },
      { title: '🎨 Hair color', next: 'QUALIFY_TIMING' },
      { title: '🧔 Beard trim', next: 'QUALIFY_TIMING' },
      { title: '💇 Styling', next: 'QUALIFY_TIMING' },
      { title: '🔥 Other service', next: 'QUALIFY_TIMING' }
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
    message: 'Our prices depend on the service and your hair type ✂️\n\nMost clients either book directly or start with a consultation here:',
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
    message: 'No problem at all 👍\n\nJust type your question below and we\'ll take care of it.',
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
        return `Hey! 👋\n\nStill need that fresh cut at ${businessData.business_name}?\n\nWe've got some great slots opening up! ✂️`;
      } else {
        return `Last call! 🔥\n\nDon't miss out on booking with our top barbers at ${businessData.business_name}.\n\nClick below to secure your spot! 📅`;
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
    message: 'Thank you! 🙏\n\nLooking forward to seeing you soon. Have a great day! ✂️',
    quickReplies: [
      { title: '📅 Actually, let me book', next: 'QUALIFY' },
      { title: '📍 Get location', next: 'LOCATION' }
    ]
  }
};