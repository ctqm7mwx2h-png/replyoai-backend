import { prisma } from '../models/index.js';

export class AccessService {
  /**
   * Check if Instagram page has access based on subscription
   */
  static async checkAccess(instagramPageId: string) {
    // Find Instagram page and include subscription data
    const instagramPage = await prisma.instagramPage.findUnique({
      where: { pageId: instagramPageId },
      include: {
        subscription: true,
      },
    });

    if (!instagramPage || !instagramPage.subscription) {
      return {
        allowed: false,
        subscriptionStatus: null,
      };
    }

    const { subscription } = instagramPage;
    const isActive = subscription.status === 'ACTIVE';

    return {
      allowed: isActive,
      subscriptionStatus: subscription.status,
    };
  }

  /**
   * Get all Instagram pages for a subscription
   */
  static async getInstagramPagesBySubscription(subscriptionId: string) {
    return await prisma.instagramPage.findMany({
      where: { subscriptionId },
      orderBy: { connectedAt: 'desc' },
    });
  }
}