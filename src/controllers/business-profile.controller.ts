import { Request, Response } from 'express';
import { BusinessProfileService } from '../services/business-profile.service.js';
import type { ApiResponse } from '../utils/validation.js';

export class BusinessProfileController {
  /**
   * Create or update business profile
   * POST /api/business-profile
   */
  static async upsertBusinessProfile(req: Request, res: Response): Promise<void> {
    try {
      const profileData = req.body;

      const businessProfile = await BusinessProfileService.upsertBusinessProfile(profileData);

      const response: ApiResponse = {
        success: true,
        message: 'Business profile saved successfully',
        data: {
          id: businessProfile.id,
          ig_username: businessProfile.igUsername,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error saving business profile:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Error saving business profile',
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get business profile data by Instagram username
   * POST /api/get-business-data
   */
  static async getBusinessData(req: Request, res: Response): Promise<void> {
    try {
      const { ig_username } = req.body;

      const businessProfile = await BusinessProfileService.getBusinessProfile(ig_username);

      if (!businessProfile) {
        const response: ApiResponse = {
          success: false,
          message: 'Business profile not found',
        };

        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          business_name: businessProfile.businessName,
          booking_link: businessProfile.bookingLink,
          email: businessProfile.email,
          phone: businessProfile.phone,
          location: businessProfile.location,
          hours: businessProfile.hours,
          tone: businessProfile.tone,
          industry: businessProfile.industry,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error getting business data:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Error getting business data',
      };

      res.status(500).json(response);
    }
  }
}