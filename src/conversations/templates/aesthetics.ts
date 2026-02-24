import { ConversationFlow, BusinessData, ConversationData } from '../types.js';

// ===== TYPES =====

export interface AestheticsTenantConfig {
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
  
  // Scoring configuration
  scoring_weights: {
    high_value_service: number; // fillers, laser
    same_day_interest: number;
    verified_phone: number;
    deposit_intent: number;
    visual_assessment: number;
    revenue_potential: number;
  };
  
  // ETA rules by priority
  eta_rules: {
    CRITICAL: string;
    HIGH: string;
    STANDARD: string;
    MANUAL_REVIEW: string;
  };
  
  // Authority messaging
  authority_fallback: string;
}

export interface AestheticsLeadData {
  service_type: string;
  urgency: string;
  medical_risk_flag: boolean;
  dispatch_priority: string;
  service_tier: 'aesthetics';
  phone: string;
  timestamp: string;
  
  // Screening data
  age_confirmed: boolean;
  medical_conditions: boolean;
  pregnant_or_breastfeeding: boolean;
  previous_treatments: boolean;
  
  // Compliance data
  gdpr_consent: boolean;
  marketing_opt_in: boolean;
  medical_disclaimer_acknowledged: boolean;
  photo_uploaded: boolean;
  
  // Scoring flags
  high_value_job?: boolean;
  verified_phone?: boolean;
  same_day_interest?: boolean;
  deposit_intent?: boolean;
  visual_assessment_ready?: boolean;
  revenue_potential_score_flag?: boolean;
  compliance_risk_flag?: boolean;
  
  // Deposit state
  deposit_required?: boolean;
  deposit_status?: 'pending' | 'paid' | 'failed';
  deposit_link_provided?: boolean;
  
  // Metadata
  urgency_weight: 'high' | 'medium' | 'low';
  owner_notification_priority: 'sms' | 'push' | 'email';
  score?: number;
}

export interface AestheticsPayload {
  service_type?: string;
  urgency?: string;
  same_day_interest?: boolean;
  medical_risk_flag?: boolean;
  age_confirmed?: boolean;
  medical_conditions?: boolean;
  pregnant_or_breastfeeding?: boolean;
  previous_treatments?: boolean;
  gdpr_consent?: boolean;
  marketing_opt_in?: boolean;
  medical_disclaimer_acknowledged?: boolean;
  photo_uploaded?: boolean;
  visual_assessment_ready?: boolean;
  deposit_intent?: boolean;
  phone?: string;
  phone_invalid?: boolean;
  awaiting_phone?: boolean;
  callback_requested?: boolean;
  needs_support?: boolean;
  booking_completed?: boolean;
  resolved?: boolean;
}

export interface AestheticsAdapters {
  // Lead management
  saveLead: (tenantId: string, leadData: AestheticsLeadData & { score: number }) => Promise<void>;
  
  // Scoring
  computeScore: (leadData: AestheticsLeadData) => number;
  isHot: (score: number, threshold?: number) => boolean;
  
  // Notifications
  notifyOwner: (tenantId: string, leadData: AestheticsLeadData, score: number, phone?: string) => Promise<void>;
  enqueueManualReview: (tenantId: string, leadData: AestheticsLeadData, score: number) => Promise<void>;
  
  // Booking & payments
  generateCalendlyLink: (tenantId: string, options: { service: string }) => Promise<string>;
  generateDepositLink: (tenantId: string, leadData: AestheticsLeadData) => Promise<string>;
  
  // Utilities
  validateUrl: (url: string) => boolean;
  
  // Metrics & analytics
  metrics: {
    trackEvent: (tenantId: string, event: string, data?: Record<string, unknown>) => Promise<void>;
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * Dynamic ETA calculator using tenant configuration
 */
function calculateETA(
  dispatchPriority: string,
  medicalRiskFlag: boolean,
  urgency: string,
  config: AestheticsTenantConfig
): string {
  // Medical risk cases require manual review - never CRITICAL/HIGH ETA
  if (medicalRiskFlag || dispatchPriority === 'MANUAL_REVIEW') {
    return config.eta_rules.MANUAL_REVIEW;
  }
  
  if (dispatchPriority === 'CRITICAL') {
    return config.eta_rules.CRITICAL;
  }
  
  if (dispatchPriority === 'HIGH') {
    return config.eta_rules.HIGH;
  }
  
  // STANDARD priority with urgency consideration
  if (urgency === 'this_week') {
    return config.eta_rules.STANDARD;
  }
  
  return '5–10 days'; // Default fallback
}

/**
 * Authority and social proof messaging using tenant data
 */
function getAuthorityMessage(businessData: BusinessData, config: AestheticsTenantConfig): string {
  if (config.rating && config.reviews_count) {
    return `⭐ ${config.rating}/5 (${config.reviews_count} reviews)`;
  }
  
  if (businessData.rating && businessData.reviews_count) {
    return `⭐ ${businessData.rating}/5 (${businessData.reviews_count} reviews)`;
  }
  
  return config.authority_fallback;
}

/**
 * Calculate dispatch priority for aesthetic treatments
 */
function getDispatchPriority(serviceType?: string, sameDayInterest?: boolean): string {
  if (sameDayInterest) return 'CRITICAL';
  if (serviceType === 'fillers' || serviceType === 'laser') return 'HIGH';
  return 'STANDARD';
}

/**
 * Create enhanced lead data with safe conditional spreads
 */
function createLeadData(
  conversationData: ConversationData | undefined,
  dispatchPriority: string,
  config: AestheticsTenantConfig
): AestheticsLeadData {
  const serviceType = conversationData?.payload?.service_type || 'consult';
  const urgency = conversationData?.payload?.urgency || 'researching';
  const medicalRisk = conversationData?.payload?.medical_risk_flag || false;
  const depositIntent = conversationData?.payload?.deposit_intent || false;
  const sameDayInterest = conversationData?.payload?.same_day_interest || false;
  const isFillers = serviceType === 'fillers';
  const isLaser = serviceType === 'laser';
  const verifiedPhone = conversationData?.payload?.phone && !conversationData?.payload?.phone_invalid;
  const photoUploaded = conversationData?.payload?.photo_uploaded || false;
  const visualAssessmentReady = conversationData?.payload?.visual_assessment_ready || false;
  const gdprConsent = conversationData?.payload?.gdpr_consent || false;
  const medicalDisclaimerAck = conversationData?.payload?.medical_disclaimer_acknowledged || false;
  const ageConfirmed = conversationData?.payload?.age_confirmed || false;
  
  return {
    service_type: serviceType,
    urgency: urgency,
    medical_risk_flag: medicalRisk,
    dispatch_priority: dispatchPriority,
    service_tier: 'aesthetics',
    phone: conversationData?.payload?.phone || 'not_provided',
    timestamp: new Date().toISOString(),
    
    // Screening data
    age_confirmed: ageConfirmed,
    medical_conditions: conversationData?.payload?.medical_conditions || false,
    pregnant_or_breastfeeding: conversationData?.payload?.pregnant_or_breastfeeding || false,
    previous_treatments: conversationData?.payload?.previous_treatments || false,
    
    // Compliance data
    gdpr_consent: gdprConsent,
    marketing_opt_in: conversationData?.payload?.marketing_opt_in || false,
    medical_disclaimer_acknowledged: medicalDisclaimerAck,
    photo_uploaded: photoUploaded,
    
    // Enhanced scoring flags with safe ternary spread syntax
    ...(isFillers ? { high_value_job: true } : {}),
    ...(isLaser ? { high_value_job: true } : {}),
    ...(verifiedPhone ? { verified_phone: true } : {}),
    ...(sameDayInterest && !medicalRisk ? { same_day_interest: true } : {}),
    ...(depositIntent ? { deposit_intent: true } : {}),
    ...(medicalRisk ? { medical_risk_flag: true } : {}),
    ...(visualAssessmentReady ? { visual_assessment_ready: true } : {}),
    
    // Separate scoring dimensions
    ...((isFillers || isLaser) ? { revenue_potential_score_flag: true } : {}),
    ...(medicalRisk ? { compliance_risk_flag: true } : {}),
    
    // Metadata
    urgency_weight: sameDayInterest ? 'high' : (urgency === 'this_week' ? 'medium' : 'low'),
    owner_notification_priority: dispatchPriority === 'CRITICAL' ? 'sms' : 
                               dispatchPriority === 'HIGH' ? 'push' : 'email',
    
    // Deposit state persistence
    ...(depositIntent && config.enable_deposit && config.deposit_link ? {
      deposit_required: true,
      deposit_status: 'pending' as const,
      deposit_link_provided: true
    } : {})
  };
}

// ===== FACTORY FUNCTION =====

/**
 * Creates a tenant-specific aesthetics conversation flow
 */
export function createAestheticsFlow(
  config: AestheticsTenantConfig,
  adapters: AestheticsAdapters
): ConversationFlow {
  return {
    START: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'conversation_started');
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_stage_reached', { stage: 'START' });
        
        const businessName = businessData.business_name || 'Premier Aesthetics Clinic';
        const authority = getAuthorityMessage(businessData, config);
        
        return `💎 **${businessName}**\n${authority}\n\n🏥 **Medical-grade aesthetic treatments by qualified practitioners**\n\nWhich treatment interests you?`;
      },
      quickReplies: [
        { title: '💉 Botox', next: 'SERVICE_SELECT', payload: { service_type: 'botox' } },
        { title: '💎 Dermal Fillers', next: 'SERVICE_SELECT', payload: { service_type: 'fillers' } },
        { title: '✨ Laser Treatment', next: 'SERVICE_SELECT', payload: { service_type: 'laser' } },
        { title: '📅 Book Consultation', next: 'SERVICE_SELECT', payload: { service_type: 'consult' } },
        { title: '💬 Ask Question', next: 'QUESTION' }
      ],
      followUpAfterHours: 8
    },

    QUALIFY: {
      message: async (businessData: BusinessData): Promise<string> => {
        const authority = getAuthorityMessage(businessData, config);
        
        return `💎 **Treatment Selection**\n${authority}\n\nWhich aesthetic treatment are you interested in?\n🏥 Professional consultation required for all treatments`;
      },
      quickReplies: [
        { title: '💉 Anti-wrinkle (Botox)', next: 'SERVICE_SELECT', payload: { service_type: 'botox' } },
        { title: '💎 Dermal Fillers', next: 'SERVICE_SELECT', payload: { service_type: 'fillers' } },
        { title: '✨ Laser Treatment', next: 'SERVICE_SELECT', payload: { service_type: 'laser' } },
        { title: '📅 General Consultation', next: 'SERVICE_SELECT', payload: { service_type: 'consult' } }
      ],
      isQualifying: true,
      qualificationField: 'service_type'
    },

    SERVICE_SELECT: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        const serviceType = conversationData?.payload?.service_type;
        
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'service_selected', { service_type: serviceType });
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_stage_reached', { stage: 'SERVICE_SELECT' });
        
        const serviceLabels = {
          'botox': 'Anti-wrinkle injections (Botox)',
          'fillers': 'Dermal Filler Treatment', 
          'laser': 'Laser Skin Treatment',
          'consult': 'Aesthetic Consultation'
        };
        
        const serviceName = serviceLabels[serviceType as keyof typeof serviceLabels] || 'Aesthetic Treatment';
        const authority = getAuthorityMessage(businessData, config);
        
        return `💎 **${serviceName}**\n${authority}\n\n🏥 **Medical assessment required before all treatments**\n\nLet's complete a brief medical screening`;
      },
      quickReplies: [
        { title: '📋 Start screening', next: 'MEDICAL_PRESCREEN' },
        { title: '💰 View pricing first', next: 'PRICES' },
        { title: '❓ Ask questions', next: 'QUESTION' }
      ],
      isQualifying: true,
      qualificationField: 'service_type'
    },

    MEDICAL_PRESCREEN: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'medical_prescreen_started');
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_stage_reached', { stage: 'MEDICAL_PRESCREEN' });
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `📋 **Medical Pre-Screening**\n${authority}\n\n🏥 **Required for all aesthetic treatments**\n• Ensures your safety and treatment suitability\n• Completed by qualified medical practitioners\n\nAre you 18 years of age or older?`;
      },
      quickReplies: [
        { title: '✅ Yes, I am 18+', next: 'MEDICAL_CONDITIONS', payload: { age_confirmed: true } },
        { title: '❌ Under 18', next: 'AGE_RESTRICTION', payload: { age_confirmed: false } }
      ],
      isQualifying: true,
      qualificationField: 'age_confirmed'
    },

    MEDICAL_CONDITIONS: {
      message: async (_businessData: BusinessData): Promise<string> => {
        return `📋 **Medical History**\n\n🏥 **Do you have any of the following:**\n• Autoimmune conditions\n• Blood clotting disorders\n• Active skin infections\n• Taking blood-thinning medication\n\nAny relevant medical conditions?`;
      },
      quickReplies: [
        { title: '✅ Yes, I have conditions', next: 'PREGNANCY_CHECK', payload: { medical_conditions: true, medical_risk_flag: true } },
        { title: '❌ No medical conditions', next: 'PREGNANCY_CHECK', payload: { medical_conditions: false } }
      ],
      isQualifying: true,
      qualificationField: 'medical_conditions'
    },

    PREGNANCY_CHECK: {
      message: async (_businessData: BusinessData): Promise<string> => {
        return `📋 **Safety Assessment**\n\n🤱 **Are you currently:**\n• Pregnant\n• Breastfeeding\n• Trying to conceive\n\nThis affects treatment suitability`;
      },
      quickReplies: [
        { title: '✅ Yes', next: 'PREGNANCY_RESTRICTION', payload: { pregnant_or_breastfeeding: true } },
        { title: '❌ No', next: 'PREVIOUS_TREATMENTS', payload: { pregnant_or_breastfeeding: false } }
      ],
      isQualifying: true,
      qualificationField: 'pregnant_or_breastfeeding'
    },

    PREVIOUS_TREATMENTS: {
      message: async (_businessData: BusinessData): Promise<string> => {
        return `📋 **Treatment History**\n\n💉 **Have you had aesthetic treatments before?**\n• Botox or anti-wrinkle injections\n• Dermal fillers\n• Laser treatments\n• Chemical peels\n\nPrevious experience helps us plan your treatment`;
      },
      quickReplies: [
        { title: '✅ Yes, previous treatments', next: 'SCREENING_COMPLETE', payload: { previous_treatments: true } },
        { title: '❌ No, first time', next: 'SCREENING_COMPLETE', payload: { previous_treatments: false } }
      ],
      isQualifying: true,
      qualificationField: 'previous_treatments'
    },

    SCREENING_COMPLETE: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'medical_prescreen_completed');
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `✅ **Medical Pre-Screening Complete**\n${authority}\n\n🏥 **Preliminary assessment passed**\n• Full consultation required before treatment\n• Qualified practitioner will review your suitability\n\nHow urgently do you want to book?`;
      },
      quickReplies: [
        { title: '⚡ This week', next: 'QUALIFY_URGENCY', payload: { urgency: 'this_week', same_day_interest: true } },
        { title: '📅 Next 2 weeks', next: 'QUALIFY_URGENCY', payload: { urgency: 'next_2_weeks' } },
        { title: '🔍 Just researching', next: 'QUALIFY_URGENCY', payload: { urgency: 'researching' } }
      ]
    },

    QUALIFY_URGENCY: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        const urgency = conversationData?.payload?.urgency;
        
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'urgency_selected', { urgency });
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `📅 **Appointment Scheduling**\n${authority}\n\n⏰ **Priority booking available for qualified clients**\n\nProvide your mobile number for appointment confirmation`;
      },
      quickReplies: [
        { title: '📞 Provide mobile', next: 'REQUEST_PHONE' }
      ],
      isQualifying: true,
      qualificationField: 'urgency'
    },

    REQUEST_PHONE: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        const businessName = businessData.business_name || 'our clinic';
        const invalidPhone = conversationData?.payload?.phone_invalid;
        const urgency = conversationData?.payload?.urgency;
        const serviceType = conversationData?.payload?.service_type;
        const medicalRisk = conversationData?.payload?.medical_risk_flag;
        const authority = getAuthorityMessage(businessData, config);
        const validPhone = conversationData?.payload?.phone && !invalidPhone;
        
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'phone_requested');
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_stage_reached', { stage: 'REQUEST_PHONE' });
        
        // Track explicit phone capture and prepare for auto-transition when valid phone is provided
        if (validPhone) {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_phone_captured', {
            service_type: serviceType,
            urgency: urgency,
            medical_risk_flag: medicalRisk
          });
          // Phone validated - engine will auto-advance to CONSENT_STATE via phoneValidation config
        }
        
        if (invalidPhone) {
          return `❌ **Invalid phone format**\n\n📞 **Please provide a valid mobile number:**\n• Format: +447912345678\n• Or: 07912345678\n\n⏰ Your consultation slot is held for 30 minutes`;
        }
        
        return `📞 **Appointment Confirmation**\n${authority}\n\n💎 **${businessName}** - Expert aesthetic practitioners\n⏰ **Consultation slot held for 30 minutes**\n\n📱 **Mobile required for:**\n• Appointment confirmation\n• Pre-treatment instructions\n• Aftercare guidance\n\n📞 **Format:** +447912345678 or 07912345678`;
      },
      quickReplies: [
        { title: '📞 Provide mobile number', next: 'REQUEST_PHONE', payload: { awaiting_phone: true } }
      ],
      isQualifying: true,
      qualificationField: 'phone',
      phoneValidation: true,
      followUpAfterHours: 2
    },

    CONSENT_STATE: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_stage_reached', { stage: 'CONSENT_STATE' });
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `📋 **Consent & Data Protection**\n${authority}\n\n🏥 **UK Medical Regulations Require:**\n• GDPR data processing consent\n• Medical disclaimer acknowledgment\n• Optional marketing communications\n\n✅ **Do you consent to data processing for your aesthetic treatment?**`;
      },
      quickReplies: [
        { title: '✅ Yes, I consent', next: 'GDPR_MARKETING', payload: { gdpr_consent: true } },
        { title: '❌ No consent', next: 'GDPR_DECLINE', payload: { gdpr_consent: false } }
      ],
      isQualifying: true,
      qualificationField: 'gdpr_consent'
    },

    GDPR_MARKETING: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'gdpr_consent_captured');
        
        return `📧 **Marketing Communications (Optional)**\n\n💎 **Would you like to receive:**\n• Treatment updates and offers\n• New service announcements\n• Skincare tips and advice\n\n📱 **You can unsubscribe anytime**`;
      },
      quickReplies: [
        { title: '✅ Yes, marketing updates', next: 'MEDICAL_DISCLAIMER', payload: { marketing_opt_in: true } },
        { title: '❌ No marketing', next: 'MEDICAL_DISCLAIMER', payload: { marketing_opt_in: false } }
      ]
    },

    MEDICAL_DISCLAIMER: {
      message: async (businessData: BusinessData): Promise<string> => {
        const authority = getAuthorityMessage(businessData, config);
        
        return `⚕️ **Medical Disclaimer**\n${authority}\n\n🏥 **Important Medical Information:**\n• Treatments involve medical procedures with potential risks\n• Individual results may vary\n• Full consultation required before any treatment\n• Qualified practitioner will assess your suitability\n\n✅ **I acknowledge this medical disclaimer**`;
      },
      quickReplies: [
        { title: '✅ Acknowledged', next: config.enable_photo_upload ? 'PHOTO_UPLOAD_OPTION' : 'DEPOSIT_OPTION', payload: { medical_disclaimer_acknowledged: true } }
      ],
      isQualifying: true,
      qualificationField: 'medical_disclaimer_acknowledged'
    },

    GDPR_DECLINE: {
      message: async (businessData: BusinessData): Promise<string> => {
        const authority = getAuthorityMessage(businessData, config);
        
        return `🚫 **Data Processing Required**\n${authority}\n\n🏥 **UK medical regulations require data processing consent for aesthetic treatments**\n\nWe cannot proceed without this consent as it's legally required for:\n• Medical record keeping\n• Treatment safety protocols\n• Post-treatment care\n\n📞 **Contact us directly if you have concerns**`;
      },
      quickReplies: [
        { title: '📞 Call clinic', next: 'LOCATION' },
        { title: '❓ Ask questions', next: 'QUESTION' },
        { title: '✅ Understood', next: 'END' }
      ]
    },

    ...(config.enable_photo_upload ? {
      PHOTO_UPLOAD_OPTION: {
        message: async (businessData: BusinessData): Promise<string> => {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'medical_disclaimer_acknowledged');
          
          const authority = getAuthorityMessage(businessData, config);
          
          return `📸 **Pre-Assessment Photo (Optional)**\n${authority}\n\n💎 **Benefits of photo upload:**\n• Practitioner can prepare for your consultation\n• More accurate treatment recommendations\n• Potentially shorter consultation time\n\n🔒 **All photos stored securely and confidentially**`;
        },
        quickReplies: [
          { title: '📸 Upload photo', next: 'DEPOSIT_OPTION', payload: { photo_uploaded: true, visual_assessment_ready: true } },
          { title: '⏭️ Skip photo', next: 'DEPOSIT_OPTION', payload: { photo_uploaded: false } }
        ]
      }
    } : {}),

    DEPOSIT_OPTION: {
      message: async (businessData: BusinessData): Promise<string> => {
        const authority = getAuthorityMessage(businessData, config);
        const hasDepositLink = config.enable_deposit && (config.deposit_link || businessData.deposit_link) && 
          adapters.validateUrl(config.deposit_link || businessData.deposit_link || '');
        
        if (hasDepositLink) {
          return `💳 **Secure Your Appointment**\n${authority}\n\n💎 **Optional deposit available:**\n• Guarantees your preferred time slot\n• Fully refundable if cancelled 24hrs+ notice\n• Applied toward your treatment cost\n\nWould you like to secure with a deposit?`;
        }
        
        return `📅 **Appointment Secured**\n${authority}\n\n✅ **Your consultation is confirmed**\nNo deposit required - we'll confirm via phone\n\nReady to finalize your booking?`;
      },
      quickReplies: [
        ...(config.enable_deposit ? [
          { title: '💳 Yes, pay deposit', next: 'BOOK', payload: { deposit_intent: true } }
        ] : []),
        { title: '📞 Book without deposit', next: 'BOOK', payload: { deposit_intent: false } },
        { title: '❓ Ask about deposits', next: 'QUESTION' }
      ]
    },

    BOOK: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        try {
          const alreadyBooked = conversationData?.leadData?.alreadyBooked || false;
          
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_stage_reached', { stage: 'BOOK' });
          
          // Extract validation data
          const gdprConsent = conversationData?.payload?.gdpr_consent || false;
          const medicalDisclaimerAck = conversationData?.payload?.medical_disclaimer_acknowledged || false;
          const ageConfirmed = conversationData?.payload?.age_confirmed || false;
          const verifiedPhone = conversationData?.payload?.phone && !conversationData?.payload?.phone_invalid;
          
          // HARD GDPR COMPLIANCE GATE - Non-bypassable validation before any processing
          if (!gdprConsent || !medicalDisclaimerAck || !ageConfirmed || !verifiedPhone) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_compliance_blocked', {
              gdpr_consent: gdprConsent,
              medical_disclaimer: medicalDisclaimerAck,
              age_confirmed: ageConfirmed,
              verified_phone: verifiedPhone
            });
            
            return `🚫 **Compliance Requirements Not Met**\n\n🏥 **UK medical regulations require:**\n• GDPR data processing consent\n• Medical disclaimer acknowledgment\n• Age confirmation (18+)\n• Verified mobile number\n\nPlease complete the required consent steps to proceed.`;
          }
          
          // DUPLICATE ATTEMPT GUARD
          if (alreadyBooked) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_duplicate_attempt');
            return `📅 **Consultation Already Booked**\n\nYou already have a consultation booked.\n📞 **Contact clinic if changes are needed:** ${businessData.phone || 'Call us'}`;
          }
          
          // Calculate dispatch priority
          const serviceType = conversationData?.payload?.service_type || 'consult';
          const sameDayInterest = conversationData?.payload?.same_day_interest || false;
          const medicalRisk = conversationData?.payload?.medical_risk_flag || false;
          
          let dispatchPriority = getDispatchPriority(serviceType, sameDayInterest);
          if (medicalRisk) {
            dispatchPriority = 'MANUAL_REVIEW'; // Force medical risk cases to manual review
          }
          
          // Create enhanced lead data
          const leadData = createLeadData(conversationData, dispatchPriority, config);
          
          // MEDICAL RISK MANUAL REVIEW MODE - Skip automated booking for medical risk cases
          if (medicalRisk) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_manual_review_required', {
              service_type: serviceType,
              medical_conditions: conversationData?.payload?.medical_conditions,
              manual_review_priority: 'MANUAL_REVIEW'
            });
            
            // Preserve analytics consistency - compute score before saveLead
            const score = adapters.computeScore(leadData);
            
            // Save lead with score and enqueue for manual review
            await adapters.saveLead(businessData.id || 'unknown', { ...leadData, score });
            await adapters.enqueueManualReview(businessData.id || 'unknown', leadData, score);
            
            // Track lead scoring for manual review cases
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_lead_scored', {
              service_type: serviceType,
              urgency: leadData.urgency,
              medical_risk_flag: medicalRisk,
              dispatch_priority: 'MANUAL_REVIEW',
              score: score,
              hot: false // Manual review cases bypass hot lead detection
            });
            
            return `🏥 **Clinician Review Required**\n\n**Medical assessment needed before scheduling**\nOur medical team will contact you within 24 hours to discuss your treatment suitability.\n\n📞 **Urgent enquiries:** ${businessData.phone || 'Contact clinic'}`;
          }
          
          // Standard booking flow
          const score = adapters.computeScore(leadData);
          const hotLead = adapters.isHot(score);
          
          await adapters.saveLead(businessData.id || 'unknown', { ...leadData, score });
          
          // Enhanced lead intelligence tracking
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_lead_scored', {
            service_type: serviceType,
            urgency: leadData.urgency,
            medical_risk_flag: medicalRisk,
            dispatch_priority: dispatchPriority,
            score: score,
            hot: hotLead,
            revenue_potential: leadData.revenue_potential_score_flag || false,
            urgency_weight: leadData.urgency_weight
          });
          
          // Track deposit initiation if applicable
          if (leadData.deposit_intent && config.enable_deposit) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_deposit_initiated', {
              deposit_status: 'pending',
              deposit_link_provided: true
            });
          }
          
          // Priority-based owner routing
          if (hotLead) {
            await adapters.notifyOwner(
              businessData.id || 'unknown',
              leadData,
              score,
              leadData.phone !== 'not_provided' ? leadData.phone : undefined
            );
          }
          
          const serviceLabels: { [key: string]: string } = {
            'botox': 'Anti-wrinkle Treatment',
            'fillers': 'Dermal Filler Consultation',
            'laser': 'Laser Treatment Consultation',
            'consult': 'Aesthetic Consultation'
          };
          
          const serviceLabel = serviceLabels[serviceType] || 'Aesthetic Consultation';
          
          // Priority-based status messaging
          let statusMessage;
          if (dispatchPriority === 'CRITICAL' || score > 90) {
            statusMessage = '⚡ **Priority Consultation Booking**';
          } else if (dispatchPriority === 'HIGH' || score > 80) {
            statusMessage = '💎 **Premium Treatment Consultation**';
          } else {
            statusMessage = '📅 **Consultation Appointment Confirmed**';
          }
          
          // Configurable scarcity logic
          const safeSlots = Math.max(0, ((config.available_slots || businessData.available_slots) || 0) - 1);
          const showScarcity = config.show_scarcity && (dispatchPriority === 'CRITICAL' || dispatchPriority === 'HIGH');
          const scarcityText = showScarcity && safeSlots > 0
            ? `⚡ ${safeSlots} priority slots remaining this week`
            : showScarcity
              ? '⚡ Limited priority availability'
              : '';
          
          // Dynamic ETA calculation
          const eta = calculateETA(dispatchPriority, medicalRisk, leadData.urgency, config);
          const etaMessage = `\n📅 **Consultation availability: ${eta}**`;
          
          // Deposit confirmation message
          const depositMessage = leadData.deposit_intent && config.enable_deposit
            ? '\n💳 **Deposit option available after booking**'
            : '';
          
          // Booking fallback chain: booking_link → generateCalendlyLink → phone
          const bookingUrl = config.booking_link || businessData.booking_link;
          const hasValidBooking = bookingUrl && adapters.validateUrl(bookingUrl);
          
          if (hasValidBooking) {
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'booking_link_provided');
            return `${statusMessage}${scarcityText ? ' | ' + scarcityText : ''}\n${serviceLabel} confirmed${depositMessage}${etaMessage}\n\n👆 **Book:** ${bookingUrl}`;
          }
          
          // Calendly fallback
          const service = sameDayInterest && !medicalRisk ? 'priority-aesthetics-consult' : 'aesthetics-consultation';
          try {
            const calendlyLink = await adapters.generateCalendlyLink(businessData.id || 'unknown', { service });
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'calendly_link_provided');
            return `${statusMessage}${scarcityText ? ' | ' + scarcityText : ''}\n${serviceLabel} confirmed${depositMessage}${etaMessage}\n\n📅 **Book:** ${calendlyLink}`;
          } catch (calendlyError) {
            // Log error via metrics (no direct logger access)
            await adapters.metrics.trackEvent(businessData.id || 'unknown', 'calendly_generation_failed', { error: String(calendlyError) });
          }
          
          // Phone fallback
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'phone_fallback_used');
          return `${statusMessage}${scarcityText ? ' | ' + scarcityText : ''}\n${serviceLabel} confirmed${depositMessage}${etaMessage}\n\n📞 **Call:** ${businessData.phone || 'Contact us'}`;
          
        } catch (error) {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_book_error', { error: String(error) });
          return `📅 **Consultation confirmed**\n\nOur clinic will contact you shortly\n📞 **Clinic:** ${businessData.phone || 'Contact us'}`;
        }
      },
      quickReplies: [
        { title: '📞 Call clinic', next: 'LOCATION', payload: { callback_requested: true } },
        { title: '❓ Have questions', next: 'QUESTION', payload: { needs_support: true } },
        { title: '✅ All set', next: 'END', payload: { booking_completed: true } }
      ],
      isBookingState: true,
      followUpAfterHours: 8
    },

    AGE_RESTRICTION: {
      message: async (businessData: BusinessData): Promise<string> => {
        const authority = getAuthorityMessage(businessData, config);
        
        return `🚫 **Age Restriction Policy**\n${authority}\n\n🏥 **Medical regulations require clients to be 18+ for aesthetic treatments**\n\nWe appreciate your interest and invite you to return when you meet the age requirement.\n\n📚 **Educational resources about skincare available on our website**`;
      },
      quickReplies: [
        { title: '📚 Skincare advice', next: 'QUESTION' },
        { title: '📍 Clinic location', next: 'LOCATION' },
        { title: '👋 Understood', next: 'END' }
      ]
    },

    PREGNANCY_RESTRICTION: {
      message: async (businessData: BusinessData): Promise<string> => {
        const authority = getAuthorityMessage(businessData, config);
        
        return `🤱 **Treatment Safety Advisory**\n${authority}\n\n🏥 **For your safety, aesthetic treatments are not recommended during pregnancy or breastfeeding**\n\nWe'd be happy to schedule your consultation for after this period.\n\n📞 **Please contact us when you're ready to proceed safely**`;
      },
      quickReplies: [
        { title: '📅 Future booking', next: 'QUESTION' },
        { title: '📞 Call clinic', next: 'LOCATION' },
        { title: '✅ Understood', next: 'END' }
      ]
    },

    PRICES: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'viewed_pricing');
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `💰 **Treatment Investment**\n${authority}\n\n🏥 **Medical-grade treatments by qualified practitioners**\n• Consultation required for accurate pricing\n• Bespoke treatment plans\n• Flexible payment options available\n\n💎 **Quality and safety are our priority**`;
      },
      quickReplies: [
        { title: '📅 Book consultation', next: 'SERVICE_SELECT' },
        { title: '📍 Clinic location', next: 'LOCATION' },
        { title: '❓ Pricing questions', next: 'QUESTION' }
      ]
    },

    LOCATION: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'viewed_location');
        
        const authority = getAuthorityMessage(businessData, config);
        const callbackMessage = conversationData?.payload?.callback_requested ?
          '📞 **Clinic calling within 2 hours**\n\n' : '';
        
        return `${callbackMessage}📍 **Clinic Location**\n${businessData.location || 'Central location with easy access'}\n${authority}\n\n⏰ **Consultation Hours:**\n${businessData.hours || 'Mon-Sat: 9am-6pm'}\n\n📞 **Clinic Reception:**\n${businessData.phone || 'Contact us'}`;
      },
      quickReplies: [
        { title: '📅 Book consultation', next: 'SERVICE_SELECT' },
        { title: '💰 View pricing', next: 'PRICES' },
        { title: '❓ Ask question', next: 'QUESTION' }
      ]
    },

    QUESTION: {
      message: async (businessData: BusinessData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'started_questions');
        
        const authority = getAuthorityMessage(businessData, config);
        
        return `💬 **Expert Aesthetic Guidance**\n${authority}\n\nWhat questions do you have about our treatments?\n🏥 Our qualified practitioners provide detailed consultations`;
      },
      quickReplies: [
        { title: '💰 Treatment pricing', next: 'PRICES' },
        { title: '📅 Book consultation', next: 'SERVICE_SELECT' },
        { title: '📍 Clinic location', next: 'LOCATION' }
      ]
    },

    FOLLOW_UP: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        const followUpCount = conversationData?.leadData?.followUpCount || 0;
        const businessName = businessData.business_name || 'Premier Aesthetics';
        const serviceType = conversationData?.payload?.service_type;
        const urgency = conversationData?.payload?.urgency;
        
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'follow_up_sent', { serviceType, urgency, followUpCount });
        
        // Service-specific follow-up messaging
        if (serviceType === 'fillers' || serviceType === 'laser') {
          return `💎 **Premium treatments book quickly**\n\n${businessName} - Expert aesthetic practitioners\nConsultation availability limited for high-demand treatments\n\n📅 Secure your preferred appointment time`;
        }
        
        if (followUpCount === 0) {
          return `✨ **Still considering aesthetic treatment?**\n\n${businessName} - Qualified medical practitioners\nComplimentary consultations available this month\n\n🏥 Professional assessment without obligation`;
        } else {
          return `💎 **Ready for your aesthetic consultation?**\n\n${businessName} - CQC registered clinic\nQualified practitioners ready to discuss your goals\n\n📅 Book your consultation today`;
        }
      },
      quickReplies: [
        { title: '📅 Yes, book now', next: 'SERVICE_SELECT' },
        { title: '❓ Have questions', next: 'QUESTION' },
        { title: '✅ Not interested', next: 'END', payload: { resolved: true } }
      ],
      followUpAfterHours: 48
    },

    END: {
      message: async (businessData: BusinessData, conversationData?: ConversationData): Promise<string> => {
        await adapters.metrics.trackEvent(businessData.id || 'unknown', 'conversation_ended');
        
        const bookingCompleted = conversationData?.payload?.booking_completed;
        const resolved = conversationData?.payload?.resolved;
        const businessName = businessData.business_name || 'Premier Aesthetics';
        const authority = getAuthorityMessage(businessData, config);
        
        // Track treatment booking
        if (bookingCompleted) {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_treatment_booked');
        }
        
        // Retention tagging for resolved issues
        if (resolved === true) {
          await adapters.metrics.trackEvent(businessData.id || 'unknown', 'aesthetics_issue_resolved', {
            retention_candidate: true
          });
        }
        
        if (bookingCompleted) {
          return `💎 **Consultation confirmed with ${businessName}**\n${authority}\n\nOur qualified practitioner will contact you shortly\n📞 **Clinic Reception:** ${businessData.phone || 'Call us'}\n\n🏥 Professional aesthetic treatments`;
        }
        
        return `💎 **${businessName} - Always Here**\n${authority}\n\n📞 **Consultation Booking:** ${businessData.phone || 'Call us'}\n\n✨ When you're ready for professional aesthetic care`;
      },
      quickReplies: [
        { title: '📅 Actually, book now!', next: 'SERVICE_SELECT' },
        { title: '📍 Clinic details', next: 'LOCATION' },
        { title: '❓ Ask question', next: 'QUESTION' }
      ]
    }
  };
}

// ===== DEFAULT CONFIGURATION =====

/**
 * Default tenant configuration for aesthetics flow
 */
export const defaultAestheticsConfig: AestheticsTenantConfig = {
  // Feature flags
  show_scarcity: true,
  enable_deposit: true,
  enable_photo_upload: true,
  
  // Scoring weights (configurable per tenant)
  scoring_weights: {
    high_value_service: 30,    // fillers, laser
    same_day_interest: 25,     // urgent booking
    verified_phone: 15,        // phone validation
    deposit_intent: 10,        // willingness to pay deposit
    visual_assessment: 10,     // photo upload
    revenue_potential: 20      // high-value treatments
  },
  
  // ETA rules by priority
  eta_rules: {
    CRITICAL: '12–24 hours',
    HIGH: '24–48 hours', 
    STANDARD: '2–5 days',
    MANUAL_REVIEW: 'Clinician review required'
  },
  
  // Authority messaging fallback
  authority_fallback: '🏥 CQC-Registered & Licensed Aesthetic Clinic'
};

/**
 * Creates an aesthetics flow with default configuration
 * Convenience function for quick tenant setup
 */
export function createDefaultAestheticsFlow(
  adapters: AestheticsAdapters,
  configOverrides?: Partial<AestheticsTenantConfig>
): ConversationFlow {
  const config = { ...defaultAestheticsConfig, ...configOverrides };
  return createAestheticsFlow(config, adapters);
}