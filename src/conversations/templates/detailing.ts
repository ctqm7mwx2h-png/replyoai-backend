import { ConversationFlow, BusinessData, ConversationData } from '../types.js';
import { trackEvent } from '../../services/analytics.js';
import { saveLead } from '../../services/leads.js';
import { validateUrl } from '../../utils/validateUrl.js';
import { generateCalendlyLink } from '../../utils/calendly.js';
import { processHotLead } from '../../services/hot-leads.service.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger();

export const detailingFlow: ConversationFlow = {
  START: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'conversation_started');
      
      logger.info('Premium detailing conversation started', { businessId: businessData.id });
      
      const businessName = businessData.business_name || 'Elite Automotive Detailing';
      const trustSignal = businessData.rating && businessData.reviews_count ? 
        `⭐ ${businessData.rating}/5 (${businessData.reviews_count} reviews)` :
        `🏆 Premium Certified`;
      const scarcity = businessData.available_slots ? 
        `⚡ ${businessData.available_slots} slots remaining` : '⚡ Limited availability';
      
      return `💎 **${businessName}**\n${trustSignal} | ${scarcity}\n\nProtect resale value.\nPreserve showroom finish.\n\n🎯 **Secure your premium detailing appointment**`;
    },
    quickReplies: [
      { title: '🎯 Book Premium Service', next: 'QUALIFY_VEHICLE_TYPE', action: 'book', payload: { intent: 'premium_booking' } },
      { title: '💰 View Packages', next: 'PRICES', action: 'qualify', payload: { intent: 'pricing_inquiry' } },
      { title: '📞 Expert Consultation', next: 'QUESTION', action: 'question', payload: { intent: 'consultation' } }
    ],
    followUpAfterHours: 6
  },

  QUALIFY: {
    message: async (): Promise<string> => {
      return `🏆 Which vehicle requires premium treatment?`;
    },
    quickReplies: [
      { title: '🏎️ Sports/Performance', next: 'QUALIFY_URGENCY', payload: { vehicle_type: 'sports' } },
      { title: '🚙 Luxury SUV', next: 'QUALIFY_URGENCY', payload: { vehicle_type: 'luxury_suv' } },
      { title: '🚗 Premium Saloon', next: 'QUALIFY_URGENCY', payload: { vehicle_type: 'premium_saloon' } },
      { title: '🏁 Supercar', next: 'QUALIFY_URGENCY', payload: { vehicle_type: 'supercar' } }
    ],
    isQualifying: true,
    qualificationField: 'vehicle_type'
  },

  QUALIFY_VEHICLE_TYPE: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'vehicle_selected');
      
      return `🏆 Which vehicle requires premium treatment?\n💎 Specialist assigned per vehicle type`;
    },
    quickReplies: [
      { title: '🏎️ Sports/Performance', next: 'QUALIFY_URGENCY', payload: { vehicle_type: 'sports' } },
      { title: '🚙 Luxury SUV', next: 'QUALIFY_URGENCY', payload: { vehicle_type: 'luxury_suv' } },
      { title: '🚗 Premium Saloon', next: 'QUALIFY_URGENCY', payload: { vehicle_type: 'premium_saloon' } },
      { title: '🏁 Supercar', next: 'QUALIFY_URGENCY', payload: { vehicle_type: 'supercar', priority: 'premium' } }
    ],
    isQualifying: true,
    qualificationField: 'vehicle_type'
  },

  QUALIFY_URGENCY: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'urgency_selected');
      
      return `⚡ Service timeline preference?\n🚨 Priority slots available for urgent requests`;
    },
    quickReplies: [
      { title: '🚨 Urgent (48h)', next: 'PACKAGE_SELECTION', payload: { urgency: 'emergency', priority: 'high' } },
      { title: '⚡ This week', next: 'PACKAGE_SELECTION', payload: { urgency: 'immediate' } },
      { title: '📅 Flexible timing', next: 'PACKAGE_SELECTION', payload: { urgency: 'flexible' } }
    ],
    isQualifying: true,
    qualificationField: 'urgency'
  },

  PACKAGE_SELECTION: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'package_selected');
      
      const vehicleType = conversationData?.payload?.vehicle_type;
      const specialist = vehicleType === 'supercar' ? '🏁 Supercar Specialist' : '💎 Master Detailer';
      
      return `${specialist} assigned\n\nSelect your protection level:\n🏆 All packages include lifetime warranty`;
    },
    quickReplies: [
      { title: '💎 Ceramic Coating', next: 'REQUEST_PHONE', payload: { coating_interest: 'ceramic_coating' } },
      { title: '🎨 Paint + Coating', next: 'REQUEST_PHONE', payload: { coating_interest: 'correction_coating', service_tier: 'premium' } },
      { title: '🏆 Full Protection', next: 'REQUEST_PHONE', payload: { coating_interest: 'full_suite', service_tier: 'premium', maintenance_plan_interest: 'platinum' } }
    ],
    isQualifying: true,
    qualificationField: 'package_selection'
  },

  REQUEST_PHONE: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const invalidPhone = conversationData?.payload?.phone_invalid;
      const urgency = conversationData?.payload?.urgency;
      
      await trackEvent(businessData.id || 'unknown', 'phone_requested');
      
      if (invalidPhone) {
        return `❌ Invalid format\n\nUK mobile required: +447912345678 or 07912345678\n🚨 Slot auto-released without valid number`;
      }
      
      const statusMessage = urgency === 'emergency' ? '🚨 Priority slot reserved' : '💎 Master detailer assigned';
      
      return `${statusMessage}\n\nMobile number required to secure appointment:\n⚡ Slot auto-released if no number provided\n\nFormat: 07912345678`;
    },
    quickReplies: [
      { title: '📞 Provide number', next: 'REQUEST_PHONE', payload: { awaiting_phone: true } }
    ],
    isQualifying: true,
    qualificationField: 'phone',
    phoneValidation: true,
    followUpAfterHours: 2
  },

  BOOK: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      try {
        // Process hot lead first
        const leadScoringData = {
          urgency: conversationData?.payload?.urgency || 'flexible',
          serviceTier: conversationData?.payload?.service_tier || 'standard',
          vehicleType: conversationData?.payload?.vehicle_type || 'unknown',
          recurringInterest: conversationData?.payload?.maintenance_plan_interest === 'platinum' ? 'yes' : 'no',
          coatingInterest: conversationData?.payload?.coating_interest || 'consultation',
          priority: conversationData?.payload?.priority || 'standard'
        };
        
        const result = await processHotLead({
          businessId: businessData.id || 'unknown',
          conversationId: conversationData?.conversationId,
          userId: conversationData?.userId || 'unknown',
          phone: conversationData?.payload?.phone,
          ...leadScoringData
        });
        
        // Save legacy lead after scoring
        const legacyLeadData = {
          vehicle_type: conversationData?.payload?.vehicle_type || 'unknown',
          urgency: conversationData?.payload?.urgency || 'flexible',
          coating_interest: conversationData?.payload?.coating_interest || 'consultation',
          maintenance_plan_interest: conversationData?.payload?.maintenance_plan_interest || 'declined',
          priority: conversationData?.payload?.priority || 'standard',
          service_tier: conversationData?.payload?.service_tier || 'standard',
          source: 'detailing_premium_funnel',
          phone: conversationData?.payload?.phone || 'not_provided',
          timestamp: new Date().toISOString(),
          score: result.score
        };
        
        await saveLead(businessData.id || 'unknown', legacyLeadData);
        await trackEvent(businessData.id || 'unknown', 'lead_saved');
        
        // Score-based status messaging
        const statusMessage = result.score > 80 ? '🔥 **Priority Client Status**' : '💎 **Premium Booking Confirmed**';
        
        // Dynamic scarcity and vehicle messaging
        const scarcityText = businessData.available_slots && businessData.available_slots > 1
          ? `⚡ ${businessData.available_slots - 1} slots remaining`
          : '⚡ Final slots remaining';
        const vehicleText = conversationData?.payload?.vehicle_type ? 
          `${conversationData.payload.vehicle_type} specialist confirmed` : 'Specialist confirmed';
        
        // Fallback booking flow: booking_link → calendly → phone
        const bookingUrl = businessData.booking_link;
        const hasValidBooking = bookingUrl && validateUrl(bookingUrl);
        
        if (hasValidBooking) {
          await trackEvent(businessData.id || 'unknown', 'booking_link_provided');
          return `${statusMessage}\n${scarcityText} | ${vehicleText}\n\n👆 **Book:** ${bookingUrl}`;
        }
        
        // Calendly fallback
        const service = conversationData?.payload?.vehicle_type === 'supercar' ? 'supercar-detailing' : 'premium-detailing';
        try {
          const calendlyLink = await generateCalendlyLink(businessData.id || 'unknown', { service });
          await trackEvent(businessData.id || 'unknown', 'calendly_link_provided');
          return `${statusMessage}\n${scarcityText} | ${vehicleText}\n\n🗓️ **Book:** ${calendlyLink}`;
        } catch (calendlyError) {
          logger.error('Calendly generation failed', businessData.id, { error: calendlyError });
        }
        
        // Phone fallback
        await trackEvent(businessData.id || 'unknown', 'phone_fallback_used');
        return `${statusMessage}\n${scarcityText} | ${vehicleText}\n\n📞 **Book:** ${businessData.phone || 'Call us'}`;
        
      } catch (error) {
        logger.error('Error in premium BOOK state', businessData.id, { error });
        return `💎 Premium appointment secured\n\n📞 **Book:** ${businessData.phone || 'Call us'}`;
      }
    },
    quickReplies: [
      { title: '📞 Call me', next: 'LOCATION', payload: { callback_requested: true } },
      { title: '❓ Question', next: 'QUESTION', payload: { needs_expert: true } },
      { title: '✅ Confirmed', next: 'END', payload: { booking_completed: true } }
    ],
    isBookingState: true,
    followUpAfterHours: 4
  },

  PRICES: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_premium_packages');
      
      return `💎 **Premium Protection Packages**\n\n🏆 9H ceramic coating with lifetime warranty\n💰 Investment protection from £1,200\n\n📊 Bespoke quotes available`;
    },
    quickReplies: [
      { title: '💎 Get Quote', next: 'QUALIFY_VEHICLE_TYPE', action: 'book', payload: { intent: 'premium_package' } },
      { title: '📍 Locations', next: 'LOCATION', payload: { intent: 'location_inquiry' } },
      { title: '📞 Expert Call', next: 'QUESTION', payload: { intent: 'expert_consultation' } }
    ]
  },

  LOCATION: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_location_info');
      
      const callbackMessage = conversationData?.payload?.callback_requested ?
        '📞 **Calling within 30 minutes**\n\n' : '';
      
      return `${callbackMessage}🏆 **Premium Detailing Studios**\n📍 ${businessData.location || 'Central London'}\n⏰ ${businessData.hours || 'Mon-Sat 8AM-7PM'}`;
    },
    quickReplies: [
      { title: '💎 Book Service', next: 'QUALIFY_VEHICLE_TYPE', action: 'book' },
      { title: '💰 View Packages', next: 'PRICES' },
      { title: '📞 Expert Call', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'started_expert_consultation');
      
      return `🏆 **Expert Consultation Available**\n\n${businessData.business_name || 'Elite Automotive Detailing'} specialists ready\n⚡ Response under 5 minutes`;
    },
    quickReplies: [
      { title: '💎 Ceramic coating info', next: 'PRICES', payload: { intent: 'coating_consultation' } },
      { title: '🎯 Paint correction info', next: 'QUALIFY_VEHICLE_TYPE', payload: { intent: 'correction_consultation' } },
      { title: '📞 Call expert now', next: 'LOCATION', payload: { callback_requested: true, priority: 'high' } }
    ]
  },

  FOLLOW_UP: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      const businessName = businessData.business_name || 'Elite Automotive Detailing';
      
      await trackEvent(businessData.id || 'unknown', 'follow_up_sent');
      
      if (followUpCount === 0) {
        return `💎 **${businessName}** exclusive offer\n\nComplimentary vehicle assessment available\n🎯 Ready to secure your appointment?`;
      } else if (followUpCount === 1) {
        return `🏆 Master detailer available for consultation\n⚡ Quick call to discuss your requirements?`;
      } else {
        return `💎 VIP client program invitation\n🏁 Exclusive member benefits available\n\nInterested in joining?`;
      }
    },
    quickReplies: [
      { title: '💎 Book service', next: 'QUALIFY_VEHICLE_TYPE', payload: { intent: 'follow_up_booking' } },
      { title: '📞 Expert call', next: 'QUESTION', payload: { intent: 'follow_up_consultation' } },
      { title: '⏰ Maybe later', next: 'END', payload: { intent: 'postponed' } }
    ],
    followUpAfterHours: 24
  },

  END: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const bookingCompleted = conversationData?.payload?.booking_completed || false;
      
      await trackEvent(businessData.id || 'unknown', 'conversation_ended');
      
      if (bookingCompleted) {
        return `🎆 **Appointment confirmed**\n\nConfirmation call incoming\n📞 Direct line: ${businessData.phone || 'Call us'}`;
      }
      
      return `🏆 Thank you for your interest\n\nWe're here when you're ready\n📞 ${businessData.phone || 'Call us'}`;
    },
    quickReplies: [
      { title: '💎 Actually, book now', next: 'QUALIFY_VEHICLE_TYPE', payload: { intent: 'last_chance_booking' } },
      { title: '📍 Studio locations', next: 'LOCATION' },
      { title: '📞 Expert consultation', next: 'QUESTION' }
    ]
  }
};