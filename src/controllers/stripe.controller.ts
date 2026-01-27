import { Request, Response } from 'express';
import { stripe } from '../utils/stripe.js';
import { config } from '../config/index.js';
import { SubscriptionService } from '../services/subscription.service.js';
import type { SubscriptionStatus } from '@prisma/client';

export class StripeController {
  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      console.error('Missing Stripe signature');
      res.status(400).json({
        success: false,
        message: 'Missing Stripe signature',
      });
      return;
    }

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).json({
        success: false,
        message: 'Webhook signature verification failed',
      });
      return;
    }

    try {
      await StripeController.processWebhookEvent(event);
      
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing webhook',
      });
    }
  }

  /**
   * Process different Stripe webhook event types
   */
  private static async processWebhookEvent(event: any) {
    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await StripeController.handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await StripeController.handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
      case 'invoice.paid':
        await StripeController.handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await StripeController.handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle subscription creation/updates
   */
  private static async handleSubscriptionUpdate(subscription: any) {
    const status = StripeController.mapStripeStatus(subscription.status);
    
    await SubscriptionService.updateSubscriptionStatus(
      subscription.id,
      status
    );

    console.log(`Subscription ${subscription.id} updated to ${status}`);
  }

  /**
   * Handle subscription deletion
   */
  private static async handleSubscriptionDeleted(subscription: any) {
    await SubscriptionService.updateSubscriptionStatus(
      subscription.id,
      'CANCELLED'
    );

    console.log(`Subscription ${subscription.id} cancelled`);
  }

  /**
   * Handle successful payment
   */
  private static async handlePaymentSucceeded(invoice: any) {
    if (invoice.subscription) {
      await SubscriptionService.updateSubscriptionStatus(
        invoice.subscription,
        'ACTIVE'
      );

      console.log(`Payment succeeded for subscription ${invoice.subscription}`);
    }
  }

  /**
   * Handle failed payment
   */
  private static async handlePaymentFailed(invoice: any) {
    if (invoice.subscription) {
      await SubscriptionService.updateSubscriptionStatus(
        invoice.subscription,
        'PAST_DUE'
      );

      console.log(`Payment failed for subscription ${invoice.subscription}, set to PAST_DUE`);
    }
  }

  /**
   * Map Stripe status to our internal status
   */
  private static mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return 'ACTIVE';
      case 'canceled':
      case 'cancelled':
        return 'CANCELLED';
      case 'past_due':
        return 'PAST_DUE';
      case 'incomplete':
      case 'incomplete_expired':
      case 'trialing':
      case 'unpaid':
      default:
        return 'PENDING';
    }
  }
}