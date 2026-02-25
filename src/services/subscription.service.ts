import { prisma } from '../models/index.js';
import { SubscriptionStatus } from '@prisma/client';

export class SubscriptionService {
  /**
   * Create or update subscription after payment
   */
  static async createSubscription(data: {
    stripeCustomerId: string;
    stripeSubscriptionId?: string;
    plan: string;
  }) {
    const { stripeCustomerId, stripeSubscriptionId, plan } = data;

    // Use stripeSubscriptionId as primary unique identifier when available
    const whereClause = stripeSubscriptionId ? 
      { stripeSubscriptionId } : 
      { stripeCustomerId };

    return await prisma.subscription.upsert({
      where: whereClause,
      update: {
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        plan,
        status: stripeSubscriptionId ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING,
        updatedAt: new Date(),
      },
      create: {
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        plan,
        status: stripeSubscriptionId ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING,
      },
    });
  }

  /**
   * Update subscription status from Stripe webhook
   */
  static async updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: SubscriptionStatus
  ) {
    return await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find subscriptions by Stripe customer ID (returns array since customer can have multiple subscriptions)
   */
  static async findByCustomerId(stripeCustomerId: string) {
    return await prisma.subscription.findMany({
      where: { stripeCustomerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find active subscription by Stripe customer ID (returns most recent active)
   */
  static async findActiveByCustomerId(stripeCustomerId: string) {
    return await prisma.subscription.findFirst({
      where: { 
        stripeCustomerId,
        status: SubscriptionStatus.ACTIVE 
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find subscription by Stripe subscription ID
   */
  static async findBySubscriptionId(stripeSubscriptionId: string) {
    return await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
  }
}