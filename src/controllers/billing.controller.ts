import { Request, Response } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../models/index.js';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

// Validation schemas
const CheckAccessSchema = z.object({
  ig_username: z.string().min(1),
});

export class BillingController {
  /**
   * GET /api/check-access/:ig_username
   * Check if a business has active subscription and can process conversations
   */
  static async checkAccess(req: Request, res: Response): Promise<void> {
    try {
      const { ig_username } = CheckAccessSchema.parse(req.params);

      // Find business profile
      const business = await prisma.businessProfile.findUnique({
        where: { igUsername: ig_username },
        select: { id: true },
      });

      if (!business) {
        res.status(404).json({
          success: false,
          error: 'Business not found',
          allowed: false,
        });
        return;
      }

      // Check subscription status
      const subscription = await prisma.subscription.findFirst({
        where: {
          // TODO: Add proper business-subscription relationship
          // For now, we'll use a simple lookup
          id: { not: '' }, // Placeholder - need to add businessId to subscriptions
        },
        orderBy: { createdAt: 'desc' },
      });

      // Check installation status
      const installation = await prisma.installation.findFirst({
        where: { businessId: business.id },
        orderBy: { createdAt: 'desc' },
      });

      const isSubscriptionActive = subscription?.status === 'ACTIVE';
      const isInstallationActive = installation?.status === 'INSTALLED' && !installation.disabled;

      const allowed = isSubscriptionActive && isInstallationActive;

      res.json({
        success: true,
        allowed,
        data: {
          subscription: {
            status: subscription?.status || 'NOT_FOUND',
            plan: subscription?.plan || null,
          },
          installation: {
            status: installation?.status || 'NOT_FOUND',
            disabled: installation?.disabled || false,
          },
          limits: {
            can_process_messages: allowed,
            can_send_follow_ups: allowed,
            can_access_analytics: isSubscriptionActive,
          },
        },
      });
    } catch (error) {
      console.error('Check access error:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request parameters',
          allowed: false,
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        allowed: false,
      });
    }
  }

  /**
   * POST /api/billing/webhook
   * Handle Stripe webhook events
   */
  static async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      const signature = req.headers['stripe-signature'] as string;
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        config.stripe.webhookSecret
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      res.status(400).json({
        success: false,
        error: 'Invalid signature',
      });
      return;
    }

    try {
      switch (event.type) {
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({
        success: true,
        message: `Webhook ${event.type} processed successfully`,
      });
    } catch (error) {
      console.error(`Error processing webhook ${event.type}:`, error);
      
      // Send alert to monitoring system
      await this.sendBillingAlert(`Webhook processing failed: ${event.type}`, error);

      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
      });
    }
  }

  /**
   * Handle successful invoice payment
   */
  private static async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    try {
      // Update subscription status to active
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: invoice.subscription as string },
        data: { 
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      // Re-enable any disabled installations for this customer
      const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (subscription) {
        // TODO: Add proper business-subscription relationship
        // For now, we'll update all installations (this needs proper foreign keys)
        console.log(`Invoice paid for subscription ${subscription.id}, re-enabling installations`);
        
        // In production, this would query by business ID:
        // await prisma.installation.updateMany({
        //   where: { 
        //     business: { subscriptionId: subscription.id },
        //     disabled: true,
        //   },
        //   data: { disabled: false },
        // });
      }

      console.log(`Invoice paid successfully for subscription ${invoice.subscription}`);
    } catch (error) {
      console.error('Error handling invoice paid:', error);
      throw error;
    }
  }

  /**
   * Handle failed invoice payment
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    try {
      // Update subscription status to past due
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: invoice.subscription as string },
        data: { 
          status: 'PAST_DUE',
          updatedAt: new Date(),
        },
      });

      console.log(`Invoice payment failed for subscription ${invoice.subscription}`);
      
      // Send alert
      await this.sendBillingAlert(
        `Payment failed for subscription ${invoice.subscription}`,
        { invoice_id: invoice.id, customer: invoice.customer }
      );
    } catch (error) {
      console.error('Error handling invoice payment failed:', error);
      throw error;
    }
  }

  /**
   * Handle subscription created
   */
  private static async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      // Create or update subscription record
      await prisma.subscription.upsert({
        where: { stripeSubscriptionId: subscription.id },
        update: {
          status: this.mapStripeStatus(subscription.status),
          plan: subscription.items.data[0]?.price?.nickname || 'unknown',
          updatedAt: new Date(),
        },
        create: {
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          status: this.mapStripeStatus(subscription.status),
          plan: subscription.items.data[0]?.price?.nickname || 'unknown',
        },
      });

      console.log(`Subscription created: ${subscription.id}`);
    } catch (error) {
      console.error('Error handling subscription created:', error);
      throw error;
    }
  }

  /**
   * Handle subscription updated
   */
  private static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: this.mapStripeStatus(subscription.status),
          plan: subscription.items.data[0]?.price?.nickname || 'unknown',
          updatedAt: new Date(),
        },
      });

      console.log(`Subscription updated: ${subscription.id} - Status: ${subscription.status}`);
    } catch (error) {
      console.error('Error handling subscription updated:', error);
      throw error;
    }
  }

  /**
   * Handle subscription deleted/cancelled
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      // Update subscription status
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { 
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
      });

      // Disable all installations for this subscription
      // TODO: Add proper business-subscription relationship
      console.log(`Subscription cancelled: ${subscription.id}, disabling installations`);

      // Send alert
      await this.sendBillingAlert(
        `Subscription cancelled: ${subscription.id}`,
        { customer: subscription.customer }
      );
    } catch (error) {
      console.error('Error handling subscription deleted:', error);
      throw error;
    }
  }

  /**
   * Map Stripe subscription status to our enum
   */
  private static mapStripeStatus(stripeStatus: string): 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' {
    switch (stripeStatus) {
      case 'active':
        return 'ACTIVE';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
      case 'cancelled':
        return 'CANCELLED';
      case 'incomplete':
      case 'incomplete_expired':
      case 'trialing':
      default:
        return 'PENDING';
    }
  }

  /**
   * Send billing alerts (placeholder for actual alert system)
   */
  private static async sendBillingAlert(message: string, data?: any): Promise<void> {
    // In production, this would integrate with:
    // - Sentry for error tracking
    // - Slack for notifications
    // - Email alerts for critical issues
    
    console.error('BILLING ALERT:', message, data);
    
    // TODO: Implement actual alerting
    // - await sentry.captureMessage(message, 'error');
    // - await slackWebhook.send({ text: message });
    // - await emailService.sendAlert(message, data);
  }

  /**
   * Kill switch job: Disable installations for past due subscriptions
   */
  static async runKillSwitchJob(): Promise<void> {
    try {
      console.log('Running kill switch job...');

      // Find all past due or cancelled subscriptions
      const expiredSubscriptions = await prisma.subscription.findMany({
        where: {
          status: { in: ['PAST_DUE', 'CANCELLED'] },
        },
      });

      for (const subscription of expiredSubscriptions) {
        // TODO: Add proper business-subscription relationship
        // For now, log the action
        console.log(`Would disable installations for subscription ${subscription.id} (${subscription.status})`);
        
        // In production with proper relationships:
        // await prisma.installation.updateMany({
        //   where: { 
        //     business: { subscriptionId: subscription.id },
        //   },
        //   data: { disabled: true },
        // });

        // Send alert for each disabled subscription
        await this.sendBillingAlert(
          `Disabled installations for ${subscription.status} subscription`,
          { subscriptionId: subscription.id, plan: subscription.plan }
        );
      }

      console.log(`Kill switch job completed. Processed ${expiredSubscriptions.length} expired subscriptions.`);
    } catch (error) {
      console.error('Error in kill switch job:', error);
      await this.sendBillingAlert('Kill switch job failed', error);
    }
  }
}