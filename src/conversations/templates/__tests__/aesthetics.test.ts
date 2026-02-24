import { 
  createAestheticsFlow, 
  createDefaultAestheticsFlow,
  defaultAestheticsConfig,
  AestheticsTenantConfig,
  AestheticsAdapters,
  AestheticsPayload
} from '../aesthetics.js';
import { BusinessData, ConversationData } from '../../types.js';

describe('Aesthetics Flow SaaS Template', () => {
  // Create properly typed mock adapters
  const createMockAdapters = (): AestheticsAdapters => ({
    saveLead: jest.fn().mockResolvedValue(undefined),
    computeScore: jest.fn().mockReturnValue(85),
    isHot: jest.fn().mockReturnValue(true),
    notifyOwner: jest.fn().mockResolvedValue(undefined),
    enqueueManualReview: jest.fn().mockResolvedValue(undefined),
    generateCalendlyLink: jest.fn().mockResolvedValue('https://calendly.com/test'),
    generateDepositLink: jest.fn().mockResolvedValue('https://stripe.com/deposit'),
    validateUrl: jest.fn().mockReturnValue(true),
    metrics: {
      trackEvent: jest.fn().mockResolvedValue(undefined)
    }
  });

  let mockAdapters: AestheticsAdapters;

  // Test business data
  const mockBusinessData: BusinessData = {
    id: 'test-tenant-1',
    business_name: 'Elite Aesthetics Clinic',
    phone: '+447912345678',
    location: 'London, UK',
    hours: 'Mon-Fri: 9am-6pm',
    rating: 4.8,
    reviews_count: 156,
    available_slots: 5,
    booking_link: 'https://booking.test.com',
    deposit_link: 'https://deposit.test.com'
  };

  const mockConversationData: ConversationData = {
    payload: {
      service_type: 'fillers',
      urgency: 'this_week',
      same_day_interest: true,
      age_confirmed: true,
      medical_conditions: false,
      pregnant_or_breastfeeding: false,
      previous_treatments: true,
      gdpr_consent: true,
      marketing_opt_in: true,
      medical_disclaimer_acknowledged: true,
      photo_uploaded: true,
      visual_assessment_ready: true,
      deposit_intent: true,
      phone: '+447912345678',
      phone_invalid: false
    } as AestheticsPayload
  };

  beforeEach(() => {
    mockAdapters = createMockAdapters();
  });

  describe('Factory Functions', () => {
    test('createAestheticsFlow creates flow with custom config', () => {
      const customConfig: AestheticsTenantConfig = {
        ...defaultAestheticsConfig,
        show_scarcity: false,
        enable_deposit: false
      };

      const flow = createAestheticsFlow(customConfig, mockAdapters);
      
      expect(flow).toBeDefined();
      expect(flow.START).toBeDefined();
      expect(flow.BOOK).toBeDefined();
      expect(flow.CONSENT_STATE).toBeDefined();
    });

    test('createDefaultAestheticsFlow uses defaults with overrides', () => {
      const flow = createDefaultAestheticsFlow(mockAdapters, {
        show_scarcity: false
      });
      
      expect(flow).toBeDefined();
      expect(flow.START).toBeDefined();
    });
  });

  describe('GDPR Compliance Gate', () => {
    test('BOOK state blocks when GDPR consent missing', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          gdpr_consent: false
        }
      };

      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Compliance Requirements Not Met');
      expect(result).toContain('GDPR data processing consent');
      expect(mockAdapters.saveLead).not.toHaveBeenCalled();
    });

    test('BOOK state blocks when medical disclaimer missing', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          medical_disclaimer_acknowledged: false
        }
      };

      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Compliance Requirements Not Met');
      expect(mockAdapters.saveLead).not.toHaveBeenCalled();
    });

    test('BOOK state blocks when age not confirmed', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          age_confirmed: false
        }
      };

      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Compliance Requirements Not Met');
      expect(mockAdapters.saveLead).not.toHaveBeenCalled();
    });

    test('BOOK state blocks when phone not verified', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          phone_invalid: true
        }
      };

      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Compliance Requirements Not Met');
      expect(mockAdapters.saveLead).not.toHaveBeenCalled();
    });
  });

  describe('Medical Risk Manual Review Branch', () => {
    test('BOOK state handles medical risk cases correctly', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          medical_risk_flag: true,
          medical_conditions: true
        }
      };

      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Clinician Review Required');
      expect(result).toContain('Medical assessment needed');
      
      // Should still save lead and compute score
      expect(mockAdapters.computeScore).toHaveBeenCalled();
      expect(mockAdapters.saveLead).toHaveBeenCalledWith(
        'test-tenant-1',
        expect.objectContaining({
          dispatch_priority: 'MANUAL_REVIEW',
          score: 85
        })
      );
      
      // Should enqueue for manual review
      expect(mockAdapters.enqueueManualReview).toHaveBeenCalledWith(
        'test-tenant-1',
        expect.objectContaining({
          medical_risk_flag: true,
          dispatch_priority: 'MANUAL_REVIEW'
        }),
        85
      );
    });

    test('Medical risk bypasses hot lead notification', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          medical_risk_flag: true
        }
      };

      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, conversationData);
      
      // Should not call notifyOwner for manual review cases
      expect(mockAdapters.notifyOwner).not.toHaveBeenCalled();
    });
  });

  describe('Booking Fallback Chain', () => {
    test('BOOK uses booking_link when available and valid', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).toContain('https://booking.test.com');
    });

    test('BOOK falls back to Calendly when booking_link invalid', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      // Mock invalid booking URL  
      (mockAdapters.validateUrl as jest.Mock).mockReturnValue(false);
      
      const businessData = { ...mockBusinessData, booking_link: 'invalid-url' };
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(businessData, mockConversationData);
      
      expect(result).toContain('https://calendly.com/test');
      expect(mockAdapters.generateCalendlyLink).toHaveBeenCalledWith(
        'test-tenant-1',
        { service: 'priority-aesthetics-consult' }
      );
    });

    test('BOOK falls back to phone when Calendly fails', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      // Mock no booking link and Calendly failure
      (mockAdapters.validateUrl as jest.Mock).mockReturnValue(false);
      (mockAdapters.generateCalendlyLink as jest.Mock).mockRejectedValue(new Error('Calendly API error'));
      
      const businessData = { ...mockBusinessData, booking_link: undefined };
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(businessData, mockConversationData);
      
      expect(result).toContain('+447912345678');
    });
  });

  describe('Hot Lead Detection & Owner Notifications', () => {
    test('BOOK triggers notifyOwner for hot leads', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      // Mock hot lead
      (mockAdapters.isHot as jest.Mock).mockReturnValue(true);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.notifyOwner).toHaveBeenCalledWith(
        'test-tenant-1',
        expect.objectContaining({
          service_type: 'fillers',
          owner_notification_priority: 'sms'
        }),
        85,
        '+447912345678'
      );
    });

    test('BOOK does not notify for non-hot leads', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      // Mock non-hot lead
      (mockAdapters.isHot as jest.Mock).mockReturnValue(false);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.notifyOwner).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate Booking Guard', () => {
    test('BOOK blocks duplicate booking attempts', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        ...mockConversationData,
        leadData: {
          alreadyBooked: true
        }
      };

      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Consultation Already Booked');
      expect(result).toContain('Contact clinic if changes are needed');
      expect(mockAdapters.saveLead).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Configuration', () => {
    test('Scarcity display respects tenant config', async () => {
      const configWithoutScarcity: AestheticsTenantConfig = {
        ...defaultAestheticsConfig,
        show_scarcity: false,
        available_slots: 3
      };
      
      const flow = createAestheticsFlow(configWithoutScarcity, mockAdapters);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).not.toContain('priority slots remaining');
    });

    test('Deposit feature respects tenant config', async () => {
      const configWithoutDeposit: AestheticsTenantConfig = {
        ...defaultAestheticsConfig,
        enable_deposit: false
      };
      
      const flow = createAestheticsFlow(configWithoutDeposit, mockAdapters);
      
      const messageFunc = flow.DEPOSIT_OPTION.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const depositResult = await messageFunc(mockBusinessData);
      
      expect(depositResult).toContain('No deposit required');
    });

    test('Photo upload feature respects tenant config', () => {
      const configWithoutPhoto: AestheticsTenantConfig = {
        ...defaultAestheticsConfig,
        enable_photo_upload: false
      };
      
      const flow = createAestheticsFlow(configWithoutPhoto, mockAdapters);
      
      // Should not have PHOTO_UPLOAD_OPTION state when disabled
      expect(flow.PHOTO_UPLOAD_OPTION).toBeUndefined();
    });

    test('Custom ETA rules are applied', async () => {
      const customConfig: AestheticsTenantConfig = {
        ...defaultAestheticsConfig,
        eta_rules: {
          CRITICAL: '6–12 hours',
          HIGH: '12–24 hours',
          STANDARD: '1–3 days',
          MANUAL_REVIEW: 'Specialist review within 48 hours'
        }
      };
      
      const flow = createAestheticsFlow(customConfig, mockAdapters);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).toContain('6–12 hours'); // Custom CRITICAL ETA
    });
  });

  describe('Analytics & Metrics', () => {
    test('All key events are tracked throughout flow', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      // Test conversation start
      const startFunc = flow.START.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await startFunc(mockBusinessData);
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-tenant-1',
        'conversation_started'
      );
      
      // Test service selection
      const serviceFunc = flow.SERVICE_SELECT.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await serviceFunc(mockBusinessData, mockConversationData);
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-tenant-1',
        'service_selected',
        { service_type: 'fillers' }
      );
      
      // Test booking completion
      const bookFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await bookFunc(mockBusinessData, mockConversationData);
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-tenant-1',
        'aesthetics_lead_scored',
        expect.objectContaining({
          service_type: 'fillers',
          hot: true,
          score: 85
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('BOOK gracefully handles adapter failures', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      // Mock saveLead failure
      (mockAdapters.saveLead as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).toContain('Consultation confirmed');
      expect(result).toContain('Our clinic will contact you shortly');
    });
  });

  describe('Lead Data Creation', () => {
    test('Enhanced lead data includes all scoring dimensions', async () => {
      const flow = createAestheticsFlow(defaultAestheticsConfig, mockAdapters);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.saveLead).toHaveBeenCalledWith(
        'test-tenant-1',
        expect.objectContaining({
          service_type: 'fillers',
          urgency: 'this_week',
          high_value_job: true,
          verified_phone: true,
          same_day_interest: true,
          dispatch_priority: 'CRITICAL',
          service_tier: 'aesthetics',
          age_confirmed: true,
          gdpr_consent: true,
          medical_disclaimer_acknowledged: true,
          revenue_potential_score_flag: true,
          urgency_weight: 'high',
          owner_notification_priority: 'sms',
          score: 85
        })
      );
    });
  });
});