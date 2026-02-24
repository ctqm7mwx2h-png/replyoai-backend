import { ConversationFlow, BusinessData, ConversationData } from '../types.js';
import { computeScore, isHot } from '../../services/score.js';
import { notifyOwner } from '../../services/notifications.js';
import { trackEvent } from '../../services/analytics.js';
import { saveLead } from '../../services/leads.js';
import { validateUrl } from '../../utils/validateUrl.js';
import { generateCalendlyLink } from '../../utils/calendly.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger();

/**
 * Dynamic ETA calculator with dispatch priority consideration
 */
function calculateETA(_damageSeverity: string, urgency: string, dispatchPriority: string, availableSlots?: number): string {
  const safeSlots = Math.max(0, (availableSlots || 1) - 1);
  const capacityFactor = availableSlots === 0 ? 2.0 : safeSlots <= 1 ? 1.5 : 1.0;
  
  // CRITICAL priority always gets fastest range
  if (dispatchPriority === 'CRITICAL') {
    const base = 8;
    const max = Math.ceil(15 * capacityFactor);
    return `${base}–${max} minutes`;
  }
  
  if (dispatchPriority === 'HIGH') {
    const base = 20;
    const max = Math.ceil(40 * capacityFactor);
    return `${base}–${max} minutes`;
  }
  
  // STANDARD priority
  if (urgency === 'emergency' || urgency === 'today') {
    const base = 45;
    const max = Math.ceil(90 * capacityFactor);
    return `${base}–${max} minutes`;
  }
  
  return capacityFactor > 1.5 ? '3–6 hours' : '2–4 hours';
}

/**
 * Authority and social proof messaging
 */
function getAuthorityMessage(businessData: BusinessData): string {
  if (businessData.rating && businessData.reviews_count) {
    return `⭐ ${businessData.rating}/5 (${businessData.reviews_count} reviews)`;
  }
  return '🏆 Licensed & Insured Plumbing Experts';
}

/**
 * Calculate dispatch priority level
 */
function getDispatchPriority(damageSeverity?: string, urgency?: string, serviceType?: string, insuranceRelated?: boolean): string {
  if (damageSeverity === 'flooding') return 'CRITICAL';
  if (urgency === 'emergency' || serviceType === 'water_heater' || insuranceRelated) return 'HIGH';
  return 'STANDARD';
}

export const plumbingFlow: ConversationFlow = {
  START: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'conversation_started');
      await trackEvent(businessData.id || 'unknown', 'plumbing_stage_reached', { stage: 'START' });
      
      const businessName = businessData.business_name || 'Expert Plumbing Services';
      const authority = getAuthorityMessage(businessData);
      
      return `🔧 **${businessName}**\n${authority}\n\n⚠️ **Water damage spreads fast. Small leaks become structural damage.**\n\nWhat type of plumbing situation do you have?`;
    },
    quickReplies: [
      { title: '🚨 FLOODING - Need help NOW!', next: 'REQUEST_PHONE', action: 'book', payload: { urgency: 'emergency', damage_severity: 'flooding', emergency_path: true } },
      { title: '💧 Emergency - Water flowing!', next: 'EMERGENCY_CHECK', action: 'book', payload: { urgency: 'emergency' } },
      { title: '🔧 Schedule plumbing service', next: 'QUALIFY_SERVICE', action: 'book', payload: { urgency: 'standard' } },
      { title: '💰 Get estimate', next: 'PRICES', action: 'qualify' },
      { title: '❓ Ask question', next: 'QUESTION', action: 'question' }
    ],
    followUpAfterHours: 6
  },

  EMERGENCY_CHECK: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'plumbing_emergency_detected');
      await trackEvent(businessData.id || 'unknown', 'plumbing_stage_reached', { stage: 'EMERGENCY_CHECK' });
      
      const authority = getAuthorityMessage(businessData);
      
      return `🚨 **Emergency Plumbing Assessment**\n${authority}\n\n💧 **Help us prioritize your emergency**\n• Accurate damage assessment ensures proper response\n• Critical for technician preparation and equipment\n\nHow severe is the water situation?`;
    },
    quickReplies: [
      { title: '🌊 Flooding - Water everywhere', next: 'DAMAGE_SEVERITY', payload: { damage_severity: 'flooding' } },
      { title: '💧 Active leak - Water flowing', next: 'DAMAGE_SEVERITY', payload: { damage_severity: 'active_leak' } },
      { title: '💧 Small leak - Dripping/seepage', next: 'DAMAGE_SEVERITY', payload: { damage_severity: 'small_leak' } }
    ],
    isQualifying: true,
    qualificationField: 'emergency_confirmed'
  },

  DAMAGE_SEVERITY: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const severity = conversationData?.payload?.damage_severity;
      
      await trackEvent(businessData.id || 'unknown', 'damage_severity_selected', { severity });
      await trackEvent(businessData.id || 'unknown', 'plumbing_stage_reached', { stage: 'DAMAGE_SEVERITY' });
      
      let responseMessage = '';
      if (severity === 'flooding') {
        responseMessage = `🌊 **Critical Flooding Emergency**\n\n⚡ **Immediate response required**\n• Structural damage imminent\n• Electrical hazards possible\n• Emergency shut-off may be needed\n\n🚨 **Priority dispatch - technician mobilizing**`;
      } else if (severity === 'active_leak') {
        responseMessage = `💧 **Active Water Leak**\n\n⚠️ **Rapid response recommended**\n• Water damage spreading\n• Property at risk\n• Early intervention critical\n\n🔥 **Fast-track dispatch available**`;
      } else {
        responseMessage = `💧 **Leak Assessment**\n\n📋 **Professional evaluation needed**\n• Small leaks often indicate larger issues\n• Prevention better than major repairs\n• Expert diagnosis recommended\n\n🔧 **Qualified technician assignment**`;
      }
      
      return `${responseMessage}\n\nDo you have property insurance?`;
    },
    quickReplies: [
      { title: '✅ Yes, covered by insurance', next: 'QUALIFY_INSURANCE', payload: { insurance_related: true } },
      { title: '❌ No insurance coverage', next: 'REQUEST_PHONE', payload: { insurance_related: false } },
      { title: '❓ Not sure', next: 'QUALIFY_INSURANCE', payload: { insurance_uncertain: true } }
    ],
    isQualifying: true,
    qualificationField: 'damage_severity'
  },

  QUALIFY_INSURANCE: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const insuranceRelated = conversationData?.payload?.insurance_related;
      const authority = getAuthorityMessage(businessData);
      
      await trackEvent(businessData.id || 'unknown', 'insurance_status_confirmed');
      
      if (insuranceRelated) {
        return `💼 **Insurance Claim Support**\n${authority}\n\n📋 **We handle:**\n• Damage documentation & photos\n• Insurance adjuster coordination\n• Repair estimates for claims\n• Direct billing capabilities\n\n🚀 **Getting technician assigned for assessment**`;
      }
      
      return `💰 **Transparent Pricing**\n${authority}\n\n📝 **No surprises:**\n• Upfront estimates before work\n• Flexible payment options\n• No hidden service fees\n\n🚀 **Dispatching technician for emergency repair**`;
    },
    quickReplies: [
      { title: '📞 Provide mobile', next: 'REQUEST_PHONE', payload: { insurance_assessment_ready: true } }
    ],
    isQualifying: true,
    qualificationField: 'insurance_related'
  },

  QUALIFY: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'service_selected');
      
      const authority = getAuthorityMessage(businessData);
      
      return `🔧 **Professional Plumbing Services**\n${authority}\n\nWhich service do you need?\n🏆 All work backed by our guarantee`;
    },
    quickReplies: [
      { title: '🔥 Water heater service', next: 'QUALIFY_URGENCY', payload: { service_type: 'water_heater' } },
      { title: '🔧 Installation/replacement', next: 'QUALIFY_URGENCY', payload: { service_type: 'installation' } },
      { title: '💧 Leak repair', next: 'QUALIFY_URGENCY', payload: { service_type: 'leak' } },
      { title: '🚽 Drain/toilet service', next: 'QUALIFY_URGENCY', payload: { service_type: 'drain' } },
      { title: '🔍 Other plumbing issue', next: 'QUALIFY_URGENCY', payload: { service_type: 'other' } }
    ],
    isQualifying: true,
    qualificationField: 'service_type'
  },

  QUALIFY_SERVICE: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'service_selected');
      
      const authority = getAuthorityMessage(businessData);
      
      return `🔧 **Professional Plumbing Services**\n${authority}\n\nWhich service do you need?\n🏆 All work backed by our guarantee`;
    },
    quickReplies: [
      { title: '🔥 Water heater service', next: 'QUALIFY_URGENCY', payload: { service_type: 'water_heater' } },
      { title: '🔧 Installation/replacement', next: 'QUALIFY_URGENCY', payload: { service_type: 'installation' } },
      { title: '💧 Leak repair', next: 'QUALIFY_URGENCY', payload: { service_type: 'leak' } },
      { title: '🚽 Drain/toilet service', next: 'QUALIFY_URGENCY', payload: { service_type: 'drain' } },
      { title: '🔍 Other plumbing issue', next: 'QUALIFY_URGENCY', payload: { service_type: 'other' } }
    ],
    isQualifying: true,
    qualificationField: 'service_type'
  },

  QUALIFY_URGENCY: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'urgency_selected');
      
      const authority = getAuthorityMessage(businessData);
      
      return `⚡ **Service Timeline**\n${authority}\n\nHow quickly do you need this resolved?\n🚨 Emergency rates apply for same-day dispatch`;
    },
    quickReplies: [
      { title: '🚨 Emergency - Today', next: 'REQUEST_PHONE', payload: { urgency: 'emergency' } },
      { title: '⚡ Today if possible', next: 'REQUEST_PHONE', payload: { urgency: 'today' } },
      { title: '📅 This week', next: 'REQUEST_PHONE', payload: { urgency: 'this_week' } },
      { title: '🗺️ Planning ahead', next: 'REQUEST_PHONE', payload: { urgency: 'flexible' } }
    ],
    isQualifying: true,
    qualificationField: 'urgency'
  },

  REQUEST_PHONE: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const businessName = businessData.business_name || 'our plumbing experts';
      const invalidPhone = conversationData?.payload?.phone_invalid;
      const urgency = conversationData?.payload?.urgency;
      const severity = conversationData?.payload?.damage_severity;
      const serviceType = conversationData?.payload?.service_type;
      const insuranceRelated = conversationData?.payload?.insurance_related;
      const isEmergency = urgency === 'emergency';
      const isFlooding = severity === 'flooding';
      const authority = getAuthorityMessage(businessData);
      const validPhone = conversationData?.payload?.phone && !invalidPhone;
      
      await trackEvent(businessData.id || 'unknown', 'phone_requested');
      await trackEvent(businessData.id || 'unknown', 'plumbing_stage_reached', { stage: 'REQUEST_PHONE' });
      
      // Track explicit phone capture when valid phone is provided
      if (validPhone) {
        await trackEvent(businessData.id || 'unknown', 'plumbing_phone_captured', {
          urgency,
          damage_severity: severity,
          insurance_related: insuranceRelated,
          service_type: serviceType
        });
      }
      
      if (invalidPhone) {
        return `❌ **Invalid phone format**\n\n📞 **Please provide a valid mobile number:**\n• Format: +447912345678\n• Or: 07912345678\n\n⏰ Your ${isEmergency ? 'emergency slot' : 'service slot'} is held for 30 minutes`;
      }
      
      if (isFlooding) {
        return `🌊 **CRITICAL FLOODING RESPONSE**\n${authority}\n\n🚨 **${businessName}** - Emergency team dispatching\n⚡ **PRIORITY SLOT - Immediate assignment**\n\n📱 **Mobile required for:**\n• Emergency technician dispatch\n• Real-time location tracking\n• Critical arrival updates\n\n📞 **URGENT - Format:** +447912345678 or 07912345678`;
      }
      
      if (isEmergency) {
        return `🚨 **Emergency Technician Assignment**\n${authority}\n\n🔧 **${businessName}** - Rapid response team ready\n⏰ **Emergency slot held for 30 minutes**\n\n📱 **Mobile required for:**\n• Immediate technician dispatch\n• GPS tracking and arrival updates\n• Emergency service coordination\n\n📞 **Format:** +447912345678 or 07912345678`;
      }
      
      return `🔧 **Professional Service Dispatch**\n${authority}\n\n⚡ **${businessName}** - Expert technicians ready\n⏰ **Service slot held for 30 minutes**\n\n📱 **Mobile required for:**\n• Technician assignment confirmation\n• Arrival window notifications\n• Service coordination\n\n📞 **Format:** +447912345678 or 07912345678`;
    },
    quickReplies: [
      { title: '📞 Provide mobile number', next: 'REQUEST_PHONE', payload: { awaiting_phone: true } }
    ],
    isQualifying: true,
    qualificationField: 'phone',
    phoneValidation: true,
    followUpAfterHours: 2
  },

  BOOK: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      try {
        const serviceType = conversationData?.payload?.service_type || 'plumbing';
        const urgency = conversationData?.payload?.urgency || 'flexible';
        const damageSeverity = conversationData?.payload?.damage_severity || 'unknown';
        const insuranceRelated = conversationData?.payload?.insurance_related || false;
        const isEmergency = urgency === 'emergency';
        const isFlooding = damageSeverity === 'flooding';
        const isWaterHeater = serviceType === 'water_heater';
        const isInstallation = serviceType === 'installation';
        const isSameDay = urgency === 'emergency' || urgency === 'today';
        
        await trackEvent(businessData.id || 'unknown', 'plumbing_stage_reached', { stage: 'BOOK' });
        
        // Calculate dispatch priority
        const dispatchPriority = getDispatchPriority(damageSeverity, urgency, serviceType, insuranceRelated);
        
        // Enhanced lead scoring context with weighted flags
        const leadData = {
          service_type: serviceType,
          urgency: urgency,
          damage_severity: damageSeverity,
          insurance_related: insuranceRelated,
          dispatch_priority: dispatchPriority,
          service_tier: 'plumbing',
          phone: conversationData?.payload?.phone || 'not_provided',
          emergency_path: conversationData?.payload?.emergency_path || false,
          timestamp: new Date().toISOString(),
          // Enhanced scoring flags
          ...(isFlooding && { flooding_emergency: true }),
          ...(isWaterHeater && { high_value_job: true }),
          ...(isInstallation && { high_value_job: true }),
          ...(isEmergency && { emergency_priority: true }),
          ...(insuranceRelated && { insurance_claim: true }),
          ...(isSameDay && { same_day: true })
        };
        
        const score = computeScore(leadData);
        const hotLead = isHot(score);
        
        await saveLead(businessData.id || 'unknown', { ...leadData, score });
        
        // Lead intelligence event with full scoring context
        await trackEvent(businessData.id || 'unknown', 'plumbing_lead_scored', {
          service_type: serviceType,
          urgency: urgency,
          damage_severity: damageSeverity,
          insurance_related: insuranceRelated,
          dispatch_priority: dispatchPriority,
          score: score,
          hot: hotLead
        });
        
        if (hotLead) {
          await notifyOwner(
            businessData.id || 'unknown',
            { ...leadData, dispatch_priority: dispatchPriority },
            score,
            leadData.phone !== 'not_provided' ? leadData.phone : undefined
          );
        }
        
        // Service label mapping
        const serviceLabels: { [key: string]: string } = {
          'leak': 'Leak Repair',
          'drain': 'Drain/Toilet Service',
          'installation': 'Installation/Replacement',
          'water_heater': 'Water Heater Service',
          'other': 'Plumbing Service'
        };
        
        const serviceLabel = serviceLabels[serviceType as keyof typeof serviceLabels] || 'Plumbing Service';
        
        // Severity-aware status hierarchy
        let statusMessage;
        if (isFlooding || score > 90) {
          statusMessage = '🌊 **CRITICAL EMERGENCY DISPATCH**';
        } else if (score > 80 || isEmergency) {
          statusMessage = '🚨 **Priority Emergency Dispatch**';
        } else if (score > 60) {
          statusMessage = '🔥 **Rapid Response Scheduled**';
        } else {
          statusMessage = '🔧 **Service Appointment Confirmed**';
        }
        
        // Safe scarcity logic - only show for emergency paths
        const safeSlots = Math.max(0, (businessData.available_slots || 0) - 1);
        const showScarcity = isEmergency || isFlooding;
        const scarcityText = showScarcity && businessData.available_slots && businessData.available_slots > 1
          ? `⚡ ${safeSlots} emergency slots remaining today`
          : showScarcity 
            ? '⚡ Limited emergency availability'
            : '';
        
        // Truly dynamic ETA with dispatch priority consideration
        const eta = calculateETA(damageSeverity, urgency, dispatchPriority, businessData.available_slots);
        const etaMessage = isEmergency || isFlooding
          ? `\n⏱️ **Estimated arrival: ${eta}**`
          : `\n📅 **Estimated arrival: ${eta}**`;
        
        // Emergency-specific messaging
        const urgencyContext = isEmergency ? 
          '\n🚨 **Technician dispatching immediately**' : '';
        
        // Insurance-related documentation message
        const insuranceMessage = insuranceRelated ?
          '\n📋 **Insurance claim documentation included**' : '';
        
        // Booking fallback chain: booking_link → generateCalendlyLink → phone
        const bookingUrl = businessData.booking_link;
        const hasValidBooking = bookingUrl && validateUrl(bookingUrl);
        
        if (hasValidBooking) {
          await trackEvent(businessData.id || 'unknown', 'booking_link_provided');
          return `${statusMessage}${scarcityText ? ' | ' + scarcityText : ''}\n${serviceLabel} confirmed${urgencyContext}${insuranceMessage}${etaMessage}\n\n👆 **Schedule:** ${bookingUrl}`;
        }
        
        // Calendly fallback
        const service = isFlooding ? 'critical-plumbing-emergency' : 
                       isEmergency ? 'emergency-plumbing' : 'plumbing-service';
        try {
          const calendlyLink = await generateCalendlyLink(businessData.id || 'unknown', { service });
          await trackEvent(businessData.id || 'unknown', 'calendly_link_provided');
          return `${statusMessage}${scarcityText ? ' | ' + scarcityText : ''}\n${serviceLabel} confirmed${urgencyContext}${insuranceMessage}${etaMessage}\n\n📅 **Schedule:** ${calendlyLink}`;
        } catch (calendlyError) {
          logger.error('Calendly generation failed', businessData.id, { error: calendlyError });
        }
        
        // Phone fallback
        await trackEvent(businessData.id || 'unknown', 'phone_fallback_used');
        return `${statusMessage}${scarcityText ? ' | ' + scarcityText : ''}\n${serviceLabel} confirmed${urgencyContext}${insuranceMessage}${etaMessage}\n\n📞 **Call:** ${businessData.phone || 'Contact us'}`;
        
      } catch (error) {
        logger.error('Error in plumbing BOOK state', businessData.id, { error });
        return `🔧 **Service confirmed**\n\nOur dispatch team will contact you shortly\n📞 **Emergency line:** ${businessData.phone || 'Contact us'}`;
      }
    },
    quickReplies: [
      { title: '📞 Call dispatch', next: 'LOCATION', payload: { callback_requested: true } },
      { title: '❓ Have questions', next: 'QUESTION', payload: { needs_support: true } },
      { title: '✅ All set', next: 'END', payload: { booking_completed: true } }
    ],
    isBookingState: true,
    followUpAfterHours: 6
  },

  PRICES: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_pricing');
      
      const authority = getAuthorityMessage(businessData);
      
      return `💰 **Transparent Plumbing Pricing**\n${authority}\n\n🏆 Licensed & insured professionals\n⚡ No hidden fees or surprise charges\n🚨 Emergency service available 24/7\n\n💎 Free estimates on major repairs`;
    },
    quickReplies: [
      { title: '🔧 Book service', next: 'QUALIFY_SERVICE', action: 'book' },
      { title: '📍 Service areas', next: 'LOCATION' },
      { title: '❓ Pricing questions', next: 'QUESTION' }
    ]
  },

  LOCATION: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'viewed_location');
      
      const authority = getAuthorityMessage(businessData);
      const callbackMessage = conversationData?.payload?.callback_requested ?
        '📞 **Dispatch calling within 10 minutes**\n\n' : '';
      
      return `${callbackMessage}📍 **Service Coverage**\n${businessData.location || 'Full metro area coverage'}\n${authority}\n\n⏰ **Availability:**\n${businessData.hours || '24/7 Emergency Service'}\n\n🚨 **Emergency Line:**\n${businessData.phone || 'Contact us'}`;
    },
    quickReplies: [
      { title: '🔧 Book service', next: 'QUALIFY_SERVICE', action: 'book' },
      { title: '💰 Get estimate', next: 'PRICES' },
      { title: '❓ Ask question', next: 'QUESTION' }
    ]
  },

  QUESTION: {
    message: async (businessData: BusinessData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'started_questions');
      
      const authority = getAuthorityMessage(businessData);
      
      return `🔧 **Expert Plumbing Support**\n${authority}\n\nWhat questions do you have about your plumbing needs?\n💪 Our licensed professionals provide detailed guidance`;
    },
    quickReplies: [
      { title: '💰 Pricing info', next: 'PRICES' },
      { title: '🔧 Book service', next: 'QUALIFY_SERVICE' },
      { title: '📍 Service areas', next: 'LOCATION' }
    ]
  },

  FOLLOW_UP: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      const followUpCount = conversationData?.leadData?.followUpCount || 0;
      const businessName = businessData.business_name || 'Expert Plumbing';
      const severity = conversationData?.payload?.damage_severity;
      
      await trackEvent(businessData.id || 'unknown', 'follow_up_sent', { severity, followUpCount });
      
      // Severity-aware follow-up messaging
      if (severity === 'flooding') {
        return `🌊 **Water damage is spreading**\n\n${businessName} - Emergency response team\nFlooding causes structural damage within hours\n\n⚡ Don't wait - dispatch now`;
      }
      
      if (severity === 'active_leak') {
        return `💧 **Active leaks worsen quickly**\n\n${businessName} - Professional emergency response\nWater spreads behind walls causing mold and damage\n\n🔥 Stop the leak before it spreads`;
      }
      
      if (followUpCount === 0) {
        return `🚨 **Water damage doesn't fix itself**\n\n${businessName} - Professional plumbing experts\nSmall leaks become major repairs behind walls\n\n⚡ Don't let it worsen - act now`;
      } else {
        return `💧 **Plumbing issues escalate quickly**\n\n${businessName} emergency response available\nLeaks worsen behind walls causing structural damage\n\n🔧 Professional repair before it's too late`;
      }
    },
    quickReplies: [
      { title: '🚨 Yes, need help now!', next: 'EMERGENCY_CHECK', payload: { urgency: 'emergency' } },
      { title: '🔧 Schedule service', next: 'QUALIFY_SERVICE' },
      { title: '✅ Issue resolved', next: 'END', payload: { resolved: true } }
    ],
    followUpAfterHours: 24
  },

  END: {
    message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
      await trackEvent(businessData.id || 'unknown', 'conversation_ended');
      
      const bookingCompleted = conversationData?.payload?.booking_completed;
      const resolved = conversationData?.payload?.resolved;
      const businessName = businessData.business_name || 'Expert Plumbing';
      const authority = getAuthorityMessage(businessData);
      
      // Retention tagging for resolved issues
      if (resolved === true) {
        await trackEvent(businessData.id || 'unknown', 'plumbing_issue_resolved', {
          retention_candidate: true
        });
      }
      
      if (bookingCompleted) {
        return `🔧 **Service confirmed with ${businessName}**\n${authority}\n\nOur licensed technician will contact you shortly\n📞 **24/7 Emergency:** ${businessData.phone || 'Call us'}\n\n💪 Professional plumbing solutions`;
      }
      
      return `🔧 **${businessName} - Always Ready**\n${authority}\n\n📞 **24/7 Emergency:** ${businessData.phone || 'Call us'}\n\n⚡ When you need us, we'll be there`;
    },
    quickReplies: [
      { title: '🚨 Actually, it\'s urgent!', next: 'EMERGENCY_CHECK', payload: { urgent_callback: true } },
      { title: '📍 Service coverage', next: 'LOCATION' },
      { title: '❓ Ask question', next: 'QUESTION' }
    ]
  }
};