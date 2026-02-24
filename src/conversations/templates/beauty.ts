import { ConversationFlow, BusinessData, ConversationData } from '../types.js';

// ===== TYPES =====

export interface BeautyTenantConfig {
  // Business profile
  available_slots?: number;
  booking_link?: string;
  deposit_link?: string;
  rating?: number;
  reviews_count?: number;
  
  // Feature flags
  show_scarcity: boolean;
  enable_deposit: boolean;
  enable_photo_upload: boolean;
  
  // Revenue optimization
  require_deposit_for_booking?: boolean;
  deposit_amount_fixed?: number;
  auto_release_slot_minutes?: number;
  hot_lead_escalation_minutes?: number;
  
  // Scoring configuration
  scoring_weights: {
    service_value: number;     // hair, bridal services
    same_day_interest: number; // ASAP bookings
    verified_phone: number;    // phone validation
    deposit_intent: number;    // willingness to pay deposit
  };
  
  // ETA rules by priority
  eta_rules: {
    ASAP: string;
    THIS_WEEK: string;
    STANDARD: string;
  };
  
  // Authority messaging
  authority_fallback: string;
}

export interface BeautyLeadData {
  service_type: string;
  urgency: string;
  dispatch_priority: string;
  phone: string;
  timestamp: string;
  
  // Service flags
  first_time?: boolean;
  extra_requests?: string;
  photo_uploaded?: boolean;
  deposit_intent?: boolean;
  
  // Payment tracking
  deposit_required?: boolean;
  deposit_amount?: number;
  deposit_status?: 'pending' | 'paid' | 'failed' | 'released';
  payment_deadline?: string;
  
  // Escalation tracking
  owner_notified_at?: string;
  escalation_sent?: boolean;
  
  // Scoring flags
  high_value_service?: boolean;
  same_day_interest?: boolean;
  verified_phone?: boolean;
  
  // Metadata
  urgency_weight: 'high' | 'medium' | 'low';
  owner_notification_priority: 'sms' | 'push' | 'email';
  score?: number;
}

export interface BeautyPayload {
  service_type?: string;
  urgency?: string;
  same_day_interest?: boolean;
  first_time?: boolean;
  extra_requests?: string;
  photo_uploaded?: boolean;
  deposit_intent?: boolean;
  phone?: string;
  phone_invalid?: boolean;
  awaiting_phone?: boolean;
  booking_completed?: boolean;
  resolved?: boolean;
  
  // Payment tracking
  deposit_paid?: boolean;
  payment_id?: string;
  
  // Engagement tracking
  reached_availability?: boolean;
  phone_reminder_sent?: boolean;
  final_reminder_sent?: boolean;
}

export interface BeautyAdapters {
  // Lead management
  saveLead: (tenantId: string, leadData: BeautyLeadData & { score: number }) => Promise<void>;
  
  // Scoring
  computeScore: (leadData: BeautyLeadData) => number;
  isHot: (score: number, threshold?: number) => boolean;
  
  // Notifications
  notifyOwner: (tenantId: string, leadData: BeautyLeadData, score: number, phone?: string) => Promise<void>;
  
  // Booking
  generateBookingLink: (tenantId: string, options: { service: string }) => Promise<string>;
  
  // Payment processing
  generateDepositLink: (tenantId: string, leadData: BeautyLeadData, amount: number) => Promise<string>;
  scheduleSlotRelease: (tenantId: string, leadId: string, minutes: number) => Promise<void>;
  
  // Escalation & reminders
  scheduleEscalation: (tenantId: string, leadId: string, minutes: number) => Promise<void>;
  sendPhoneReminder: (tenantId: string, conversationId: string, hours: number) => Promise<void>;
  
  // Utilities
  validateUrl: (url: string) => boolean;
  
  // Metrics & analytics
  metrics: {
    trackEvent: (tenantId: string, event: string, data?: Record<string, unknown>) => Promise<void>;
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * Calculate dispatch priority for beauty services
 */
function getDispatchPriority(serviceType?: string, urgency?: string): string {
  if (urgency === 'today') return 'ASAP';
  if (serviceType === 'hair' || serviceType === 'bridal' || serviceType === 'wedding') return 'THIS_WEEK';
  return 'STANDARD';
}

/**
 * Dynamic ETA calculator using tenant configuration
 */
function calculateETA(
  dispatchPriority: string,
  config: BeautyTenantConfig
): string {
  if (dispatchPriority === 'ASAP') {
    return config.eta_rules.ASAP;
  }
  
  if (dispatchPriority === 'THIS_WEEK') {
    return config.eta_rules.THIS_WEEK;
  }
  
  return config.eta_rules.STANDARD;
}

/**
 * Authority and social proof messaging using tenant data
 */
function getAuthorityMessage(businessData: BusinessData, config: BeautyTenantConfig): string {
  if (config.rating && config.reviews_count) {
    return `⭐ ${config.rating}/5 (${config.reviews_count} reviews)`;
  }
  
  if (businessData.rating && businessData.reviews_count) {
    return `⭐ ${businessData.rating}/5 (${businessData.reviews_count} reviews)`;
  }
  
  return config.authority_fallback;
}

/**
 * Dynamic scarcity messaging based on availability and urgency
 */
function getScarcityMessage(
  availableSlots: number,
  urgency?: string,
  config?: BeautyTenantConfig
): string {
  if (!config?.show_scarcity) return '';
  
  // Critical scarcity for very low slots
  if (availableSlots <= 2) {
    return `🔥 Only ${availableSlots} prime-time slots left`;
  }
  
  // Urgency scarcity for same-day bookings
  if (urgency === 'today' && availableSlots <= 5) {
    return `⚡ ${availableSlots} same-day slots remaining`;
  }
  
  // Standard scarcity display
  if (availableSlots > 0) {
    return `⚡ ${availableSlots} slots available this week`;
  }
  
  return '⚡ Limited availability';
}

/**
 * Calculate deposit amount based on service and config
 */
function calculateDepositAmount(
  serviceType: string,
  config: BeautyTenantConfig
): number {
  if (config.deposit_amount_fixed) {
    return config.deposit_amount_fixed;
  }
  
  // Dynamic pricing based on service value
  const servicePricing = {
    'hair': 25,
    'bridal': 50,
    'wedding': 75,
    'lashes': 15,
    'nails': 10,
    'makeup': 20
  };
  
  return servicePricing[serviceType as keyof typeof servicePricing] || 15;
}

/**
 * Schedule hot lead escalation if configured
 */
async function scheduleHotLeadEscalation(
  tenantId: string,
  leadData: BeautyLeadData,
  config: BeautyTenantConfig,
  adapters: BeautyAdapters
): Promise<void> {
  if (config.hot_lead_escalation_minutes && config.hot_lead_escalation_minutes > 0) {
    try {
      await adapters.scheduleEscalation(
        tenantId,
        `${leadData.phone}_${leadData.timestamp}`, // Lead ID
        config.hot_lead_escalation_minutes
      );
      
      await adapters.metrics.trackEvent(tenantId, 'hot_lead_escalation_scheduled', {
        service_type: leadData.service_type,
        escalation_minutes: config.hot_lead_escalation_minutes
      });
    } catch (error) {
      await adapters.metrics.trackEvent(tenantId, 'escalation_schedule_failed', {
        error: String(error)
      });
    }
  }
}

/**
 * Schedule missed DM recovery reminders
 */
async function scheduleMissedDMRecovery(
  tenantId: string,
  conversationId: string,
  adapters: BeautyAdapters
): Promise<void> {
  try {
    // 3-hour reminder
    await adapters.sendPhoneReminder(tenantId, conversationId, 3);
    
    // 24-hour final reminder
    await adapters.sendPhoneReminder(tenantId, conversationId, 24);
    
    await adapters.metrics.trackEvent(tenantId, 'missed_dm_recovery_scheduled', {
      reminder_3h: true,
      reminder_24h: true
    });
  } catch (error) {
    await adapters.metrics.trackEvent(tenantId, 'dm_recovery_schedule_failed', {
      error: String(error)
    });
  }
}

/**
 * Create enhanced lead data with safe conditional spreads
 */
function createLeadData(
  conversationData: ConversationData | undefined,
  dispatchPriority: string,
  config?: BeautyTenantConfig
): BeautyLeadData {
  const serviceType = conversationData?.payload?.service_type || 'beauty';
  const urgency = conversationData?.payload?.urgency || 'planning';
  const depositIntent = conversationData?.payload?.deposit_intent || false;
  const sameDayInterest = urgency === 'today';
  const isHighValue = serviceType === 'hair' || serviceType === 'bridal' || serviceType === 'wedding';
  const verifiedPhone = conversationData?.payload?.phone && !conversationData?.payload?.phone_invalid;
  const photoUploaded = conversationData?.payload?.photo_uploaded || false;
  const firstTime = conversationData?.payload?.first_time || false;
  const depositPaid = conversationData?.payload?.deposit_paid || false;
  
  // Calculate deposit requirements
  const depositRequired = config?.require_deposit_for_booking && !depositPaid;
  const depositAmount = config ? calculateDepositAmount(serviceType, config) : undefined;
  
  const leadData: BeautyLeadData = {
    service_type: serviceType,
    urgency: urgency,
    dispatch_priority: dispatchPriority,
    phone: conversationData?.payload?.phone || 'not_provided',
    timestamp: new Date().toISOString(),
    
    // Service flags
    ...(firstTime ? { first_time: true } : {}),
    ...(conversationData?.payload?.extra_requests ? { extra_requests: conversationData.payload.extra_requests } : {}),
    ...(photoUploaded ? { photo_uploaded: true } : {}),
    ...(depositIntent ? { deposit_intent: true } : {}),
    
    // Payment tracking
    ...(depositRequired && depositAmount ? {
      deposit_required: true,
      deposit_amount: depositAmount,
      deposit_status: depositPaid ? 'paid' as const : 'pending' as const,
      payment_deadline: config?.auto_release_slot_minutes ? 
        new Date(Date.now() + config.auto_release_slot_minutes * 60 * 1000).toISOString() : undefined
    } : {}),
    
    // Scoring flags with safe ternary spread syntax
    ...(isHighValue ? { high_value_service: true } : {}),
    ...(sameDayInterest ? { same_day_interest: true } : {}),
    ...(verifiedPhone ? { verified_phone: true } : {}),
    
    // Metadata
    urgency_weight: sameDayInterest ? 'high' : (urgency === 'this_week' ? 'medium' : 'low'),
    owner_notification_priority: dispatchPriority === 'ASAP' ? 'sms' : 
                               dispatchPriority === 'THIS_WEEK' ? 'push' : 'email'
  };
  
  return leadData;
}

// ===== FACTORY FUNCTION =====

/**
 * Creates a tenant-specific beauty conversation flow
 */
export function createBeautyFlow(
  config: BeautyTenantConfig,
  adapters: BeautyAdapters
): ConversationFlow {
  return {
    START: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'conversation_started');
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_stage_reached', { stage: 'START' });
        
        const businessName = businessData.business_name || 'Premier Beauty Salon';
        const authority = getAuthorityMessage(businessData, config);
        
        // Dynamic scarcity messaging
        const safeSlots = Math.max(0, ((config.available_slots || businessData.available_slots) || 0));
        const scarcityText = getScarcityMessage(safeSlots, undefined, config);
        
        return `💄 **${businessName}**\n${authority}\n${scarcityText ? scarcityText + '\n' : ''}\n💅 **Ready to look amazing?**`;
      },
      quickReplies: [
        { title: '💅 Book appointment', next: 'SERVICE_SELECT' },
        { title: '💰 View prices', next: 'PRICES' },
        { title: '📍 Location & hours', next: 'LOCATION' },
        { title: '❓ Ask question', next: 'QUESTION' }
      ],
      followUpAfterHours: 12
    },

    QUALIFY: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_stage_reached', { stage: 'QUALIFY' });
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `💄 **Service Information**\n${authority}\n\n💅 **What service interests you most?**`;
      },
      quickReplies: [
        { title: '💅 View services', next: 'SERVICE_SELECT' },
        { title: '💰 See pricing', next: 'PRICES' },
        { title: '📅 Check availability', next: 'AVAILABILITY' }
      ],
      isQualifying: true,
      qualificationField: 'service_interest'
    },

    SERVICE_SELECT: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_stage_reached', { stage: 'SERVICE_SELECT' });
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `💄 **Service Selection**\n${authority}\n\n💅 **What brings you in today?**`;
      },
      quickReplies: [
        { title: '💅 Nail services', next: 'AVAILABILITY', payload: { service_type: 'nails' } },
        { title: '👁️ Lash & brows', next: 'AVAILABILITY', payload: { service_type: 'lashes' } },
        { title: '💇 Hair styling', next: 'AVAILABILITY', payload: { service_type: 'hair' } },
        { title: '💄 Makeup', next: 'AVAILABILITY', payload: { service_type: 'makeup' } },
        { title: '👰 Bridal package', next: 'AVAILABILITY', payload: { service_type: 'bridal' } },
        { title: '✨ Other service', next: 'AVAILABILITY', payload: { service_type: 'other' } }
      ],
      isQualifying: true,
      qualificationField: 'service_type'
    },

    PRICES: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'viewed_pricing');
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `💰 **Treatment Pricing**\n${authority}\n\n💎 **Competitive rates for premium treatments**\n• Consultation required for accurate pricing\n• Package deals available\n• Flexible payment options\n\n📅 **Book consultation for personalised quote**`;
      },
      quickReplies: [
        { title: '📅 Check availability', next: 'SERVICE_SELECT' },
        { title: '📍 Visit location', next: 'LOCATION' },
        { title: '❓ Specific questions', next: 'QUESTION' }
      ]
    },

    AVAILABILITY: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        const serviceType = conversationData?.payload?.service_type;
        
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'service_selected', { service_type: serviceType });
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_stage_reached', { stage: 'AVAILABILITY' });
        
        // Track that user reached availability (for missed DM recovery)
        if (conversationData?.payload) {
          conversationData.payload.reached_availability = true;
        }
        
        const serviceLabels = {
          'nails': 'Nail Services',
          'lashes': 'Lash & Brow Treatment',
          'hair': 'Hair Styling',
          'makeup': 'Makeup Services',
          'bridal': 'Bridal Package',
          'other': 'Beauty Treatment'
        };
        
        const serviceName = serviceLabels[serviceType as keyof typeof serviceLabels] || 'Beauty Service';
        const authority = getAuthorityMessage(businessData, config);
        
        // Dynamic scarcity display based on service urgency
        const safeSlots = Math.max(0, ((config.available_slots || businessData.available_slots) || 0));
        const urgency = conversationData?.payload?.urgency;
        const scarcityText = getScarcityMessage(safeSlots, urgency, config);
        
        return `💅 **${serviceName}**\n${authority}\n${scarcityText ? scarcityText + '\n' : ''}\n📅 **When would you like to book?**`;
      },
      quickReplies: [
        { title: '📅 Today', next: 'REQUEST_PHONE', payload: { urgency: 'today' } },
        { title: '📆 This week', next: 'REQUEST_PHONE', payload: { urgency: 'this_week' } },
        { title: '🗓️ Next week', next: 'REQUEST_PHONE', payload: { urgency: 'next_week' } },
        { title: '🔮 Just planning', next: 'REQUEST_PHONE', payload: { urgency: 'planning' } }
      ],
      isQualifying: true,
      qualificationField: 'urgency'
    },

    REQUEST_PHONE: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        const businessName = businessData.business_name || 'our salon';
        const invalidPhone = conversationData?.payload?.phone_invalid;
        const urgency = conversationData?.payload?.urgency;
        const serviceType = conversationData?.payload?.service_type;
        const authority = getAuthorityMessage(businessData, config);
        const validPhone = conversationData?.payload?.phone && !invalidPhone;
        
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'phone_requested');
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_stage_reached', { stage: 'REQUEST_PHONE' });
        
        // Track phone capture when valid phone is provided
        if (validPhone) {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_phone_captured', {
            service_type: serviceType,
            urgency: urgency
          });
        } else if (conversationData?.payload?.reached_availability) {
          // Schedule missed DM recovery if they reached availability but didn't provide phone
          const conversationId = `${businessData.id}_${conversationData.payload.service_type}_${Date.now()}`;
          await scheduleMissedDMRecovery(businessData.id || 'unknown', conversationId, adapters);
        }
        
        if (invalidPhone) {
          return `❌ **Invalid phone format**\n\n📞 **Please provide a valid mobile number:**\n• Format: +447912345678\n• Or: 07912345678\n\n⏰ Your slot is held for 30 minutes`;
        }
        
        return `📞 **Appointment Confirmation**\n${authority}\n\n💄 **${businessName}** - Almost ready!\n⏰ **Slot held for 30 minutes**\n\n📱 **Mobile required for:**\n• Appointment confirmation\n• Reminder notifications\n• Any changes\n\n📞 **Format:** +447912345678 or 07912345678`;
      },
      quickReplies: [
        { title: '📞 I\'ll send my number', next: 'REQUEST_PHONE', payload: { awaiting_phone: true } }
      ],
      isQualifying: true,
      qualificationField: 'phone',
      phoneValidation: true,
      followUpAfterHours: 2
    },

    ...(config.enable_photo_upload ? {
      PHOTO_UPLOAD: {
        message: async (businessData: BusinessData): Promise<string> => {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_stage_reached', { stage: 'PHOTO_UPLOAD' });
          
          const authority = getAuthorityMessage(businessData, config);
          
          return `📸 **Inspiration Photo (Optional)**\n${authority}\n\n💅 **Have a look you love?**\n• Share inspiration photos\n• Help us prepare your appointment\n• Get the exact style you want\n\n🔒 **All photos kept confidential**`;
        },
        quickReplies: [
          { title: '📸 Share photos', next: config.require_deposit_for_booking ? 'DEPOSIT' : 'BOOK', payload: { photo_uploaded: true } },
          { title: '⏭️ Skip photos', next: config.require_deposit_for_booking ? 'DEPOSIT' : 'BOOK', payload: { photo_uploaded: false } }
        ]
      }
    } : {}),

    ...(config.require_deposit_for_booking ? {
      DEPOSIT: {
        message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
          const serviceType = conversationData?.payload?.service_type || 'beauty';
          const depositAmount = calculateDepositAmount(serviceType, config);
          
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_stage_reached', { stage: 'DEPOSIT' });
          
          const authority = getAuthorityMessage(businessData, config);
          const autoReleaseMinutes = config.auto_release_slot_minutes || 30;
          
          try {
            // Create lead data for deposit link generation
            const leadData = createLeadData(conversationData, getDispatchPriority(serviceType, conversationData?.payload?.urgency), config);
            const depositLink = await adapters.generateDepositLink(businessData.id || 'unknown', leadData, depositAmount);
            
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'deposit_link_generated', {
              service_type: serviceType,
              deposit_amount: depositAmount
            });
            
            return `💳 **Secure Your Appointment**\n${authority}\n\n💎 **Deposit Required: £${depositAmount}**\n• Guarantees your time slot\n• Applied to final treatment cost\n• Fully refundable with 24h notice\n\n⏰ **Complete within ${autoReleaseMinutes} minutes to secure booking**\n\n👆 **Pay Deposit:** ${depositLink}`;
          } catch (error) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'deposit_link_failed', {
              error: String(error)
            });
            
            return `💳 **Deposit Required**\n${authority}\n\n💎 **£${depositAmount} deposit secures your appointment**\n\nPlease contact us to complete your booking:\n📞 **Call:** ${businessData.phone || 'Contact salon'}`;
          }
        },
        quickReplies: [
          { title: '💳 Deposit paid', next: 'BOOK', payload: { deposit_paid: true } },
          { title: '📞 Call instead', next: 'LOCATION' },
          { title: '❓ Questions about deposit', next: 'QUESTION' }
        ]
      }
    } : {}),

    BOOK: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        try {
          const alreadyBooked = conversationData?.leadData?.alreadyBooked || false;
          
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_stage_reached', { stage: 'BOOK' });
          
          // DUPLICATE ATTEMPT GUARD
          if (alreadyBooked) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_duplicate_attempt');
            return `📅 **Appointment Already Booked**\n\nYou already have an appointment with us.\n📞 **Need changes?** ${businessData.phone || 'Contact us'}`;
          }
          
          // DEPOSIT ENFORCEMENT CHECK
          if (config.require_deposit_for_booking && !conversationData?.payload?.deposit_paid) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'booking_blocked_no_deposit');
            return `💳 **Deposit Required First**\n\nPlease complete your deposit payment to confirm your booking.\n\n📞 **Need help?** ${businessData.phone || 'Contact salon'}`;
          }
          
          // Calculate dispatch priority
          const serviceType = conversationData?.payload?.service_type || 'beauty';
          const urgency = conversationData?.payload?.urgency || 'planning';
          const dispatchPriority = getDispatchPriority(serviceType, urgency);
          
          // Create enhanced lead data
          const leadData = createLeadData(conversationData, dispatchPriority, config);
          
          // Standard booking flow
          const score = adapters.computeScore(leadData);
          const hotLead = adapters.isHot(score);
          
          await adapters.saveLead(businessData.id || 'unknown', { ...leadData, score });
          
          // Enhanced lead intelligence tracking
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_lead_scored', {
            service_type: serviceType,
            urgency: leadData.urgency,
            dispatch_priority: dispatchPriority,
            score: score,
            hot: hotLead,
            urgency_weight: leadData.urgency_weight,
            deposit_enforced: config.require_deposit_for_booking || false
          });
          
          // Track deposit completion if required
          if (config.require_deposit_for_booking && conversationData?.payload?.deposit_paid) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_deposit_completed', {
              deposit_amount: leadData.deposit_amount,
              service_type: serviceType
            });
            
            // Schedule slot release cancellation (payment successful)
            if (config.auto_release_slot_minutes) {
              try {
                await adapters.scheduleSlotRelease(
                  businessData.id || 'unknown',
                  `${leadData.phone}_${leadData.timestamp}`,
                  0 // Cancel the release
                );
              } catch (error) {
                await adapters.metrics.trackEvent(businessData.id || 'unknown', 'slot_release_cancel_failed', {
                  error: String(error)
                });
              }
            }
          }
          
          // Priority-based owner routing with escalation
          if (hotLead) {
            // Add timestamp for escalation tracking
            leadData.owner_notified_at = new Date().toISOString();
            
            await adapters.notifyOwner(
              businessData.id || 'unknown',
              leadData,
              score,
              leadData.phone !== 'not_provided' ? leadData.phone : undefined
            );
            
            // Schedule hot lead escalation if configured
            await scheduleHotLeadEscalation(businessData.id || 'unknown', leadData, config, adapters);
          }
          
          const serviceLabels: { [key: string]: string } = {
            'nails': 'Nail Appointment',
            'lashes': 'Lash & Brow Appointment',
            'hair': 'Hair Appointment',
            'makeup': 'Makeup Appointment',
            'bridal': 'Bridal Consultation',
            'other': 'Beauty Appointment'
          };
          
          const serviceLabel = serviceLabels[serviceType] || 'Beauty Appointment';
          
          // Priority-based status messaging
          let statusMessage;
          if (dispatchPriority === 'ASAP' || score > 90) {
            statusMessage = '⚡ **Priority Appointment Confirmed**';
          } else if (dispatchPriority === 'THIS_WEEK' || score > 80) {
            statusMessage = '💄 **Premium Appointment Booked**';
          } else {
            statusMessage = '📅 **Appointment Confirmed**';
          }
          
          // Dynamic ETA calculation
          const eta = calculateETA(dispatchPriority, config);
          const etaMessage = `\n📅 **Appointment availability: ${eta}**`;
          
          // Deposit confirmation message
          const depositMessage = config.require_deposit_for_booking && conversationData?.payload?.deposit_paid
            ? '\n💳 **Deposit confirmed - slot secured**'
            : leadData.deposit_intent && config.enable_deposit
              ? '\n💳 **Secure with deposit after booking**'
              : '';
          
          // Booking fallback chain: config.booking_link → generateBookingLink → phone
          const bookingUrl = config.booking_link || businessData.booking_link;
          const hasValidBooking = bookingUrl && adapters.validateUrl(bookingUrl);
          
          if (hasValidBooking) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'booking_link_provided');
            return `${statusMessage}\n${serviceLabel} ready${depositMessage}${etaMessage}\n\n👆 **Book:** ${bookingUrl}`;
          }
          
          // Generate booking link fallback
          try {
            const bookingLink = await adapters.generateBookingLink(businessData.id || 'unknown', { service: serviceType });
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'booking_link_generated');
            return `${statusMessage}\n${serviceLabel} ready${depositMessage}${etaMessage}\n\n📅 **Book:** ${bookingLink}`;
          } catch (bookingError) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'booking_generation_failed', { error: String(bookingError) });
          }
          
          // Phone fallback
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'phone_fallback_used');
          return `${statusMessage}\n${serviceLabel} ready${depositMessage}${etaMessage}\n\n📞 **Call:** ${businessData.phone || 'Contact us'}`;
          
        } catch (error) {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_book_error', { error: String(error) });
          return `📅 **Appointment confirmed**\n\nOur salon will contact you shortly\n📞 **Salon:** ${businessData.phone || 'Contact us'}`;
        }
      },
      quickReplies: [
        { title: '📞 Call salon', next: 'LOCATION', payload: { callback_requested: true } },
        { title: '❓ Have questions', next: 'QUESTION' },
        { title: '✅ All set', next: 'END', payload: { booking_completed: true } }
      ],
      isBookingState: true,
      followUpAfterHours: 12
    },

    LOCATION: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'viewed_location');
        
        const authority = getAuthorityMessage(businessData, config);
        const callbackMessage = conversationData?.payload?.callback_requested ?
          '📞 **Salon calling within 2 hours**\n\n' : '';
        
        return `${callbackMessage}📍 **Salon Location**\n${businessData.location || 'Central location with easy access'}\n${authority}\n\n⏰ **Opening Hours:**\n${businessData.hours || 'Mon-Sat: 9am-6pm'}\n\n📞 **Salon Reception:**\n${businessData.phone || 'Contact us'}`;
      },
      quickReplies: [
        { title: '📅 Book appointment', next: 'SERVICE_SELECT' },
        { title: '💰 View pricing', next: 'PRICES' },
        { title: '❓ Ask question', next: 'QUESTION' }
      ]
    },

    QUESTION: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'started_questions');
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `💬 **Beauty Expertise**\n${authority}\n\nWhat questions do you have about our treatments?\n💄 Our specialists are here to help`;
      },
      quickReplies: [
        { title: '💰 Treatment pricing', next: 'PRICES' },
        { title: '📅 Check availability', next: 'SERVICE_SELECT' },
        { title: '📍 Salon location', next: 'LOCATION' }
      ]
    },

    FOLLOW_UP: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        const followUpCount = conversationData?.leadData?.followUpCount || 0;
        const businessName = businessData.business_name || 'Beauty Salon';
        const serviceType = conversationData?.payload?.service_type;
        const urgency = conversationData?.payload?.urgency;
        
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'follow_up_sent', { serviceType, urgency, followUpCount });
        
        if (followUpCount === 0) {
          return `💄 **Still planning your beauty appointment?**\n\n${businessName} - Expert stylists available\nLimited slots this week\n\n📅 Secure your preferred time`;
        } else {
          return `✨ **New availability this week!**\n\n${businessName} - Premium beauty treatments\nBook now to avoid disappointment\n\n💅 Ready to look amazing?`;
        }
      },
      quickReplies: [
        { title: '📅 Yes, book now', next: 'SERVICE_SELECT' },
        { title: '❓ Have questions', next: 'QUESTION' },
        { title: '✅ Not interested', next: 'END', payload: { resolved: true } }
      ],
      followUpAfterHours: 24
    },

    END: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'conversation_ended');
        
        const bookingCompleted = conversationData?.payload?.booking_completed;
        const resolved = conversationData?.payload?.resolved;
        const businessName = businessData.business_name || 'Beauty Salon';
        const authority = getAuthorityMessage(businessData, config);
        
        if (bookingCompleted) {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_appointment_booked');
          return `💄 **Appointment confirmed with ${businessName}**\n${authority}\n\nOur team will contact you shortly\n📞 **Salon:** ${businessData.phone || 'Call us'}\n\n✨ Can't wait to see you!`;
        }
        
        if (resolved === true) {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'beauty_issue_resolved', {
            retention_candidate: true
          });
        }
        
        return `💄 **${businessName} - Always Here**\n${authority}\n\n📞 **Appointment Booking:** ${businessData.phone || 'Call us'}\n\n✨ When you're ready to look amazing`;
      },
      quickReplies: [
        { title: '📅 Actually, book now!', next: 'SERVICE_SELECT' },
        { title: '📍 Salon details', next: 'LOCATION' },
        { title: '❓ Ask question', next: 'QUESTION' }
      ]
    }
  };
}

// ===== DEFAULT CONFIGURATION =====

/**
 * Default tenant configuration for beauty flow
 */
export const defaultBeautyConfig: BeautyTenantConfig = {
  // Feature flags
  show_scarcity: true,
  enable_deposit: true,
  enable_photo_upload: true,
  
  // Revenue optimization (disabled by default for backward compatibility)
  require_deposit_for_booking: false,
  deposit_amount_fixed: undefined,
  auto_release_slot_minutes: 30,
  hot_lead_escalation_minutes: 60,
  
  // Scoring weights (configurable per tenant)
  scoring_weights: {
    service_value: 25,        // hair, bridal services
    same_day_interest: 30,    // ASAP bookings
    verified_phone: 20,       // phone validation
    deposit_intent: 15        // willingness to pay deposit
  },
  
  // ETA rules by priority
  eta_rules: {
    ASAP: '2-4 hours',
    THIS_WEEK: '24-48 hours',
    STANDARD: '3-7 days'
  },
  
  // Authority messaging fallback
  authority_fallback: '💄 Premium Beauty & Wellness Salon'
};

/**
 * Creates a beauty flow with default configuration
 * Convenience function for quick tenant setup
 */
export function createDefaultBeautyFlow(
  adapters: BeautyAdapters,
  configOverrides?: Partial<BeautyTenantConfig>
): ConversationFlow {
  const config = { ...defaultBeautyConfig, ...configOverrides };
  return createBeautyFlow(config, adapters);
}

/**
 * Default beauty flow instance for backward compatibility
 * @deprecated Use createBeautyFlow or createDefaultBeautyFlow instead
 */
export const beautyFlow = createDefaultBeautyFlow({
  // Stub adapters for backward compatibility
  saveLead: async () => {},
  computeScore: () => 0,
  isHot: () => false,
  notifyOwner: async () => {},
  generateBookingLink: async () => '',
  generateDepositLink: async () => '',
  scheduleSlotRelease: async () => {},
  scheduleEscalation: async () => {},
  sendPhoneReminder: async () => {},
  validateUrl: () => false,
  metrics: {
    trackEvent: async () => {}
  }
});