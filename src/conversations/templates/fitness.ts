import { ConversationFlow, BusinessData, ConversationData } from '../types.js';
import { processHotLead } from '../../services/hot-leads.service.js';
import { trackEvent } from '../../services/analytics.js';
import { saveLead } from '../../services/leads.js';
import { validateUrl } from '../../utils/validateUrl.js';
import { generateCalendlyLink } from '../../utils/calendly.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger();

export const fitnessFlow: ConversationFlow = {
  START: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'conversation_started');
      
      const businessName = businessData.business_name || 'Elite Fitness Coaching';
      const socialProof = businessData.rating && businessData.reviews_count ? 
        `⭐ ${businessData.rating}/5 (${businessData.reviews_count} transformations)` :
        `🏆 Results-Driven Coaching`;
      const scarcity = businessData.available_slots && businessData.available_slots <= 10 ? 
        `🎯 ${businessData.available_slots} coaching spots available` : '🎯 Limited monthly coaching intake';
      
      return `💪 **${businessName}**\n${socialProof}\n${scarcity}\n\nTransform your physique with proven coaching methods\n\n🎯 **Apply for premium coaching**`;
    },
    quickReplies: [
      { title: '🎯 Apply for coaching', next: 'QUALIFY_GOAL', action: 'book', payload: { intent: 'coaching_application' } },
      { title: '💰 View programs', next: 'PRICES', action: 'qualify', payload: { intent: 'pricing_inquiry' } },
      { title: '📞 Coach consultation', next: 'QUESTION', action: 'question', payload: { intent: 'consultation' } }
    ],
    followUpAfterHours: 12
  },

  // Interface compatibility
  QUALIFY: {
    message: async (): Promise<string> => {
      return `🏆 What's your primary fitness objective?`;
    },
    quickReplies: [
      { title: '🔥 Fat loss', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'fat_loss' } },
      { title: '💪 Muscle gain', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'muscle_gain' } },
      { title: '🏋️ Strength building', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'strength' } },
      { title: '✨ Body transformation', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'transformation' } }
    ],
    isQualifying: true,
    qualificationField: 'fitness_goal'
  },

  QUALIFY_GOAL: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'goal_selected');
      
      return `� **Elite Coaching Application**\n\nSelect your specialization track:\n🏆 Each coach specializes in specific outcomes`;
    },
    quickReplies: [
      { title: '🔥 Fat Loss Physique', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'fat_loss' } },
      { title: '💪 Hypertrophy Program', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'muscle_gain' } },
      { title: '🏋️ Strength Performance', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'strength' } },
      { title: '✨ Complete Transformation', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'transformation' } },
      { title: '🏆 Competition Prep', next: 'QUALIFY_LEVEL', payload: { fitness_goal: 'competition_prep' } }
    ],
    isQualifying: true,
    qualificationField: 'fitness_goal'
  },

  QUALIFY_LEVEL: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'level_selected');
      
      return `🎯 **Step 2 - Experience Level**\n\nWhat's your training experience?\n📊 Determines coaching intensity level`;
    },
    quickReplies: [
      { title: '🌱 Beginner (0-1 year)', next: 'QUALIFY_URGENCY', payload: { fitness_level: 'beginner' } },
      { title: '⚡ Intermediate (1-3 years)', next: 'QUALIFY_URGENCY', payload: { fitness_level: 'intermediate' } },
      { title: '🏆 Advanced (3+ years)', next: 'QUALIFY_URGENCY', payload: { fitness_level: 'advanced' } }
    ],
    isQualifying: true,
    qualificationField: 'fitness_level'
  },

  QUALIFY_URGENCY: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'urgency_selected');
      
      return `⚡ **Step 3 - Start Timeline**\n\nWhen do you want to begin coaching?\n🚀 Immediate starts get priority coach assignment`;
    },
    quickReplies: [
      { title: '🚀 Start this week', next: 'QUALIFY_COMMITMENT', payload: { urgency: 'immediate' } },
      { title: '📅 Start this month', next: 'QUALIFY_COMMITMENT', payload: { urgency: 'this_month' } },
      { title: '🤔 Just researching', next: 'QUALIFY_COMMITMENT', payload: { urgency: 'research' } }
    ],
    isQualifying: true,
    qualificationField: 'urgency'
  },

  QUALIFY_COMMITMENT: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'commitment_selected');
      
      return `🏆 **Elite coaching requires serious commitment**\n\nAre you ready to follow a structured training plan for at least 12 weeks?\n💯 Dedicated clients see the best results`;
    },
    quickReplies: [
      { title: '✅ Yes, fully committed', next: 'REQUEST_PHONE', payload: { commitment: 'high' } },
      { title: '🤔 Not sure yet', next: 'REQUEST_PHONE', payload: { commitment: 'low' } }
    ],
    isQualifying: true,
    qualificationField: 'commitment'
  },

  REQUEST_PHONE: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const invalidPhone = conversationData?.payload?.phone_invalid;
      const urgency = conversationData?.payload?.urgency;
      
      await trackEvent(businessData.id || 'unknown', 'phone_requested');
      
      if (invalidPhone) {
        return `❌ Invalid format\n\nUK mobile required: +447912345678 or 07912345678\n⏰ Spot held for 2 hours pending confirmation`;
      }
      
      const priorityText = urgency === 'immediate' ? 
        '🔥 **Priority Coach Assignment**' : '🎯 **Elite Coach Assignment**';
      
      return `${priorityText}\n⏰ **Spot held for 2 hours pending confirmation**\n\nMobile required for:\n• Specialized coach assignment\n• Elite training schedule coordination\n• Advanced progress tracking access\n\n📱 Format: 07912345678`;
    },
    quickReplies: [
      { title: '📞 Provide mobile', next: 'REQUEST_PHONE', payload: { awaiting_phone: true } }
    ],
    isQualifying: true,
    qualificationField: 'phone',
    phoneValidation: true,
    followUpAfterHours: 4
  },

  BOOK: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      try {
        // Process hot lead with scoring
        const leadScoringData = {
          urgency: conversationData?.payload?.urgency || 'research',
          serviceTier: 'fitness',
          fitnessGoal: conversationData?.payload?.fitness_goal || 'unknown',
          fitnessLevel: conversationData?.payload?.fitness_level || 'beginner',
          commitment: conversationData?.payload?.commitment || 'low',
          priority: (conversationData?.payload?.urgency === 'immediate' && conversationData?.payload?.commitment === 'high') ? 'high' : 'standard'
        };
        
        const result = await processHotLead({
          businessId: businessData.id || 'unknown',
          conversationId: conversationData?.conversationId,
          userId: conversationData?.userId || 'unknown',
          phone: conversationData?.payload?.phone,
          ...leadScoringData
        });
        
        // Legacy lead saving
        const legacyLeadData = {
          fitness_goal: conversationData?.payload?.fitness_goal || 'unknown',
          fitness_level: conversationData?.payload?.fitness_level || 'beginner',
          urgency: conversationData?.payload?.urgency || 'research',
          commitment: conversationData?.payload?.commitment || 'low',
          service_tier: 'fitness_coaching',
          source: 'fitness_premium_funnel',
          phone: conversationData?.payload?.phone || 'not_provided',
          timestamp: new Date().toISOString(),
          score: result.score
        };
        
        await saveLead(businessData.id || 'unknown', legacyLeadData);
        await trackEvent(businessData.id || 'unknown', 'lead_saved');
        
        // Dynamic scarcity calculation
        const scarcityText = businessData.available_slots && businessData.available_slots > 1
          ? `⚡ ${businessData.available_slots - 1} coaching spots remaining`
          : '⚡ Final coaching spots remaining';
        
        // 3-tier status hierarchy based on score
        let statusMessage;
        if (result.score > 85) {
          statusMessage = '🔥 **Priority Coaching Candidate**';
        } else if (result.score > 60) {
          statusMessage = '🏆 **Application Approved – Coach Review Pending**';
        } else {
          statusMessage = '📋 **Application Received – Limited Spots Available**';
        }
        
        // Goal mapping for human-readable labels
        const goalMapping = {
          'fat_loss': 'Fat Loss Specialist',
          'muscle_gain': 'Hypertrophy Specialist',
          'strength': 'Strength Performance Coach',
          'transformation': 'Transformation Specialist',
          'competition_prep': 'Competition Prep Coach'
        };
        
        const rawGoal = conversationData?.payload?.fitness_goal || 'unknown';
        const goalText = goalMapping[rawGoal as keyof typeof goalMapping] || 'Elite coach assigned';
        
        // Soft qualification for research users
        const researchWarning = conversationData?.payload?.urgency === 'research' ?
          '\n⚠️ Applications are prioritized for clients ready to start within 30 days.' : '';
        
        // Booking fallback chain: booking_link → calendly → phone
        const bookingUrl = businessData.booking_link;
        const hasValidBooking = bookingUrl && validateUrl(bookingUrl);
        
        if (hasValidBooking) {
          await trackEvent(businessData.id || 'unknown', 'booking_link_provided');
          return `${statusMessage} | ${scarcityText}\n${goalText} | Structured periodized coaching system${researchWarning}\n\n👆 **Schedule:** ${bookingUrl}`;
        }
        
        // Calendly fallback
        const service = conversationData?.payload?.fitness_goal === 'competition_prep' ? 'competition-prep-coaching' : 'fitness-coaching';
        try {
          const calendlyLink = await generateCalendlyLink(businessData.id || 'unknown', { service });
          await trackEvent(businessData.id || 'unknown', 'calendly_link_provided');
          return `${statusMessage} | ${scarcityText}\n${goalText} | Structured periodized coaching system${researchWarning}\n\n📅 **Schedule:** ${calendlyLink}`;
        } catch (calendlyError) {
          logger.error('Calendly generation failed', businessData.id, { error: calendlyError });
        }
        
        // Phone fallback
        await trackEvent(businessData.id || 'unknown', 'phone_fallback_used');
        return `${statusMessage} | ${scarcityText}\n${goalText} | Structured periodized coaching system${researchWarning}\n\n📞 **Schedule:** ${businessData.phone || 'Call us'}`;
        
      } catch (error) {
        logger.error('Error in fitness BOOK state', businessData.id, { error });
        const fallbackScarcity = businessData.available_slots && businessData.available_slots > 1
          ? `⚡ ${businessData.available_slots - 1} coaching spots remaining`
          : '⚡ Final coaching spots remaining';
        return `🏆 Coaching spot reserved | ${fallbackScarcity}\n\n📞 **Schedule:** ${businessData.phone || 'Call us'}`;
      }
    },
    quickReplies: [
      { title: '📞 Call coach', next: 'LOCATION', payload: { callback_requested: true } },
      { title: '❓ Program details', next: 'QUESTION', payload: { needs_expert: true } },
      { title: '✅ Perfect', next: 'END', payload: { booking_completed: true } }
    ],
    isBookingState: true,
    followUpAfterHours: 8
  },

  PRICES: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_pricing');
      
      return `💰 **Premium Coaching Programs**\n\n🏆 Results-driven methodology\n📊 Proven transformation system\n🎯 1-on-1 coach accountability\n\n💎 Investment in your transformation`;
    },
    quickReplies: [
      { title: '🎯 Apply for coaching', next: 'QUALIFY_GOAL', action: 'book', payload: { intent: 'coaching_application' } },
      { title: '📍 Training location', next: 'LOCATION', payload: { intent: 'location_inquiry' } },
      { title: '📞 Coach consultation', next: 'QUESTION', payload: { intent: 'program_consultation' } }
    ]
  },

  LOCATION: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_location');
      
      const callbackMessage = conversationData?.payload?.callback_requested ?
        '📞 **Coach calling within 30 minutes**\n\n' : '';
      
      return `${callbackMessage}🏆 **Elite Training Facility**\n📍 ${businessData.location || 'Premium gym location'}\n⏰ ${businessData.hours || 'Flexible training hours'}\n\n💪 State-of-the-art equipment for results`;
    },
    quickReplies: [
      { title: '🎯 Apply for coaching', next: 'QUALIFY_GOAL', action: 'book' },
      { title: '💰 View programs', next: 'PRICES' },
      { title: '📞 Coach consultation', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'started_questions');
      
      return `🏆 **Expert Coaching Support**\n\nWhat questions do you have about our transformation programs?\n💪 Our certified coaches provide detailed guidance`;
    },
    quickReplies: [
      { title: '💰 Program pricing', next: 'PRICES', payload: { intent: 'pricing_questions' } },
      { title: '🎯 Apply for coaching', next: 'QUALIFY_GOAL', payload: { intent: 'coaching_inquiry' } },
      { title: '📊 Results examples', next: 'LOCATION', payload: { intent: 'results_inquiry' } }
    ]
  },

  FOLLOW_UP: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      const businessName = businessData.business_name || 'Elite Fitness Coaching';
      const urgency = conversationData?.payload?.urgency || 'research';
      
      await trackEvent(businessData.id || 'unknown', 'follow_up_sent');
      
      // Urgency-aware messaging
      const isImmediate = urgency === 'immediate';
      
      if (followUpCount === 0) {
        if (isImmediate) {
          return `🔥 **Priority Application Status**\n\n${businessName} - Your spot expires in 24 hours\nElite coaching capacity extremely limited\n\n⚡ Secure your immediate start position`;
        } else {
          return `🎯 **${businessName}** elite consultation\n\nReady to discuss your specialized training plan?\nComplimentary elite coaching consultation available\n\n📞 Schedule your assessment`;
        }
      } else if (followUpCount === 1) {
        if (isImmediate) {
          return `🚨 **Final Notice - Priority Candidate**\n\n${businessName} coaching spots filling rapidly\nYour priority status expires tonight\n\n🔥 Secure your elite coaching spot now`;
        } else {
          return `🚀 **Elite coaching spots filling**\n\n${businessName} capacity reaching limit\nSecure your specialized coach assignment\n\n⚡ Apply now for priority consideration`;
        }
      } else {
        return `🔥 **Final enrollment window**\n\nLast 24 hours for ${businessName} elite coaching\nNext intake: 4 months away\n\n🎯 Secure your transformation today`;
      }
    },
    quickReplies: [
      { title: '🚀 Yes, apply now', next: 'QUALIFY_GOAL', payload: { intent: 'follow_up_application' } },
      { title: '📞 Strategy call', next: 'QUESTION', payload: { intent: 'follow_up_consultation' } },
      { title: '⏰ Not ready', next: 'END', payload: { intent: 'deferred' } }
    ],
    followUpAfterHours: 48
  },

  END: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const bookingCompleted = conversationData?.payload?.booking_completed || false;
      
      await trackEvent(businessData.id || 'unknown', 'conversation_ended');
      
      if (bookingCompleted) {
        return `🏆 **Coaching application approved**\n\nYour coach will contact you within 24 hours\n📞 Direct line: ${businessData.phone || 'Call us'}\n\n💪 Your transformation begins now`;
      }
      
      return `🎯 **Ready when you are**\n\nYour transformation awaits\n📞 ${businessData.phone || 'Call us'}\n\n💪 Every champion started with a decision`;
    },
    quickReplies: [
      { title: '🔥 Actually, apply now', next: 'QUALIFY_GOAL', payload: { intent: 'last_chance_application' } },
      { title: '📍 Training location', next: 'LOCATION' },
      { title: '📞 Coach consultation', next: 'QUESTION' }
    ]
  }
};