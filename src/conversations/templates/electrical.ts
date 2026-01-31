import { ConversationFlow } from '../types.js';

export const electricalFlow: ConversationFlow = {
  START: {
    message: (businessData: any) => 
      `⚡ Hello! Welcome to ${businessData.business_name || 'our electrical service'}\n\nWhat electrical work can we help you with?`,
    quickReplies: [
      { title: '🚨 Emergency electrical', next: 'QUALIFY', action: 'book' },
      { title: '⚡ Schedule service', next: 'QUALIFY', action: 'book' },
      { title: '💰 Get estimate', next: 'PRICES', action: 'qualify' },
      { title: '❓ Ask question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 6
  },

  QUALIFY: {
    message: 'Safety first! ⚡\n\nWhat type of electrical work do you need? (e.g., outlet/switch, panel upgrade, wiring, lighting)',
    quickReplies: [
      { title: '🔌 Outlets/switches', next: 'QUALIFY_TIMING' },
      { title: '💡 Lighting installation', next: 'QUALIFY_TIMING' },
      { title: '🏠 Panel/wiring upgrade', next: 'QUALIFY_TIMING' },
      { title: '🚨 Emergency repair', next: 'QUALIFY_TIMING' },
      { title: '⚡ Other electrical', next: 'QUALIFY_TIMING' }
    ],
    isQualifying: true,
    qualificationField: 'lead_service'
  },

  QUALIFY_TIMING: {
    message: 'Perfect! ⚡\n\nHow soon do you need this done?',
    quickReplies: [
      { title: '🚨 Emergency - NOW', next: 'BOOK' },
      { title: '⚡ Today/ASAP', next: 'BOOK' },
      { title: '📅 This week', next: 'BOOK' },
      { title: '🗓️ Planning project', next: 'BOOK' }
    ],
    isQualifying: true,
    qualificationField: 'lead_urgency'
  },

  BOOK: {
    message: (businessData: any, conversationData?: any) => {
      const service = conversationData?.leadData?.lead_service || 'your electrical work';
      const urgency = conversationData?.leadData?.lead_urgency;
      const bookingLink = businessData.booking_link || '#';
      
      if (urgency === 'Emergency - NOW') {
        return `🚨 ELECTRICAL EMERGENCY!\n\nFor ${service} - Call immediately: ${businessData.phone || 'our emergency line'}\n\nLicensed electrician dispatching now! ⚡`;
      }
      
      return `Licensed & insured for ${service}! ⚡\n\nSchedule here:\n${bookingLink}\n\nOr call ${businessData.phone || 'us'} for immediate service!`;
    },
    quickReplies: [
      { title: '📞 Call electrician', next: 'LOCATION' },
      { title: '❓ Safety questions', next: 'QUESTION' },
      { title: '✅ All set!', next: 'END' }
    ],
    isBookingState: true,
    followUpAfterHours: 6
  },

  PRICES: {
    message: 'Licensed, insured, and fairly priced! ⚡\n\nWe provide free estimates and transparent pricing. All work meets electrical code requirements.',
    quickReplies: [
      { title: '📅 Free estimate', next: 'QUALIFY', action: 'book' },
      { title: '📍 Service areas', next: 'LOCATION' },
      { title: '❓ Pricing questions', next: 'QUESTION' }
    ]
  },

  LOCATION: {
    message: (businessData: any) =>
      `📍 **Service Areas:**\n${businessData.location || 'Contact us for service coverage'}\n\n⏰ **Availability:**\n${businessData.hours || '24/7 Emergency Electrical Service'}\n\n📞 **Licensed Electrician:**\n${businessData.phone || 'Contact us'}`,
    quickReplies: [
      { title: '⚡ Book service', next: 'QUALIFY', action: 'book' },
      { title: '💰 Get estimate', next: 'PRICES' },
      { title: '❓ Ask question', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: 'Safety is our priority! ⚡\n\nWhat electrical questions do you have? Our licensed electricians are here to help!',
    quickReplies: [
      { title: '💰 Pricing info', next: 'PRICES' },
      { title: '⚡ Book service', next: 'QUALIFY' },
      { title: '📍 Service areas', next: 'LOCATION' }
    ]
  },

  FOLLOW_UP: {
    message: (businessData: any, conversationData?: any) => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      
      if (followUpCount === 0) {
        return `Hi! ⚡\n\nDid you get that electrical work taken care of? ${businessData.business_name} is ready to help safely!\n\nDon't risk DIY electrical work! 🚨`;
      } else {
        return `Electrical issues can be dangerous! ⚡\n\n${businessData.business_name} provides safe, licensed electrical service.\n\nProtect your family - call today! 🏠`;
      }
    },
    quickReplies: [
      { title: '⚡ Yes, need electrician!', next: 'QUALIFY' },
      { title: '❓ Safety questions', next: 'QUESTION' },
      { title: '✅ All handled', next: 'END' }
    ],
    followUpAfterHours: 24
  },

  END: {
    message: 'Thank you! 🙏\n\nStay safe and remember - we\'re here for all your electrical needs! ⚡',
    quickReplies: [
      { title: '⚡ Actually, need service', next: 'QUALIFY' },
      { title: '📍 Service areas', next: 'LOCATION' }
    ]
  }
};