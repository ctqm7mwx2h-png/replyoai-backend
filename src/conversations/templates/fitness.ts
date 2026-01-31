import { ConversationFlow } from '../types.js';

export const fitnessFlow: ConversationFlow = {
  START: {
    message: (businessData: any) => 
      `💪 Hey there! Welcome to ${businessData.business_name || 'our fitness studio'}\n\nReady to transform your fitness journey?`,
    quickReplies: [
      { title: '🎯 Book training session', next: 'QUALIFY', action: 'book' },
      { title: '💰 Pricing & packages', next: 'PRICES', action: 'qualify' },
      { title: '📍 Gym location', next: 'LOCATION', action: 'location' },
      { title: '❓ Ask a question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 12
  },

  QUALIFY: {
    message: 'Awesome! 🔥\n\nWhat are your fitness goals? (e.g., weight loss, muscle gain, strength, endurance)',
    quickReplies: [
      { title: '🏃‍♂️ Weight loss', next: 'QUALIFY_TIMING' },
      { title: '💪 Muscle building', next: 'QUALIFY_TIMING' },
      { title: '🏋️‍♀️ Strength training', next: 'QUALIFY_TIMING' },
      { title: '🏃 Endurance/cardio', next: 'QUALIFY_TIMING' },
      { title: '🎯 Other goals', next: 'QUALIFY_TIMING' }
    ],
    isQualifying: true,
    qualificationField: 'lead_service'
  },

  QUALIFY_TIMING: {
    message: 'Perfect choice! 💯\n\nWhen would you like to start?',
    quickReplies: [
      { title: '⚡ This week', next: 'BOOK' },
      { title: '📅 Next week', next: 'BOOK' },
      { title: '🗓️ This month', next: 'BOOK' },
      { title: '🤔 Just exploring', next: 'BOOK' }
    ],
    isQualifying: true,
    qualificationField: 'lead_urgency'
  },

  BOOK: {
    message: (businessData: any, conversationData?: any) => {
      const goal = conversationData?.leadData?.lead_service || 'your fitness goals';
      const bookingLink = businessData.booking_link || '#';
      
      return `Let's crush ${goal} together! 💥\n\nBook your session here:\n${bookingLink}\n\nOr call ${businessData.phone || 'us'} to get started immediately!`;
    },
    quickReplies: [
      { title: '📞 Call to discuss', next: 'LOCATION' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '✅ All set!', next: 'END' }
    ],
    isBookingState: true,
    followUpAfterHours: 12
  },

  PRICES: {
    message: 'Our training packages are designed for results! 🎯\n\nWe offer personal training, group sessions, and nutrition coaching. Best way to get exact pricing is a quick consultation:',
    quickReplies: [
      { title: '📅 Book consultation', next: 'QUALIFY', action: 'book' },
      { title: '📍 Visit our gym', next: 'LOCATION' },
      { title: '❓ Specific questions', next: 'QUESTION' }
    ]
  },

  LOCATION: {
    message: (businessData: any) =>
      `📍 **Gym Location:**\n${businessData.location || 'Contact us for location'}\n\n⏰ **Training Hours:**\n${businessData.hours || 'Flexible scheduling available'}\n\n📞 **Phone:**\n${businessData.phone || 'Contact us'}`,
    quickReplies: [
      { title: '💪 Book training', next: 'QUALIFY', action: 'book' },
      { title: '💰 See packages', next: 'PRICES' },
      { title: '❓ Ask question', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: 'Absolutely! 💬\n\nWhat would you like to know? I\'m here to help you succeed!',
    quickReplies: [
      { title: '💰 Pricing info', next: 'PRICES' },
      { title: '🎯 Book session', next: 'QUALIFY' },
      { title: '📍 Location & hours', next: 'LOCATION' }
    ]
  },

  FOLLOW_UP: {
    message: (businessData: any, conversationData?: any) => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      
      if (followUpCount === 0) {
        return `Hey! 💪\n\nStill ready to start your fitness transformation with ${businessData.business_name}?\n\nDon't let another day pass - let's get you moving! 🔥`;
      } else {
        return `Final call! 🚨\n\nYour future self will thank you for starting today at ${businessData.business_name}.\n\nBook now and transform your life! 💯`;
      }
    },
    quickReplies: [
      { title: '🔥 Yes, let\'s do this!', next: 'QUALIFY' },
      { title: '❓ Have questions', next: 'QUESTION' },
      { title: '🚫 Not ready', next: 'END' }
    ],
    followUpAfterHours: 48
  },

  END: {
    message: 'Thank you! 🙏\n\nRemember, every expert was once a beginner. We\'re here when you\'re ready! 💪',
    quickReplies: [
      { title: '🎯 Actually, let\'s book', next: 'QUALIFY' },
      { title: '📍 Get location', next: 'LOCATION' }
    ]
  }
};