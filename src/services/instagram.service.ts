import { prisma } from '../models/index.js';

export class InstagramService {
  /**
   * Connect Instagram page to subscription
   */
  static async connectInstagramPage(data: {
    subscriptionId: string;
    instagramPageId: string;
  }) {
    const { subscriptionId, instagramPageId } = data;

    // Verify subscription exists and is active
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new Error('Subscription is not active');
    }

    // Check if page is already connected to any subscription
    const existingPage = await prisma.instagramPage.findUnique({
      where: { pageId: instagramPageId },
    });

    if (existingPage) {
      // Update existing connection
      return await prisma.instagramPage.update({
        where: { pageId: instagramPageId },
        data: {
          subscriptionId,
          connectedAt: new Date(),
        },
      });
    }

    // Create new connection
    return await prisma.instagramPage.create({
      data: {
        pageId: instagramPageId,
        subscriptionId,
      },
    });
  }

  /**
   * Disconnect Instagram page
   */
  static async disconnectInstagramPage(instagramPageId: string) {
    return await prisma.instagramPage.delete({
      where: { pageId: instagramPageId },
    });
  }

  /**
   * Get Instagram page details
   */
  static async getInstagramPage(instagramPageId: string) {
    return await prisma.instagramPage.findUnique({
      where: { pageId: instagramPageId },
      include: {
        subscription: true,
      },
    });
  }
}