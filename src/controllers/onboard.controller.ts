import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service.js';
import type { ApiResponse } from '../utils/validation.js';

export class OnboardController {
  /**
   * Store subscription metadata after payment
   * POST /api/onboard
   */
  static async onboard(req: Request, res: Response): Promise<void> {
    try {
      const { stripeCustomerId, stripeSubscriptionId, plan } = req.body;

      const subscription = await SubscriptionService.createSubscription({
        stripeCustomerId,
        stripeSubscriptionId,
        plan,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Subscription created successfully',
        data: {
          subscriptionId: subscription.id,
          status: subscription.status,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error during onboarding:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Error creating subscription',
      };

      res.status(500).json(response);
    }
  }
}