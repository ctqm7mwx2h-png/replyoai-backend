import { Request, Response } from 'express';
import { stripe } from '../utils/stripe.js';
import { config } from '../config/index.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { BusinessProfileService } from '../services/business-profile.service.js';
import { sendOnboardingEmail } from '../services/email.service.js';
import { prisma } from '../models/index.js';
import { SubscriptionStatus } from '@prisma/client';

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

    // Check idempotency - ensure we don't process the same event twice
    const existingEvent = await prisma.stripeEvent.findUnique({
      where: { id: event.id }
    });

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await StripeController.handleCheckoutCompleted(event.data.object);
          break;

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

      // Store event ID for idempotency
      await prisma.stripeEvent.create({
        data: {
          id: event.id,
          eventType: event.type,
          processed: true,
          data: event.data
        }
      });

    } catch (error) {
      console.error(`Error processing webhook event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Handle checkout session completed - create tenant and subscription
   */
  private static async handleCheckoutCompleted(session: any) {
    try {
      console.log(`Processing checkout completed for session: ${session.id}`);

      // Extract data from checkout session
      const customerEmail = session.customer_details?.email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      
      if (!customerEmail || !customerId) {
        console.error('Missing required checkout session data:', { customerEmail, customerId });
        return;
      }

      // Get subscription details to extract plan info
      let planName = 'basic'; // default
      if (subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          planName = subscription.items.data[0]?.price?.nickname || 'basic';
        } catch (error) {
          console.warn('Could not retrieve subscription for plan info:', error);
        }
      }

      // Create or find business profile (tenant) based on email
      let businessProfile;
      const existingProfile = await prisma.businessProfile.findFirst({
        where: { email: customerEmail }
      });

      if (existingProfile) {
        businessProfile = existingProfile;
        console.log(`Using existing business profile for ${customerEmail}`);
      } else {
        // Create new business profile with email as temporary username
        const tempUsername = customerEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        
        businessProfile = await BusinessProfileService.upsertBusinessProfile({
          ig_username: `temp_${tempUsername}_${Date.now()}`, // Temporary until they connect Instagram
          business_name: customerEmail.split('@')[0], // Use email prefix as business name
          email: customerEmail
        });
        
        console.log(`Created new business profile for ${customerEmail}`);
      }

      // Create or update subscription linked to business profile
      // Use stripeSubscriptionId as primary unique identifier to prevent duplicates
      const whereClause = subscriptionId ? 
        { stripeSubscriptionId: subscriptionId } : 
        { stripeCustomerId: customerId };
      
      const subscription = await prisma.subscription.upsert({
        where: whereClause,
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          businessProfileId: businessProfile.id,
          customerEmail: customerEmail,
          status: subscriptionId ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING,
          plan: planName,
          updatedAt: new Date()
        },
        create: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          businessProfileId: businessProfile.id,
          customerEmail: customerEmail,
          status: subscriptionId ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING,
          plan: planName
        }
      });

      console.log(`Subscription created/updated for customer ${customerId}:`, {
        subscriptionId: subscription.id,
        status: subscription.status,
        businessProfileId: businessProfile.id
      });

      // Send onboarding welcome email
      try {
        await sendOnboardingEmail(businessProfile.id, customerEmail);
        console.log(`Onboarding email sent to ${customerEmail} for business ${businessProfile.id}`);
      } catch (emailError) {
        console.error('Failed to send onboarding email:', emailError);
        // Don't throw - email sending failure shouldn't block checkout completion
      }

    } catch (error) {
      console.error('Error handling checkout completed:', error);
      throw error;
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
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
      case 'cancelled':
        return SubscriptionStatus.CANCELLED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'incomplete':
      case 'incomplete_expired':
      case 'trialing':
      case 'unpaid':
      default:
        return SubscriptionStatus.PENDING;
    }
  }
}