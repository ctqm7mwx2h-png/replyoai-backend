import { 
  createBeautyFlow, 
  createDefaultBeautyFlow,
  defaultBeautyConfig,
  BeautyTenantConfig,
  BeautyAdapters,
  BeautyPayload
} from '../beauty.js';
import { BusinessData, ConversationData } from '../../types.js';

describe('Beauty Flow SaaS Template', () => {
  // Create properly typed mock adapters
  const createMockAdapters = (): BeautyAdapters => ({
    saveLead: jest.fn().mockResolvedValue(undefined),
    computeScore: jest.fn().mockReturnValue(85),
    isHot: jest.fn().mockReturnValue(true),
    notifyOwner: jest.fn().mockResolvedValue(undefined),
    generateBookingLink: jest.fn().mockResolvedValue('https://booking.salon.com/test'),
    generateDepositLink: jest.fn().mockResolvedValue('https://deposit.salon.com/test'),
    scheduleSlotRelease: jest.fn().mockResolvedValue(undefined),
    scheduleEscalation: jest.fn().mockResolvedValue(undefined),
    sendPhoneReminder: jest.fn().mockResolvedValue(undefined),
    validateUrl: jest.fn().mockReturnValue(true),
    metrics: {
      trackEvent: jest.fn().mockResolvedValue(undefined)
    }
  });

  let mockAdapters: BeautyAdapters;

  // Test business data
  const mockBusinessData: BusinessData = {
    id: 'test-salon-1',
    business_name: 'Elite Beauty Salon',
    phone: '+447912345678',
    location: 'London, UK',
    hours: 'Mon-Fri: 9am-6pm',
    rating: 4.9,
    reviews_count: 248,
    available_slots: 7,
    booking_link: 'https://booking.salon.com',
    deposit_link: 'https://deposit.salon.com'
  };

  const mockConversationData: ConversationData = {
    payload: {
      service_type: 'hair',
      urgency: 'this_week',
      first_time: true,
      photo_uploaded: true,
      deposit_intent: true,
      phone: '+447912345678',
      phone_invalid: false
    } as BeautyPayload
  };

  beforeEach(() => {
    mockAdapters = createMockAdapters();
  });

  describe('Factory Functions', () => {
    test('createBeautyFlow creates flow with custom config', () => {
      const customConfig: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        show_scarcity: false,
        enable_deposit: false
      };

      const flow = createBeautyFlow(customConfig, mockAdapters);
      
      expect(flow).toBeDefined();
      expect(flow.START).toBeDefined();
      expect(flow.BOOK).toBeDefined();
      expect(flow.SERVICE_SELECT).toBeDefined();
    });

    test('createDefaultBeautyFlow uses defaults with overrides', () => {
      const flow = createDefaultBeautyFlow(mockAdapters, {
        show_scarcity: false
      });
      
      expect(flow).toBeDefined();
      expect(flow.START).toBeDefined();
    });
  });

  describe('Booking Fallback Chain', () => {
    test('BOOK uses config.booking_link when available and valid', async () => {
      const customConfig: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        booking_link: 'https://custom.booking.com'
      };
      
      const flow = createBeautyFlow(customConfig, mockAdapters);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).toContain('https://custom.booking.com');
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'booking_link_provided'
      );
    });

    test('BOOK falls back to business booking_link when config not provided', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).toContain('https://booking.salon.com');
    });

    test('BOOK falls back to generateBookingLink when booking_link invalid', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      // Mock invalid booking URL
      (mockAdapters.validateUrl as jest.Mock).mockReturnValue(false);
      
      const businessData = { ...mockBusinessData, booking_link: 'invalid-url' };
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(businessData, mockConversationData);
      
      expect(result).toContain('https://booking.salon.com/test');
      expect(mockAdapters.generateBookingLink).toHaveBeenCalledWith(
        'test-salon-1',
        { service: 'hair' }
      );
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'booking_link_generated'
      );
    });

    test('BOOK falls back to phone when booking generation fails', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      // Mock no booking link and generation failure
      (mockAdapters.validateUrl as jest.Mock).mockReturnValue(false);
      (mockAdapters.generateBookingLink as jest.Mock).mockRejectedValue(new Error('Booking API error'));
      
      const businessData = { ...mockBusinessData, booking_link: undefined };
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(businessData, mockConversationData);
      
      expect(result).toContain('+447912345678');
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'phone_fallback_used'
      );
    });
  });

  describe('Hot Lead Detection & Owner Notifications', () => {
    test('BOOK triggers notifyOwner for hot leads', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      // Mock hot lead
      (mockAdapters.isHot as jest.Mock).mockReturnValue(true);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.notifyOwner).toHaveBeenCalledWith(
        'test-salon-1',
        expect.objectContaining({
          service_type: 'hair',
          owner_notification_priority: 'push' // THIS_WEEK priority
        }),
        85,
        '+447912345678'
      );
    });

    test('BOOK does not notify for non-hot leads', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      // Mock non-hot lead
      (mockAdapters.isHot as jest.Mock).mockReturnValue(false);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.notifyOwner).not.toHaveBeenCalled();
    });

    test('ASAP urgency triggers SMS notification priority', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const urgentData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          urgency: 'today' // ASAP priority
        }
      };
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, urgentData);
      
      expect(mockAdapters.saveLead).toHaveBeenCalledWith(
        'test-salon-1',
        expect.objectContaining({
          dispatch_priority: 'ASAP',
          owner_notification_priority: 'sms'
        })
      );
    });
  });

  describe('Scarcity Display Toggle', () => {
    test('START shows scarcity when enabled and slots available', async () => {
      const configWithScarcity: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        show_scarcity: true,
        available_slots: 5
      };
      
      const flow = createBeautyFlow(configWithScarcity, mockAdapters);
      
      const messageFunc = flow.START.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData);
      
      expect(result).toContain('5 slots available'); // From config override
    });

    test('START hides scarcity when disabled', async () => {
      const configWithoutScarcity: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        show_scarcity: false,
        available_slots: 5
      };
      
      const flow = createBeautyFlow(configWithoutScarcity, mockAdapters);
      
      const messageFunc = flow.START.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData);
      
      expect(result).not.toContain('slots available');
      expect(result).not.toContain('Limited availability');
    });

    test('AVAILABILITY shows scarcity when enabled', async () => {
      const configWithScarcity: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        show_scarcity: true
      };
      
      const flow = createBeautyFlow(configWithScarcity, mockAdapters);
      
      const messageFunc = flow.AVAILABILITY.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).toContain('slots available this week');
    });
  });

  describe('Photo Upload Feature Flag', () => {
    test('Photo upload state exists when enabled', () => {
      const configWithPhoto: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        enable_photo_upload: true
      };
      
      const flow = createBeautyFlow(configWithPhoto, mockAdapters);
      
      expect(flow.PHOTO_UPLOAD).toBeDefined();
    });

    test('Photo upload state does not exist when disabled', () => {
      const configWithoutPhoto: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        enable_photo_upload: false
      };
      
      const flow = createBeautyFlow(configWithoutPhoto, mockAdapters);
      
      expect(flow.PHOTO_UPLOAD).toBeUndefined();
    });

    test('Photo upload tracks metrics when enabled', async () => {
      const configWithPhoto: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        enable_photo_upload: true
      };
      
      const flow = createBeautyFlow(configWithPhoto, mockAdapters);
      
      const messageFunc = flow.PHOTO_UPLOAD!.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData);
      
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'beauty_stage_reached',
        { stage: 'PHOTO_UPLOAD' }
      );
    });
  });

  describe('Error Handling in BOOK State', () => {
    test('BOOK gracefully handles saveLead failures', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      // Mock saveLead failure
      (mockAdapters.saveLead as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).toContain('Appointment confirmed');
      expect(result).toContain('Our salon will contact you shortly');
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'beauty_book_error',
        expect.objectContaining({
          error: expect.stringContaining('Database error')
        })
      );
    });

    test('BOOK handles computeScore failures gracefully', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      // Mock computeScore failure
      (mockAdapters.computeScore as jest.Mock).mockImplementation(() => {
        throw new Error('Scoring service down');
      });
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      expect(result).toContain('Appointment confirmed');
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'beauty_book_error',
        expect.objectContaining({
          error: expect.stringContaining('Scoring service down')
        })
      );
    });

    test('BOOK handles notifyOwner failures without affecting booking', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      // Mock notifyOwner failure
      (mockAdapters.notifyOwner as jest.Mock).mockRejectedValue(new Error('Notification service down'));
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, mockConversationData);
      
      // Booking should still succeed with fallback message
      expect(result).toContain('Appointment confirmed');
      expect(mockAdapters.saveLead).toHaveBeenCalled();
    });
  });

  describe('Duplicate Booking Guard', () => {
    test('BOOK blocks duplicate booking attempts', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        ...mockConversationData,
        leadData: {
          alreadyBooked: true
        }
      };

      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Appointment Already Booked');
      expect(result).toContain('Need changes?');
      expect(mockAdapters.saveLead).not.toHaveBeenCalled();
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'beauty_duplicate_attempt'
      );
    });
  });

  describe('Service Priority Routing', () => {
    test('Hair services get THIS_WEEK priority', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const hairData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          service_type: 'hair',
          urgency: 'this_week'
        }
      };
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, hairData);
      
      expect(mockAdapters.saveLead).toHaveBeenCalledWith(
        'test-salon-1',
        expect.objectContaining({
          dispatch_priority: 'THIS_WEEK',
          high_value_service: true
        })
      );
    });

    test('Bridal services get THIS_WEEK priority regardless of urgency', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const bridalData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          service_type: 'bridal',
          urgency: 'planning' // Low urgency but high-value service
        }
      };
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, bridalData);
      
      expect(mockAdapters.saveLead).toHaveBeenCalledWith(
        'test-salon-1',
        expect.objectContaining({
          dispatch_priority: 'THIS_WEEK',
          high_value_service: true
        })
      );
    });

    test('Regular services get STANDARD priority', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const regularData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          service_type: 'nails',
          urgency: 'next_week'
        }
      };
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, regularData);
      
      expect(mockAdapters.saveLead).toHaveBeenCalledWith(
        'test-salon-1',
        expect.objectContaining({
          dispatch_priority: 'STANDARD'
        })
      );
    });
  });

  describe('Analytics & Metrics', () => {
    test('All key events are tracked throughout flow', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      // Test conversation start
      const startFunc = flow.START.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await startFunc(mockBusinessData);
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'conversation_started'
      );
      
      // Test service selection
      const serviceFunc = flow.SERVICE_SELECT.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await serviceFunc(mockBusinessData);
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'beauty_stage_reached',
        { stage: 'SERVICE_SELECT' }
      );
      
      // Test availability check
      const availFunc = flow.AVAILABILITY.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await availFunc(mockBusinessData, mockConversationData);
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'service_selected',
        { service_type: 'hair' }
      );
      
      // Test booking completion
      const bookFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await bookFunc(mockBusinessData, mockConversationData);
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'beauty_lead_scored',
        expect.objectContaining({
          service_type: 'hair',
          hot: true,
          score: 85
        })
      );
    });

    test('Phone capture is tracked', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const phoneFunc = flow.REQUEST_PHONE.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await phoneFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'beauty_phone_captured',
        {
          service_type: 'hair',
          urgency: 'this_week'
        }
      );
    });

    test('Deposit initiation is tracked when enabled', async () => {
      const configWithDeposit: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        require_deposit_for_booking: true,
        deposit_amount_fixed: 25
      };
      
      const flow = createBeautyFlow(configWithDeposit, mockAdapters);
      
      const depositData: ConversationData = {
        payload: {
          service_type: 'hair',
          urgency: 'this_week',
          phone: '+447912345678',
          deposit_required: true,
          deposit_amount: 25
        }
      };
      
      const messageFunc = flow.DEPOSIT!.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, depositData);
      
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'deposit_link_generated',
        expect.objectContaining({
          service_type: 'hair',
          deposit_amount: 25
        })
      );
    });
  });

  describe('Lead Data Creation', () => {
    test('Enhanced lead data includes all scoring dimensions', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.saveLead).toHaveBeenCalledWith(
        'test-salon-1',
        expect.objectContaining({
          service_type: 'hair',
          urgency: 'this_week',
          dispatch_priority: 'THIS_WEEK',
          phone: '+447912345678',
          first_time: true,
          photo_uploaded: true,
          deposit_intent: true,
          high_value_service: true,
          verified_phone: true,
          urgency_weight: 'medium',
          owner_notification_priority: 'push',
          score: 85
        })
      );
    });
  });

  describe('Configuration Integration', () => {
    test('Custom ETA rules are applied correctly', async () => {
      const customConfig: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        eta_rules: {
          ASAP: '1-2 hours',
          THIS_WEEK: '12-24 hours',
          STANDARD: '2-4 days'
        }
      };
      
      const flow = createBeautyFlow(customConfig, mockAdapters);
      
      const urgentData: ConversationData = {
        payload: {
          ...mockConversationData.payload,
          urgency: 'today' // ASAP priority
        }
      };
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, urgentData);
      
      expect(result).toContain('1-2 hours'); // Custom ASAP ETA
    });

    test('Custom authority message is used', async () => {
      const customConfig: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        authority_fallback: '🌟 Award-Winning Beauty Studio',
        rating: undefined,
        reviews_count: undefined
      };
      
      const flow = createBeautyFlow(customConfig, mockAdapters);
      
      const businessDataNoRating = { ...mockBusinessData, rating: undefined, reviews_count: undefined };
      const messageFunc = flow.START.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(businessDataNoRating);
      
      expect(result).toContain('🌟 Award-Winning Beauty Studio');
    });
  });

  describe('Deposit Enforcement Mode', () => {
    test('DEPOSIT state exists when deposit enforcement enabled', () => {
      const configWithDeposit: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        require_deposit_for_booking: true,
        deposit_amount_fixed: 20,
        auto_release_slot_minutes: 45
      };
      
      const flow = createBeautyFlow(configWithDeposit, mockAdapters);
      
      expect(flow.DEPOSIT).toBeDefined();
    });

    test('DEPOSIT state does not exist when deposit enforcement disabled', () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      expect(flow.DEPOSIT).toBeUndefined();
    });

    test('DEPOSIT state generates deposit link and shows amount', async () => {
      const configWithDeposit: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        require_deposit_for_booking: true,
        deposit_amount_fixed: 25,
        auto_release_slot_minutes: 30
      };
      
      const flow = createBeautyFlow(configWithDeposit, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          service_type: 'hair',
          urgency: 'this_week',
          phone: '+447912345678'
        }
      };
      
      const messageFunc = flow.DEPOSIT!.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('£25');
      expect(result).toContain('Complete within 30 minutes');
      expect(result).toContain('https://deposit.salon.com/test');
      expect(mockAdapters.generateDepositLink).toHaveBeenCalled();
    });

    test('BOOK blocks without deposit when enforcement enabled', async () => {
      const configWithDeposit: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        require_deposit_for_booking: true
      };
      
      const flow = createBeautyFlow(configWithDeposit, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          service_type: 'hair',
          deposit_paid: false // No deposit paid
        }
      };
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Deposit Required First');
      expect(mockAdapters.saveLead).not.toHaveBeenCalled();
    });

    test('BOOK allows booking after deposit payment', async () => {
      const configWithDeposit: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        require_deposit_for_booking: true,
        deposit_amount_fixed: 20
      };
      
      const flow = createBeautyFlow(configWithDeposit, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          service_type: 'hair',
          deposit_paid: true // Deposit paid
        }
      };
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('Premium Appointment Booked');
      expect(result).toContain('Deposit confirmed - slot secured');
      expect(mockAdapters.saveLead).toHaveBeenCalled();
    });
  });

  describe('Hot Lead Escalation', () => {
    test('Hot lead escalation is scheduled when configured', async () => {
      const configWithEscalation: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        hot_lead_escalation_minutes: 30
      };
      
      const flow = createBeautyFlow(configWithEscalation, mockAdapters);
      
      // Mock hot lead
      (mockAdapters.isHot as jest.Mock).mockReturnValue(true);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.scheduleEscalation).toHaveBeenCalledWith(
        'test-salon-1',
        expect.any(String), // Lead ID
        30
      );
      expect(mockAdapters.metrics.trackEvent).toHaveBeenCalledWith(
        'test-salon-1',
        'hot_lead_escalation_scheduled',
        expect.objectContaining({
          escalation_minutes: 30
        })
      );
    });

    test('No escalation scheduled when feature disabled', async () => {
      const configNoEscalation: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        hot_lead_escalation_minutes: undefined
      };
      
      const flow = createBeautyFlow(configNoEscalation, mockAdapters);
      
      const messageFunc = flow.BOOK.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, mockConversationData);
      
      expect(mockAdapters.scheduleEscalation).not.toHaveBeenCalled();
    });
  });

  describe('Missed DM Recovery', () => {
    test('Phone reminders scheduled when user reaches availability but no phone provided', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          service_type: 'nails',
          reached_availability: true,
          phone: undefined // No phone provided
        }
      };
      
      const messageFunc = flow.REQUEST_PHONE.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, conversationData);
      
      expect(mockAdapters.sendPhoneReminder).toHaveBeenCalledWith(
        'test-salon-1',
        expect.any(String), // Conversation ID
        3 // 3 hour reminder
      );
      expect(mockAdapters.sendPhoneReminder).toHaveBeenCalledWith(
        'test-salon-1',
        expect.any(String),
        24 // 24 hour reminder
      );
    });

    test('No reminders scheduled if phone provided', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          service_type: 'nails',
          reached_availability: true,
          phone: '+447912345678' // Phone provided
        }
      };
      
      const messageFunc = flow.REQUEST_PHONE.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      await messageFunc(mockBusinessData, conversationData);
      
      // Should only be called for phone capture tracking, not reminders
      expect(mockAdapters.sendPhoneReminder).not.toHaveBeenCalled();
    });
  });

  describe('Improved Scarcity Logic', () => {
    test('Critical scarcity for very low slots', async () => {
      const configLowSlots: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        available_slots: 2
      };
      
      const flow = createBeautyFlow(configLowSlots, mockAdapters);
      
      const messageFunc = flow.START.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc({ ...mockBusinessData, available_slots: 2 });
      
      expect(result).toContain('🔥 Only 2 prime-time slots left');
    });

    test('Urgency scarcity for same-day bookings with moderate slots', async () => {
      const configModerateSlots: BeautyTenantConfig = {
        ...defaultBeautyConfig,
        available_slots: 4
      };
      
      const flow = createBeautyFlow(configModerateSlots, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          service_type: 'nails',
          urgency: 'today'
        }
      };
      
      const messageFunc = flow.AVAILABILITY.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc({ ...mockBusinessData, available_slots: 4 }, conversationData);
      
      expect(result).toContain('⚡ 4 same-day slots remaining');
    });

    test('Standard scarcity for normal booking flow', async () => {
      const flow = createBeautyFlow(defaultBeautyConfig, mockAdapters);
      
      const conversationData: ConversationData = {
        payload: {
          service_type: 'hair',
          urgency: 'this_week'
        }
      };
      
      const messageFunc = flow.AVAILABILITY.message as (businessData: BusinessData, conversationData?: ConversationData) => Promise<string>;
      const result = await messageFunc(mockBusinessData, conversationData);
      
      expect(result).toContain('⚡ 7 slots available this week');
    });
  });
});