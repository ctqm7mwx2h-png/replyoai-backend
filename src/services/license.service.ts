import { prisma } from '../models/index.js';

export class LicenseService {
  /**
   * Register Instagram username - now stores in BusinessProfile and links to subscription
   */
  static async registerIgUsername(igUsername: string, subscriptionId?: string) {
    // If no subscriptionId provided, find the most recent ACTIVE subscription
    let targetSubscriptionId = subscriptionId;
    
    if (!targetSubscriptionId) {
      const subscription = await prisma.subscription.findFirst({
        where: {
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        throw new Error('No available subscription found');
      }
      
      targetSubscriptionId = subscription.id;
    }

    // Create or update business profile with subscription link
    return await prisma.businessProfile.upsert({
      where: { igUsername },
      update: {
        subscriptionId: targetSubscriptionId,
      },
      create: {
        igUsername,
        businessName: 'Pending', // Temporary until business profile is filled
        subscriptionId: targetSubscriptionId,
      },
    });
  }

  /**
   * Check access for Instagram username via BusinessProfile -> Subscription
   */
  static async checkAccessByUsername(igUsername: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { igUsername },
    });

    if (!businessProfile?.subscriptionId) {
      return { allowed: false };
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: businessProfile.subscriptionId },
    });

    return {
      allowed: subscription?.status === 'ACTIVE',
    };
  }
}