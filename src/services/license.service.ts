import { prisma } from '../models/index.js';

export class LicenseService {
  /**
   * Register Instagram username - creates a basic business profile entry
   */
  static async registerIgUsername(igUsername: string) {
    // Create basic business profile entry
    return await prisma.businessProfile.upsert({
      where: { igUsername },
      update: {},
      create: {
        igUsername,
        businessName: 'Pending', // Temporary until business profile is filled
      },
    });
  }

  /**
   * Check access for Instagram username - simplified to just check if profile exists
   */
  static async checkAccessByUsername(igUsername: string) {
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { igUsername },
    });

    return {
      allowed: !!businessProfile,
    };
  }
}