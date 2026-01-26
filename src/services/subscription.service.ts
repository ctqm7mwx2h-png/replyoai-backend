import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../models/index.js';

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

    return await prisma.subscription.upsert({
      where: { stripeCustomerId },
      update: {
        stripeSubscriptionId,
        plan,
        status: stripeSubscriptionId ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING,
        updatedAt: new Date(),
      },
      create: {
        stripeCustomerId,
        stripeSubscriptionId,
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
   * Find subscription by Stripe customer ID
   */
  static async findByCustomerId(stripeCustomerId: string) {
    return await prisma.subscription.findUnique({
      where: { stripeCustomerId },
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