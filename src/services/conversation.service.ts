import { prisma } from '../models/index.js';

export interface BusinessData {
  id: string;
  business_name: string;
  booking_link?: string;
  email?: string;
  phone?: string;
  location?: string;
  hours?: string;
  tone?: string;
  industry?: string;
}

export class ConversationService {
  /**
   * Get business profile data for conversations
   */
  static async getBusinessData(igUsername: string): Promise<BusinessData | null> {
    try {
      const businessProfile = await prisma.businessProfile.findUnique({
        where: { igUsername: igUsername }
      });

      if (!businessProfile) {
        return null;
      }

      return {
        id: businessProfile.id,
        business_name: businessProfile.businessName,
        booking_link: businessProfile.bookingLink || undefined,
        email: businessProfile.email || undefined,
        phone: businessProfile.phone || undefined,
        location: businessProfile.location || undefined,
        hours: businessProfile.hours || undefined,
        tone: businessProfile.tone || undefined,
        industry: businessProfile.industry || undefined,
      };

    } catch (error) {
      console.error('Error fetching business data for conversation:', error);
      return null;
    }
  }

  /**
   * Update conversation-related business data
   */
  static async updateBusinessData(
    igUsername: string,
    data: Partial<BusinessData>
  ): Promise<boolean> {
    try {
      await prisma.businessProfile.update({
        where: { igUsername: igUsername },
        data: {
          businessName: data.business_name,
          bookingLink: data.booking_link,
          email: data.email,
          phone: data.phone,
          location: data.location,
          hours: data.hours,
          tone: data.tone,
          industry: data.industry,
        }
      });

      return true;

    } catch (error) {
      console.error('Error updating business data:', error);
      return false;
    }
  }

  /**
   * Check if business profile exists
   */
  static async businessExists(igUsername: string): Promise<boolean> {
    try {
      const count = await prisma.businessProfile.count({
        where: { igUsername: igUsername }
      });

      return count > 0;

    } catch (error) {
      console.error('Error checking business existence:', error);
      return false;
    }
  }

  /**
   * Get list of all business usernames (for batch operations)
   */
  static async getAllBusinessUsernames(): Promise<string[]> {
    try {
      const profiles = await prisma.businessProfile.findMany({
        select: { igUsername: true }
      });

      return profiles.map(p => p.igUsername);

    } catch (error) {
      console.error('Error fetching business usernames:', error);
      return [];
    }
  }
}