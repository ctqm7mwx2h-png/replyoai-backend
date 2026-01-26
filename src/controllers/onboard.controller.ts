import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service.js';
import { InstagramService } from '../services/instagram.service.js';
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

export class InstagramController {
  /**
   * Connect Instagram page to subscription
   * POST /api/connect-instagram
   */
  static async connectInstagram(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId, instagramPageId } = req.body;

      const instagramPage = await InstagramService.connectInstagramPage({
        subscriptionId,
        instagramPageId,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Instagram page connected successfully',
        data: {
          instagramPageId: instagramPage.pageId,
          connectedAt: instagramPage.connectedAt,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error connecting Instagram page:', error);
      
      let message = 'Error connecting Instagram page';
      let status = 500;

      if (error instanceof Error) {
        if (error.message === 'Subscription not found') {
          message = 'Subscription not found';
          status = 404;
        } else if (error.message === 'Subscription is not active') {
          message = 'Subscription is not active';
          status = 400;
        }
      }

      const response: ApiResponse = {
        success: false,
        message,
      };

      res.status(status).json(response);
    }
  }
}