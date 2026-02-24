import { ConversationFlow, BusinessData, ConversationData } from '../types.js';
import { trackEvent } from '../../services/analytics.js';
import { saveLead } from '../../services/leads.js';
import { validateUrl } from '../../utils/validateUrl.js';
import { generateCalendlyLink } from '../../utils/calendly.js';
import { computeScore, isHot } from '../../services/score.js';
import { notifyOwner } from '../../services/notifications.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger();

export const cleaningFlow: ConversationFlow = {
  START: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'conversation_started');
      
      logger.info('Cleaning conversation started', { businessId: businessData.id });
      
      const businessName = businessData.business_name || 'Professional Cleaning Services';
      const trustBadge = businessData.rating && businessData.reviews_count ?
        `⭐ **${businessData.rating}/5** (${businessData.reviews_count} reviews)` :
        '✨ **Trusted by 500+ UK businesses**';
      const scarcity = businessData.available_slots ?
        `⚡ **${businessData.available_slots} slots left this week**` : '';
      
      return `🏢 **${businessName}** - Premium Cleaning Solutions\n${trustBadge}\n${scarcity}\n\n🎯 **Ready for your instant quote?**`;
    },
    quickReplies: [
      { title: '⚡ Get instant quote', next: 'QUALIFY_PROPERTY', action: 'book', payload: { intent: 'urgent_quote' } },
      { title: '📊 See our pricing', next: 'PRICES', action: 'qualify', payload: { intent: 'price_check' } },
      { title: '🏢 Service areas', next: 'LOCATION', action: 'location', payload: { intent: 'coverage_check' } },
      { title: '📞 Speak to expert', next: 'QUESTION', action: 'question', payload: { intent: 'expert_consultation' } }
    ],
    followUpAfterHours: 8
  },

  // Alias for interface compatibility
  QUALIFY: {
    message: async (): Promise<string> => {
      return `🎯 **Let's get you the perfect cleaning solution!**\n\nWhat type of property do you need cleaned?`;
    },
    quickReplies: [
      { title: '🏢 Commercial space', next: 'QUALIFY_PROPERTY', payload: { property_type: 'commercial' } },
      { title: '🏠 Residential', next: 'QUALIFY_PROPERTY', payload: { property_type: 'residential' } },
      { title: '🏢 Office building', next: 'QUALIFY_PROPERTY', payload: { property_type: 'office' } },
      { title: '🏭 Industrial/Warehouse', next: 'QUALIFY_PROPERTY', payload: { property_type: 'industrial' } }
    ],
    isQualifying: true,
    qualificationField: 'property_type'
  },

  QUALIFY_PROPERTY: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'started_qualification');
      
      return `Excellent choice! 🎯\n\n**What type of property needs our expert attention?**\n\n💡 *Most clients save 40% by choosing our recurring plans*`;
    },
    quickReplies: [
      { title: '🏢 Office/Commercial', next: 'QUALIFY_SIZE', payload: { property_type: 'commercial' } },
      { title: '🏭 Warehouse/Industrial', next: 'QUALIFY_SIZE', payload: { property_type: 'industrial' } },
      { title: '🏪 Retail/Shop', next: 'QUALIFY_SIZE', payload: { property_type: 'retail' } },
      { title: '🏠 Residential/House', next: 'QUALIFY_SIZE', payload: { property_type: 'residential' } },
      { title: '🏨 Hotel/Hospitality', next: 'QUALIFY_SIZE', payload: { property_type: 'hospitality' } }
    ],
    isQualifying: true,
    qualificationField: 'property_type'
  },

  QUALIFY_SIZE: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const propertyType = conversationData?.payload?.property_type || 'property';
      
      await trackEvent(businessData.id || 'unknown', 'qualified_property_type');
      
      return `Perfect! **${propertyType}** properties are our specialty! 🌟\n\n**What's the approximate size?**\n\n📏 *This helps us provide the most accurate quote*`;
    },
    quickReplies: [
      { title: '🏢 Small (under 2,000 sq ft)', next: 'QUALIFY_POSTCODE', payload: { property_size: 'small' } },
      { title: '🏬 Medium (2,000-10,000 sq ft)', next: 'QUALIFY_POSTCODE', payload: { property_size: 'medium' } },
      { title: '🏭 Large (10,000-50,000 sq ft)', next: 'QUALIFY_POSTCODE', payload: { property_size: 'large' } },
      { title: '🏢 Enterprise (50,000+ sq ft)', next: 'QUALIFY_POSTCODE', payload: { property_size: 'enterprise' } }
    ],
    isQualifying: true,
    qualificationField: 'property_size'
  },

  QUALIFY_POSTCODE: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'qualified_size');
      
      return `Excellent! 📍\n\n**What's your postcode?**\n\n🚚 *We serve 95% of UK postcodes with same-day response*\n\n💬 Just type your postcode below...`;
    },
    quickReplies: [
      { title: '📍 London area', next: 'QUALIFY_TIMING', payload: { postcode: 'London' } },
      { title: '📍 Manchester area', next: 'QUALIFY_TIMING', payload: { postcode: 'Manchester' } },
      { title: '📍 Birmingham area', next: 'QUALIFY_TIMING', payload: { postcode: 'Birmingham' } },
      { title: '📍 Other UK postcode', next: 'QUALIFY_TIMING', payload: { postcode: 'Other' } }
    ],
    isQualifying: true,
    qualificationField: 'postcode'
  },

  QUALIFY_TIMING: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const postcode = conversationData?.payload?.postcode || 'your area';
      
      await trackEvent(businessData.id || 'unknown', 'qualified_postcode');
      
      return `Perfect! We cover **${postcode}** 🎯\n\n**When do you need this completed?**\n\n⚡ *Urgent jobs get priority scheduling*\n🕐 *Only 2 emergency slots left this week*`;
    },
    quickReplies: [
      { title: '🚨 Emergency (24-48hrs)', next: 'QUALIFY_RECURRING', payload: { urgency: 'emergency', priority: 'high' } },
      { title: '⚡ Urgent (this week)', next: 'QUALIFY_RECURRING', payload: { urgency: 'urgent', priority: 'high' } },
      { title: '📅 Scheduled (next week)', next: 'QUALIFY_RECURRING', payload: { urgency: 'scheduled', priority: 'normal' } },
      { title: '📋 Just exploring', next: 'QUALIFY_RECURRING', payload: { urgency: 'exploring', priority: 'low' } }
    ],
    isQualifying: true,
    qualificationField: 'urgency'
  },

  QUALIFY_RECURRING: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const urgency = conversationData?.payload?.urgency || 'scheduled';
      
      await trackEvent(businessData.id || 'unknown', 'qualified_timing');
      
      const urgencyMessage = urgency === 'emergency' 
        ? '🚨 **Emergency service activated!**\n'
        : urgency === 'urgent'
        ? '⚡ **Priority booking confirmed!**\n'
        : '✅ **Scheduled service noted!**\n';
      
      return `${urgencyMessage}\n**Are you interested in ongoing cleaning?**\n\n💰 *Recurring clients save up to 35%*\n📈 *Plus priority booking & dedicated team*`;
    },
    quickReplies: [
      { title: '✅ Yes, recurring service', next: 'UPSELL', payload: { recurring_interest: 'yes', discount_eligible: true } },
      { title: '🤔 Maybe, tell me more', next: 'UPSELL', payload: { recurring_interest: 'maybe', discount_eligible: true } },
      { title: '❌ One-time only', next: 'UPSELL', payload: { recurring_interest: 'no', discount_eligible: false } }
    ],
    isQualifying: true,
    qualificationField: 'recurring_interest'
  },

  UPSELL: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const recurring = conversationData?.payload?.recurring_interest || 'no';
      const propertySize = conversationData?.payload?.property_size || 'medium';
      
      await trackEvent(businessData.id || 'unknown', 'qualified_recurring');
      
      const recurringBonus = recurring === 'yes' 
        ? '🎉 **Recurring discount activated!**\n\n'
        : recurring === 'maybe'
        ? '💡 **Special offer available!**\n\n'
        : '';
      
      const upsellSuggestion = propertySize === 'large' || propertySize === 'enterprise'
        ? '🏢 **Perfect for large spaces:**\n• Deep sanitisation\n• Carpet & upholstery cleaning\n• Window cleaning service'
        : '✨ **Popular add-ons:**\n• Deep oven cleaning\n• Carpet cleaning\n• Window cleaning';
      
      return `${recurringBonus}${upsellSuggestion}\n\n**Add any extras to your quote?**\n\n🎯 *Bundle deals save 25%*`;
    },
    quickReplies: [
      { title: '✅ Yes, add extras', next: 'REQUEST_PHONE', payload: { upsell_interest: 'yes', bundle_discount: true } },
      { title: '🤔 Just the basics', next: 'REQUEST_PHONE', payload: { upsell_interest: 'no', bundle_discount: false } },
      { title: '💬 Custom requirements', next: 'REQUEST_PHONE', payload: { upsell_interest: 'custom', bundle_discount: false } }
    ]
  },

  REQUEST_PHONE: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const businessName = businessData.business_name || 'Professional Cleaning Services';
      const invalidPhone = conversationData?.payload?.phone_invalid;
      
      await trackEvent(businessData.id || 'unknown', 'phone_requested');
      
      if (invalidPhone) {
        return `❌ **Invalid phone format**\n\n📞 **Please provide a valid UK business number:**\n• Format: +447912345678\n• Or: 07912345678\n\n✅ **Required for immediate quote confirmation**`;
      }
      
      return `📞 **INSTANT QUOTE - Phone Required**\n\n🏢 **${businessName}** - Quote ready in 60 seconds!\n\n🚀 **Please send your business mobile for:**\n• Instant quote delivery\n• Priority booking confirmation\n• Service coordination\n\n📱 **Format:** +447912345678 or 07912345678`;
    },
    quickReplies: [
      { title: '📞 I\'ll send my number', next: 'REQUEST_PHONE', payload: { awaiting_phone: true } }
    ],
    isQualifying: true,
    qualificationField: 'phone',
    phoneValidation: true
  },

  BOOK: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      try {
        // Compile lead data from conversation
        const leadData = {
          property_type: conversationData?.payload?.property_type || 'unknown',
          property_size: conversationData?.payload?.property_size || 'unknown',
          postcode: conversationData?.payload?.postcode || 'unknown',
          urgency: conversationData?.payload?.urgency || 'unknown',
          recurring_interest: conversationData?.payload?.recurring_interest || 'unknown',
          upsell_interest: conversationData?.payload?.upsell_interest || 'no',
          priority: conversationData?.payload?.priority || 'normal',
          discount_eligible: conversationData?.payload?.discount_eligible || false,
          phone: conversationData?.payload?.phone || 'not_provided',
          service_tier: 'commercial_cleaning',
          source: 'cleaning_flow',
          timestamp: new Date().toISOString()
        };
        
        // Compute lead score and check if hot
        const score = computeScore(leadData);
        const hotLead = isHot(score);
        
        // Save lead with score
        await saveLead(businessData.id || 'unknown', { ...leadData, score });
        
        // Notify owner if hot lead
        if (hotLead) {
          await notifyOwner(
            businessData.id || 'unknown',
            leadData,
            score,
            leadData.phone !== 'not_provided' ? leadData.phone : undefined
          );
        }
        
        // Save lead before booking
        await saveLead(businessData.id || 'unknown', leadData);
        
        await trackEvent(businessData.id || 'unknown', 'lead_saved_before_booking');
        
        const businessName = businessData.business_name || 'Professional Cleaning';
        const urgencyText = leadData.urgency === 'emergency' ? '🚨 **EMERGENCY BOOKING**' : 
                           leadData.urgency === 'urgent' ? '⚡ **PRIORITY BOOKING**' : 
                           '✅ **BOOKING CONFIRMED**';
        
        const discountText = leadData.discount_eligible ? 
          '\n💰 **Recurring client discount applied!**' : '';
        
        // Validate booking link
        const bookingUrl = businessData.booking_link;
        const hasValidBooking = bookingUrl && validateUrl(bookingUrl);
        
        if (hasValidBooking) {
          await trackEvent(businessData.id || 'unknown', 'booking_link_provided');
          
          return `${urgencyText} - **${businessName}**${discountText}\n\n🎯 **Your consultation is reserved**\n👆 **Book now:** ${bookingUrl}\n📞 **Urgent?** ${businessData.phone || 'Contact us'}`;
        }
        
        // Generate Calendly fallback
        const service = leadData.property_type === 'commercial' ? 'commercial-cleaning' : 'cleaning';
        try {
          const calendlyLink = await generateCalendlyLink(businessData.id || 'unknown', { service });
          
          await trackEvent(businessData.id || 'unknown', 'calendly_fallback_generated');
          
          return `${urgencyText} - **${businessName}**${discountText}\n\n🗓️ **Book consultation:** ${calendlyLink}\n📞 **Questions?** ${businessData.phone || 'Contact us'}`;
        } catch (calendlyError) {
          logger.error('Calendly generation failed', businessData.id, { error: calendlyError });
        }
        
        // Final fallback - phone only
        await trackEvent(businessData.id || 'unknown', 'phone_fallback_used');
        
        return `${urgencyText} - **${businessName}**${discountText}\n\n📞 **Call now:** ${businessData.phone || 'Contact us'}\n💬 **Or reply with your number for callback**`;
        
      } catch (error) {
        logger.error('Error in BOOK state', businessData.id, { error });
        
        return `🏢 Ready to book your premium cleaning service!\n\n📞 **Call us now:**\n${businessData.phone || 'Contact us'}\n\n💬 **Or reply with your phone number**\n*We'll call you back immediately*`;
      }
    },
    quickReplies: [
      { title: '📞 Call me instead', next: 'LOCATION', payload: { callback_requested: true } },
      { title: '❓ Have questions?', next: 'QUESTION', payload: { needs_consultation: true } },
      { title: '✅ All booked!', next: 'END', payload: { booking_completed: true } }
    ],
    isBookingState: true,
    followUpAfterHours: 6
  },

  PRICES: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_prices');
      
      logger.info('Customer viewed pricing', { businessId: businessData.id });
      
      return `💰 **Premium UK Cleaning Services** 🇬🇧\n\n🏆 **Why 500+ businesses choose us:**\n• ✅ Fully insured & certified\n• ✅ Eco-friendly products\n• ✅ 24/7 emergency service\n• ✅ Money-back guarantee\n\n💎 **From £15/hour** - commercial rates\n🏠 **From £12/hour** - residential rates\n\n📊 **Free detailed quote in 60 seconds:**`;
    },
    quickReplies: [
      { title: '⚡ Get instant quote', next: 'QUALIFY_PROPERTY', action: 'book', payload: { intent: 'instant_quote' } },
      { title: '📍 Check service area', next: 'LOCATION', payload: { intent: 'area_check' } },
      { title: '💬 Pricing questions', next: 'QUESTION', payload: { intent: 'pricing_inquiry' } },
      { title: '📞 Speak to expert', next: 'QUESTION', payload: { intent: 'expert_consultation' } }
    ]
  },

  LOCATION: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_location');
      
      logger.info('Customer viewed location info', { businessId: businessData.id });
      
      const callbackMessage = conversationData?.payload?.callback_requested 
        ? '📞 **Callback requested - we\'ll call within 15 minutes!**\n\n'
        : '';
      
      return `${callbackMessage}📍 **Service Coverage & Contact**\n\n🗺️ **Areas:** ${businessData.location || 'London, Manchester, Birmingham + 50 cities'}\n\n⏰ **Hours:** ${businessData.hours || 'Mon-Sun: 7AM-9PM (Emergency 24/7)'}\n\n📞 **Direct Line:** ${businessData.phone || 'Call for immediate response'}\n\n🚀 **95% of quotes delivered same-day**\n⚡ **Emergency response: 2-hour guarantee**`;
    },
    quickReplies: [
      { title: '🏢 Book cleaning now', next: 'QUALIFY_PROPERTY', action: 'book', payload: { intent: 'immediate_booking' } },
      { title: '💰 Get instant quote', next: 'QUALIFY_PROPERTY', payload: { intent: 'quote_request' } },
      { title: '❓ Ask expert question', next: 'QUESTION', payload: { intent: 'expert_consultation' } },
      { title: '📞 Request callback', next: 'QUESTION', payload: { callback_requested: true } }
    ]
  },

  QUESTION: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'started_consultation');
      
      const callbackMessage = conversationData?.payload?.callback_requested 
        ? '📞 **Callback confirmed!** We\'ll call within 15 minutes.\n\n'
        : '';
      
      const businessName = businessData.business_name || 'Our Expert Team';
      
      return `${callbackMessage}💬 **Expert Consultation Available**\n\n👨‍💼 **${businessName}** specialists are standing by!\n\n🎯 **What can we help with?**\n• Custom cleaning solutions\n• Pricing & packages\n• Scheduling & availability\n• Special requirements\n\n⚡ **Average response: 3 minutes**`;
    },
    quickReplies: [
      { title: '💰 Pricing questions', next: 'PRICES', payload: { intent: 'pricing_consultation' } },
      { title: '📅 Book consultation', next: 'QUALIFY_PROPERTY', payload: { intent: 'expert_booking' } },
      { title: '📍 Service coverage', next: 'LOCATION', payload: { intent: 'coverage_consultation' } },
      { title: '📞 Call me now', next: 'LOCATION', payload: { callback_requested: true } }
    ]
  },

  FOLLOW_UP: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      const businessName = businessData.business_name || 'Professional Cleaning Services';
      
      await trackEvent(businessData.id || 'unknown', 'follow_up_sent');
      
      if (followUpCount === 0) {
        return `🔥 **${businessName}** - 25% OFF first clean special\n✨ **Offer expires tomorrow**\n\n⚡ **Ready to claim your discount?**`;
      } else if (followUpCount === 1) {
        return `⚡ **${businessName}** - Final 25% discount reminder\n🚨 **Expires today**\n\n📞 **Book now or lose this offer**`;
      } else {
        return `💎 **${businessName}** VIP Priority Access\n🏆 **Same-day service + premium discount**\n\n🎯 **Ready for priority booking?**`;
      }
    },
    quickReplies: [
      { title: '🔥 Claim 25% discount!', next: 'QUALIFY_PROPERTY', payload: { intent: 'discount_claim', priority: 'high' } },
      { title: '💬 Quick question first', next: 'QUESTION', payload: { intent: 'follow_up_question' } },
      { title: '⏰ Not right now', next: 'END', payload: { intent: 'delay' } }
    ],
    followUpAfterHours: 24
  },

  END: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const businessName = businessData.business_name || 'Professional Cleaning Services';
      const bookingCompleted = conversationData?.payload?.booking_completed || false;
      
      await trackEvent(businessData.id || 'unknown', 'conversation_ended');
      
      if (bookingCompleted) {
        return `🎉 **Booking Confirmed!** 🎉\n\n${businessName} - Your premium cleaning is scheduled!\n\n✅ **What happens next:**\n1. Confirmation call within 2 hours\n2. Pre-service walkthrough\n3. Professional cleaning service\n\n📞 **Questions? Call:** ${businessData.phone || 'Contact us'}\n\n🌟 **Thank you for choosing premium quality!**`;
      }
      
      return `🌟 **Thank you for considering ${businessName}!**\n\n💎 **We're here when you're ready:**\n• Same-day quotes\n• 500+ happy customers\n• Fully insured service\n\n📞 **Quick call anytime:** ${businessData.phone || 'Contact us'}\n\n⚡ **Special offers sent weekly!**`;
    },
    quickReplies: [
      { title: '🏢 Actually, let\'s book!', next: 'QUALIFY_PROPERTY', payload: { intent: 'last_chance_booking' } },
      { title: '📍 Check service areas', next: 'LOCATION', payload: { intent: 'final_check' } },
      { title: '💬 Quick question', next: 'QUESTION', payload: { intent: 'last_minute_question' } }
    ]
  }
};