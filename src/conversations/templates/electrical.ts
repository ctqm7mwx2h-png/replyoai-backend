import { ConversationFlow, BusinessData, ConversationData } from '../types.js';
import { processHotLead } from '../../services/hot-leads.service.js';
import { trackEvent } from '../../services/analytics.js';
import { saveLead } from '../../services/leads.js';
import { validateUrl } from '../../utils/validateUrl.js';
import { generateCalendlyLink } from '../../utils/calendly.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger();

export const electricalFlow: ConversationFlow = {
  START: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'conversation_started');
      
      const businessName = businessData.business_name || 'Licensed Electrical Services';
      
      return `⚡ **${businessName}**\nLicensed & Insured Electricians\n24/7 Emergency Response\n\n🏠 Protect your family from electrical hazards\n⚡ Code-compliant work guaranteed\n\n🚨 Is this an electrical emergency?`;
    },
    quickReplies: [
      { title: '🚨 Emergency - sparks/outage', next: 'EMERGENCY_CHECK', action: 'book', payload: { urgency: 'emergency' } },
      { title: '⚡ Schedule service', next: 'QUALIFY_SERVICE', action: 'book', payload: { urgency: 'scheduled' } },
      { title: '💰 Get estimate', next: 'PRICES', action: 'qualify', payload: { intent: 'pricing' } }
    ],
    followUpAfterHours: 6
  },

  // Interface compatibility
  QUALIFY: {
    message: async (): Promise<string> => {
      return `⚡ Which electrical service do you need?`;
    },
    quickReplies: [
      { title: '🔌 Outlets/switches', next: 'QUALIFY_URGENCY', payload: { service_type: 'outlets_switches' } },
      { title: '💡 Lighting installation', next: 'QUALIFY_URGENCY', payload: { service_type: 'lighting' } },
      { title: '🏠 Panel upgrade', next: 'QUALIFY_URGENCY', payload: { service_type: 'panel_upgrade' } },
      { title: '🚨 Emergency repair', next: 'EMERGENCY_CHECK', payload: { urgency: 'emergency' } }
    ],
    isQualifying: true,
    qualificationField: 'service_type'
  },

  EMERGENCY_CHECK: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'emergency_detected');
      
      return `🚨 **ELECTRICAL EMERGENCY**\n\nSafety first - licensed electrician dispatching\n📞 Mobile number required for technician dispatch\n\n⚡ No power outages left unresolved`;
    },
    quickReplies: [
      { title: '📞 Provide number for dispatch', next: 'REQUEST_PHONE', payload: { emergency_path: true } }
    ]
  },

  QUALIFY_SERVICE: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'service_selected');
      
      return `⚡ **Licensed Electrical Services**\n\nWhich service do you need?\n🏠 All work meets electrical code standards`;
    },
    quickReplies: [
      { title: '🔌 Outlets/switches', next: 'QUALIFY_URGENCY', payload: { service_type: 'outlets_switches' } },
      { title: '💡 Lighting installation', next: 'QUALIFY_URGENCY', payload: { service_type: 'lighting' } },
      { title: '🏠 Panel upgrade', next: 'QUALIFY_URGENCY', payload: { service_type: 'panel_upgrade' } },
      { title: '🔧 Wiring repair', next: 'QUALIFY_URGENCY', payload: { service_type: 'wiring' } },
      { title: '⚡ Other electrical', next: 'QUALIFY_URGENCY', payload: { service_type: 'other' } }
    ],
    isQualifying: true,
    qualificationField: 'service_type'
  },

  QUALIFY_URGENCY: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'urgency_selected');
      
      return `📅 **Service Timeline**\n\nWhen do you need this completed?\n⚡ Same-day service available`;
    },
    quickReplies: [
      { title: '⚡ Today/ASAP', next: 'REQUEST_PHONE', payload: { urgency: 'immediate' } },
      { title: '📅 This week', next: 'REQUEST_PHONE', payload: { urgency: 'this_week' } },
      { title: '🗺️ Planning ahead', next: 'REQUEST_PHONE', payload: { urgency: 'flexible' } }
    ],
    isQualifying: true,
    qualificationField: 'urgency'
  },

  REQUEST_PHONE: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const invalidPhone = conversationData?.payload?.phone_invalid;
      const isEmergency = conversationData?.payload?.emergency_path || conversationData?.payload?.urgency === 'emergency';
      
      await trackEvent(businessData.id || 'unknown', 'phone_requested');
      
      if (invalidPhone) {
        return `❌ Invalid format\n\nUK mobile required: +447912345678 or 07912345678\n🚨 Slot auto-released without valid number`;
      }
      
      const urgencyText = isEmergency ? 
        '🚨 **EMERGENCY DISPATCH**\nTechnician requires mobile for safety coordination' :
        '⚡ **Licensed Electrician Assignment**\nMobile required for safe service dispatch';
      
      return `${urgencyText}\n\n📱 UK mobile number required:\n• Technician coordination\n• Safety protocols\n• Service updates\n\nFormat: 07912345678`;
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
        // Build lead data
        const leadScoringData = {
          urgency: conversationData?.payload?.urgency || 'flexible',
          serviceTier: 'electrical',
          serviceType: conversationData?.payload?.service_type || 'unknown',
          isEmergency: conversationData?.payload?.urgency === 'emergency' ? 'yes' : 'no',
          priority: conversationData?.payload?.urgency === 'emergency' ? 'high' : 'standard'
        };
        
        // Process hot lead
        const result = await processHotLead({
          businessId: businessData.id || 'unknown',
          conversationId: conversationData?.conversationId,
          userId: conversationData?.userId || 'unknown',
          phone: conversationData?.payload?.phone,
          ...leadScoringData
        });
        
        // Legacy lead saving
        const legacyLeadData = {
          service_type: conversationData?.payload?.service_type || 'unknown',
          urgency: conversationData?.payload?.urgency || 'flexible',
          service_tier: 'electrical',
          source: 'electrical_flow',
          phone: conversationData?.payload?.phone || 'not_provided',
          timestamp: new Date().toISOString(),
          score: result.score
        };
        
        await saveLead(businessData.id || 'unknown', legacyLeadData);
        await trackEvent(businessData.id || 'unknown', 'lead_saved');
        
        // Emergency path - immediate phone contact
        if (conversationData?.payload?.urgency === 'emergency') {
          return `🚨 **ELECTRICAL EMERGENCY**\n\nLicensed electrician dispatching now\n📞 **Call immediately:** ${businessData.phone || 'Emergency line'}\n\n⚡ Family safety is our priority`;
        }
        
        // Standard booking flow
        const statusMessage = result.score > 70 ? '🔥 **Priority Service**' : '⚡ **Licensed Service Confirmed**';
        
        // Fallback booking: booking_link → calendly → phone
        const bookingUrl = businessData.booking_link;
        const hasValidBooking = bookingUrl && validateUrl(bookingUrl);
        
        if (hasValidBooking) {
          await trackEvent(businessData.id || 'unknown', 'booking_link_provided');
          return `${statusMessage}\n\nCode-compliant electrical work\n🏠 Protecting your family's safety\n\n👆 **Book:** ${bookingUrl}`;
        }
        
        // Calendly fallback
        try {
          const calendlyLink = await generateCalendlyLink(businessData.id || 'unknown', { service: 'electrical-service' });
          await trackEvent(businessData.id || 'unknown', 'calendly_link_provided');
          return `${statusMessage}\n\nCode-compliant electrical work\n🏠 Protecting your family's safety\n\n🗓️ **Book:** ${calendlyLink}`;
        } catch (calendlyError) {
          logger.error('Calendly generation failed', businessData.id, { error: calendlyError });
        }
        
        // Phone fallback
        await trackEvent(businessData.id || 'unknown', 'phone_fallback_used');
        return `${statusMessage}\n\nCode-compliant electrical work\n🏠 Protecting your family's safety\n\n📞 **Book:** ${businessData.phone || 'Call us'}`;
        
      } catch (error) {
        logger.error('Error in electrical BOOK state', businessData.id, { error });
        return `⚡ Licensed electrical service ready\n\n📞 **Book:** ${businessData.phone || 'Call us'}`;
      }
    },
    quickReplies: [
      { title: '📞 Call electrician', next: 'LOCATION', payload: { callback_requested: true } },
      { title: '❓ Safety questions', next: 'QUESTION', payload: { needs_expert: true } },
      { title: '✅ All set', next: 'END', payload: { booking_completed: true } }
    ],
    isBookingState: true,
    followUpAfterHours: 4
  },

  PRICES: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_pricing');
      
      return `💰 **Licensed Electrical Pricing**\n\n🏠 Free safety inspections included\n⚡ Code-compliant work guaranteed\n📊 Transparent, fair pricing\n\n🚨 Don't risk DIY electrical work`;
    },
    quickReplies: [
      { title: '📅 Free estimate', next: 'QUALIFY_SERVICE', action: 'book', payload: { intent: 'estimate' } },
      { title: '📍 Service areas', next: 'LOCATION', payload: { intent: 'location' } },
      { title: '❓ Pricing questions', next: 'QUESTION', payload: { intent: 'pricing_questions' } }
    ]
  },

  LOCATION: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_location');
      
      const callbackMessage = conversationData?.payload?.callback_requested ?
        '📞 **Licensed electrician calling within 30 minutes**\n\n' : '';
      
      return `${callbackMessage}📍 **Licensed Service Areas**\n${businessData.location || 'Contact for service coverage'}\n\n⏰ **Emergency Available**\n${businessData.hours || '24/7 Emergency Electrical'}\n\n⚡ Protecting families across our service area`;
    },
    quickReplies: [
      { title: '⚡ Book electrical service', next: 'QUALIFY_SERVICE', action: 'book' },
      { title: '💰 Get pricing', next: 'PRICES' },
      { title: '🚨 Emergency service', next: 'EMERGENCY_CHECK', action: 'book' }
    ]
  },

  QUESTION: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'started_questions');
      
      return `🏠 **Licensed Electrical Safety**\n\nWhat questions do you have?\n⚡ Our certified electricians ensure code compliance\n\n🚨 Electrical fires are preventable with proper work`;
    },
    quickReplies: [
      { title: '💰 Pricing questions', next: 'PRICES', payload: { intent: 'pricing_inquiry' } },
      { title: '⚡ Book service', next: 'QUALIFY_SERVICE', payload: { intent: 'service_booking' } },
      { title: '🚨 Emergency help', next: 'EMERGENCY_CHECK', payload: { intent: 'emergency_question' } }
    ]
  },

  FOLLOW_UP: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      const businessName = businessData.business_name || 'Licensed Electrical Services';
      
      await trackEvent(businessData.id || 'unknown', 'follow_up_sent');
      
      if (followUpCount === 0) {
        return `🚨 **${businessName}** safety reminder\n\nDon't risk electrical hazards\nLicensed electricians protect your family\n\n⚡ Ready to schedule safe electrical work?`;
      } else {
        return `🏠 **Electrical Safety Priority**\n\nFaulty wiring causes house fires\n${businessName} ensures code compliance\n\nProtect your investment today`;
      }
    },
    quickReplies: [
      { title: '⚡ Yes, book service', next: 'QUALIFY_SERVICE', payload: { intent: 'follow_up_booking' } },
      { title: '🚨 Emergency needed', next: 'EMERGENCY_CHECK', payload: { intent: 'follow_up_emergency' } },
      { title: '✅ All handled', next: 'END', payload: { intent: 'resolved' } }
    ],
    followUpAfterHours: 24
  },

  END: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const bookingCompleted = conversationData?.payload?.booking_completed || false;
      
      await trackEvent(businessData.id || 'unknown', 'conversation_ended');
      
      if (bookingCompleted) {
        return `⚡ **Licensed Service Confirmed**\n\nOur electrician will contact you soon\n📞 Emergency line: ${businessData.phone || 'Call us'}\n\n🏠 Your family's safety is our priority`;
      }
      
      return `🏠 **Stay Electrically Safe**\n\nWe're here when you need licensed electrical work\n📞 ${businessData.phone || 'Call us'}\n\n⚡ Don't risk DIY electrical`;
    },
    quickReplies: [
      { title: '⚡ Actually, book now', next: 'QUALIFY_SERVICE', payload: { intent: 'last_chance' } },
      { title: '🚨 Emergency service', next: 'EMERGENCY_CHECK', payload: { intent: 'emergency_needed' } },
      { title: '📍 Service areas', next: 'LOCATION' }
    ]
  }
};