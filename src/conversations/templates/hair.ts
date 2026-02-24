import { ConversationFlow, BusinessData, ConversationData } from '../types.js';
import { computeScore, isHot } from '../../services/score.js';
import { notifyOwner } from '../../services/notifications.js';
import { trackEvent } from '../../services/analytics.js';
import { saveLead } from '../../services/leads.js';
import { validateUrl } from '../../utils/validateUrl.js';
import { generateCalendlyLink } from '../../utils/calendly.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger();

export const hairFlow: ConversationFlow = {
  START: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'hair_conversation_started');
      
      const businessName = businessData.business_name || 'Premium Salon';
      const socialProof = businessData.rating && businessData.reviews_count ? 
        `⭐ ${businessData.rating}/5 (${businessData.reviews_count} satisfied clients)` :
        `✨ Premium Styling Experience`;
      
      // Dynamic scarcity logic
      let scarcityText;
      if (businessData.available_slots && businessData.available_slots > 3) {
        scarcityText = '✂️ Limited appointments available this week';
      } else if (businessData.available_slots && businessData.available_slots >= 1) {
        scarcityText = `🔥 Only ${businessData.available_slots} premium slots left this week`;
      } else {
        scarcityText = '🔥 Fully booked – priority waitlist open';
      }
      
      return `✂️ **${businessName}**\n${socialProof}\n${scarcityText}\n\nYour next look could completely change how you feel walking into a room.\n\nHow can we help transform your style today?`;
    },
    quickReplies: [
      { title: '📅 Book an appointment', next: 'QUALIFY', action: 'book' },
      { title: '💰 Prices', next: 'PRICES', action: 'qualify' },
      { title: '📍 Location & hours', next: 'LOCATION', action: 'location' },
      { title: '❓ Ask a question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 12
  },

  QUALIFY: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'service_selected');
      
      return `Perfect! 👌\n\nWhich premium service interests you?`;
    },
    quickReplies: [
      { title: '✨ Full Transformation', next: 'QUALIFY_TIMING', payload: { service_type: 'full_transformation' } },
      { title: '🎨 Signature Color', next: 'QUALIFY_TIMING', payload: { service_type: 'signature_color' } },
      { title: '✂️ Precision Haircut', next: 'QUALIFY_TIMING', payload: { service_type: 'precision_haircut' } },
      { title: '💇 Event Styling', next: 'QUALIFY_TIMING', payload: { service_type: 'event_styling' } },
      { title: '🧔 Beard Sculpt', next: 'QUALIFY_TIMING', payload: { service_type: 'beard_sculpt' } }
    ],
    isQualifying: true,
    qualificationField: 'service_type'
  },

  QUALIFY_TIMING: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'timing_selected');
      
      return `Great choice! ⭐\n\nWhen are you looking to book?`;
    },
    quickReplies: [
      { title: '📅 Today', next: 'QUALIFY_STYLIST_PREFERENCE', payload: { urgency: 'today' } },
      { title: '📆 This week', next: 'QUALIFY_STYLIST_PREFERENCE', payload: { urgency: 'this_week' } },
      { title: '🗺️ Next week', next: 'QUALIFY_STYLIST_PREFERENCE', payload: { urgency: 'next_week' } },
      { title: '🔮 Just planning ahead', next: 'QUALIFY_STYLIST_PREFERENCE', payload: { urgency: 'flexible' } }
    ],
    isQualifying: true,
    qualificationField: 'urgency'
  },

  QUALIFY_STYLIST_PREFERENCE: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'stylist_level_selected');
      
      return `👑 **Stylist Selection**\n\nDo you prefer a senior stylist or first available?\n🏆 Senior stylists have 5+ years experience`;
    },
    quickReplies: [
      { title: '🏆 Senior stylist (most requested)', next: 'REQUEST_PHONE', payload: { stylist_level: 'senior' } },
      { title: '⚡ First available', next: 'REQUEST_PHONE', payload: { stylist_level: 'standard' } }
    ],
    isQualifying: true,
    qualificationField: 'stylist_level'
  },

  REQUEST_PHONE: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const businessName = businessData.business_name || 'our premium salon';
      const invalidPhone = conversationData?.payload?.phone_invalid;
      const urgency = conversationData?.payload?.urgency;
      
      await trackEvent(businessData.id || 'unknown', 'phone_requested');
      
      if (invalidPhone) {
        return `❌ **Invalid phone format**\n\n📞 **Please provide a valid mobile number:**\n• Format: +447912345678\n• Or: 07912345678\n\n⏳ Your slot is held for 2 hours pending confirmation`;
      }
      
      const urgencyMessage = urgency === 'today' ? 
        '🔥 **Same-day slots require immediate confirmation**\n\n' : '';
      
      return `${urgencyMessage}📞 **Premium Appointment Booking**\n\n✂️ **${businessName}** - Your transformation awaits\n⏳ **Your slot is held for 2 hours pending confirmation**\n\n✨ **Mobile number required for:**\n• Appointment confirmation\n• Style consultation reminders\n• Any schedule updates\n\n📱 **Format:** +447912345678 or 07912345678`;
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
        const serviceType = conversationData?.payload?.service_type || 'styling';
        const urgency = conversationData?.payload?.urgency || 'flexible';
        const stylistLevel = conversationData?.payload?.stylist_level || 'standard';
        
        const leadData = {
          service_type: serviceType,
          urgency: urgency,
          stylist_level: stylistLevel,
          service_tier: 'hair_styling',
          phone: conversationData?.payload?.phone || 'not_provided',
          timestamp: new Date().toISOString()
        };
        
        const score = computeScore(leadData);
        const hotLead = isHot(score);
        
        await saveLead(businessData.id || 'unknown', { ...leadData, score });
        await trackEvent(businessData.id || 'unknown', 'lead_saved');
        
        if (hotLead) {
          await notifyOwner(
            businessData.id || 'unknown',
            leadData,
            score,
            leadData.phone !== 'not_provided' ? leadData.phone : undefined
          );
        }
        
        // Service label mapping
        const serviceLabels = {
          'precision_haircut': 'Precision Haircut',
          'signature_color': 'Signature Color',
          'beard_sculpt': 'Beard Sculpt',
          'event_styling': 'Event Styling',
          'full_transformation': 'Full Transformation'
        };
        
        const serviceLabel = serviceLabels[serviceType as keyof typeof serviceLabels] || 'Premium Service';
        
        // 3-tier status hierarchy
        let statusMessage;
        if (score > 80) {
          statusMessage = '🔥 **VIP Client Status**';
        } else if (score > 60) {
          statusMessage = '✨ **Priority Client**';
        } else {
          statusMessage = '✂️ **Appointment Reserved**';
        }
        
        // Premium stylist messaging
        const stylistMessage = stylistLevel === 'senior' ?
          '👑 Senior stylist secured' : '⚡ First available stylist assigned';
        
        // Light upsell trigger (non-pushy)
        const upsellHint = serviceType !== 'full_transformation' ?
          '\n✨ Many clients pair this with a conditioning treatment.' : '';
        
        // Safe scarcity logic
        const scarcityText = businessData.available_slots && businessData.available_slots > 1
          ? `⚡ ${businessData.available_slots - 1} premium slots remaining`
          : '⚡ Limited availability remaining';
        
        // Booking fallback chain: booking_link → generateCalendlyLink → phone
        const bookingUrl = businessData.booking_link;
        const hasValidBooking = bookingUrl && validateUrl(bookingUrl);
        
        if (hasValidBooking) {
          await trackEvent(businessData.id || 'unknown', 'booking_link_provided');
          return `${statusMessage} | ${scarcityText}\n${serviceLabel} | ${stylistMessage}${upsellHint}\n\n👆 **Book Now:** ${bookingUrl}`;
        }
        
        // Calendly fallback
        try {
          const calendlyLink = await generateCalendlyLink(businessData.id || 'unknown', { service: serviceType });
          await trackEvent(businessData.id || 'unknown', 'calendly_link_provided');
          return `${statusMessage} | ${scarcityText}\n${serviceLabel} | ${stylistMessage}${upsellHint}\n\n📅 **Schedule:** ${calendlyLink}`;
        } catch (calendlyError) {
          logger.error('Calendly generation failed', businessData.id, { error: calendlyError });
        }
        
        // Phone fallback
        await trackEvent(businessData.id || 'unknown', 'phone_fallback_used');
        return `${statusMessage} | ${scarcityText}\n${serviceLabel} | ${stylistMessage}${upsellHint}\n\n📞 **Call to book:** ${businessData.phone || 'Contact us'}`;
        
      } catch (error) {
        logger.error('Error in hair BOOK state', businessData.id, { error });
        return `✂️ **Appointment Reserved**\n\nPlease call ${businessData.phone || 'us'} to complete your booking.`;
      }
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
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      const businessName = businessData.business_name || 'Premium Salon';
      
      await trackEvent(businessData.id || 'unknown', 'follow_up_sent');
      
      if (followUpCount === 0) {
        return `Still considering your next look? ✨\n\n${businessName} - We've had multiple bookings since we last spoke\n\nYour perfect style is waiting 📅`;
      } else {
        return `🔥 **This week's premium slots are almost gone**\n\nSenior stylists at ${businessName} fully booked first\n\nSecure your transformation today ✂️`;
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
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'conversation_ended');
      
      return `Thank you for considering ${businessData.business_name || 'our premium salon'}! ✨\n\nReady to transform your look whenever you are ✂️`;
    },
    quickReplies: [
      { title: '📅 Actually, let me book', next: 'QUALIFY' },
      { title: '📍 Get location', next: 'LOCATION' }
    ]
  }
};