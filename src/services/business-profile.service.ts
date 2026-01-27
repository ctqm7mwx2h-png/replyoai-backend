import { prisma } from '../models/index.js';

export class BusinessProfileService {
  /**
   * Create or update business profile
   */
  static async upsertBusinessProfile(data: {
    ig_username: string;
    business_name: string;
    booking_link?: string;
    email?: string;
    phone?: string;
    location?: string;
    hours?: string;
    tone?: string;
    industry?: string;
  }) {
    const {
      ig_username,
      business_name,
      booking_link,
      email,
      phone,
      location,
      hours,
      tone,
      industry,
    } = data;

    return await prisma.businessProfile.upsert({
      where: { igUsername: ig_username },
      update: {
        businessName: business_name,
        bookingLink: booking_link || null,
        email: email || null,
        phone: phone || null,
        location: location || null,
        hours: hours || null,
        tone: tone || null,
        industry: industry || null,
      },
      create: {
        igUsername: ig_username,
        businessName: business_name,
        bookingLink: booking_link || null,
        email: email || null,
        phone: phone || null,
        location: location || null,
        hours: hours || null,
        tone: tone || null,
        industry: industry || null,
      },
    });
  }

  /**
   * Get business profile by Instagram username
   */
  static async getBusinessProfile(ig_username: string) {
    return await prisma.businessProfile.findUnique({
      where: { igUsername: ig_username },
    });
  }

  /**
   * Get all business profiles (for admin purposes)
   */
  static async getAllBusinessProfiles() {
    return await prisma.businessProfile.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}