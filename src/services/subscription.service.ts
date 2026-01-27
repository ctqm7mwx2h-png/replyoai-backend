import { prisma } from '../models/index.js';
import type { SubscriptionStatus } from '@prisma/client';

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
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        plan,
        status: stripeSubscriptionId ? 'ACTIVE' : 'PENDING',
        updatedAt: new Date(),
      },
      create: {
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        plan,
        status: stripeSubscriptionId ? 'ACTIVE' : 'PENDING',
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
   * Register Instagram username to most recent active subscription without ig_username
   */
  static async registerIgUsername(igUsername: string) {
    // Find the most recent ACTIVE subscription without ig_username
    const subscription = await prisma.subscription.findFirst({
      where: {
        status: 'ACTIVE',
        igUsername: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      throw new Error('No available subscription found');
    }

    // Assign ig_username to the subscription
    return await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        igUsername: igUsername,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Check access for Instagram username
   */
  static async checkAccessByUsername(igUsername: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { igUsername },
    });

    return {
      allowed: subscription?.status === 'ACTIVE',
    };
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