import { Request, Response } from 'express';
import { StripeController } from '../../src/controllers/stripe.controller.js';
import { prisma } from '../../src/models/index.js';
import { stripe } from '../../src/utils/stripe.js';
import { sendOnboardingEmail } from '../../src/services/email.service.js';

// Mock dependencies
jest.mock('../../src/models/index.js', () => ({
  prisma: {
    stripeEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    businessProfile: {
      findFirst: jest.fn(),
    },
    subscription: {
      upsert: jest.fn(),
    },
  } as any, // Type assertion to avoid TypeScript editor issues
}));

jest.mock('../../src/utils/stripe.js', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('../../src/services/business-profile.service.js', () => ({
  BusinessProfileService: {
    upsertBusinessProfile: jest.fn(),
  },
}));

jest.mock('../../src/services/email.service.js', () => ({
  sendOnboardingEmail: jest.fn(),
}));

describe('StripeController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    
    req = {
      body: Buffer.from(JSON.stringify({})),
      headers: {
        'stripe-signature': 'test-signature',
      },
    };
    
    res = {
      status: statusSpy,
      json: jsonSpy,
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('handleWebhook', () => {
    it('should handle checkout.session.completed webhook', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session',
            customer: 'cus_test_customer',
            subscription: 'sub_test_subscription',
            customer_details: {
              email: 'test@example.com',
            },
          },
        },
      };

      const mockBusinessProfile = {
        id: 'profile_123',
        email: 'test@example.com',
        igUsername: 'test_user',
        businessName: 'Test Business',
      };

      const mockSubscription = {
        id: 'subscription_123',
        stripeCustomerId: 'cus_test_customer',
        businessProfileId: 'profile_123',
        status: 'ACTIVE',
      };

      // Mock Stripe webhook construction
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);
      
      // Mock existing event check (not found)
      ((prisma as any).stripeEvent.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Mock business profile lookup (not found, so will create new)
      (prisma.businessProfile.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Mock business profile creation
      const { BusinessProfileService } = require('../../src/services/business-profile.service.js');
      BusinessProfileService.upsertBusinessProfile.mockResolvedValue(mockBusinessProfile);
      
      // Mock subscription creation
      (prisma.subscription.upsert as jest.Mock).mockResolvedValue(mockSubscription);
      
      // Mock Stripe subscription retrieval
      (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
        items: {
          data: [{ price: { nickname: 'premium' } }],
        },
      });
      
      // Mock event storage
      ((prisma as any).stripeEvent.create as jest.Mock).mockResolvedValue({});
      
      // Mock onboarding email scheduling
      (sendOnboardingEmail as jest.Mock).mockResolvedValue(true);

      await StripeController.handleWebhook(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Webhook processed successfully',
      });

      // Verify business profile creation
      expect(BusinessProfileService.upsertBusinessProfile).toHaveBeenCalledWith({
        ig_username: expect.stringMatching(/^temp_test_\d+$/),
        business_name: 'test',
        email: 'test@example.com',
      });

      // Verify subscription creation
      expect(prisma.subscription.upsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test_subscription' },
        update: {
          stripeCustomerId: 'cus_test_customer',
          stripeSubscriptionId: 'sub_test_subscription',
          businessProfileId: 'profile_123',
          customerEmail: 'test@example.com',
          status: 'ACTIVE',
          plan: 'premium',
          updatedAt: expect.any(Date),
        },
        create: {
          stripeCustomerId: 'cus_test_customer',
          stripeSubscriptionId: 'sub_test_subscription',
          businessProfileId: 'profile_123',
          customerEmail: 'test@example.com',
          status: 'ACTIVE',
          plan: 'premium',
        },
      });

      // Verify onboarding email sent
      expect(sendOnboardingEmail).toHaveBeenCalledWith('profile_123', 'test@example.com');

      // Verify event stored for idempotency
      expect((prisma as any).stripeEvent.create).toHaveBeenCalledWith({
        data: {
          id: 'evt_test_123',
          eventType: 'checkout.session.completed',
          processed: true,
          data: mockEvent.data,
        },
      });
    });

    it('should skip processing if event already processed (idempotency)', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: { object: {} },
      };

      // Mock Stripe webhook construction
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);
      
      // Mock existing event found
      ((prisma as any).stripeEvent.findUnique as jest.Mock).mockResolvedValue({
        id: 'evt_test_123',
        processed: true,
      });

      await StripeController.handleWebhook(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Webhook processed successfully',
      });

      // Verify no processing occurred
      expect(prisma.businessProfile.findFirst).not.toHaveBeenCalled();
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
      expect(sendOnboardingEmail).not.toHaveBeenCalled();
    });

    it('should handle missing customer data gracefully', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session',
            // Missing customer and customer_details
          },
        },
      };

      // Mock Stripe webhook construction
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);
      
      // Mock existing event check (not found)
      ((prisma as any).stripeEvent.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Mock event storage
      ((prisma as any).stripeEvent.create as jest.Mock).mockResolvedValue({});

      await StripeController.handleWebhook(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Webhook processed successfully',
      });

      // Verify no processing occurred due to missing data
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
      expect(sendOnboardingEmail).not.toHaveBeenCalled();
      
      // But event should still be stored
      expect((prisma as any).stripeEvent.create).toHaveBeenCalled();
    });
  });
});