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
      const body = req.body;

      // Helper function to normalize and trim values
      const normalizeValue = (value: any): string | undefined => {
        if (!value) return undefined;
        if (Array.isArray(value)) {
          const firstNonEmpty = value.find(v => v && String(v).trim());
          return firstNonEmpty ? String(firstNonEmpty).trim() : undefined;
        }
        const trimmed = String(value).trim();
        return trimmed || undefined;
      };

      // Helper function to extract from flat JSON properties
      const extractFromFlat = (keys: string[]): string | undefined => {
        for (const key of keys) {
          if (body[key]) {
            const normalized = normalizeValue(body[key]);
            if (normalized) return normalized;
          }
        }
        return undefined;
      };

      // Helper function to extract from responses array (handles multiple variants)
      const extractFromResponses = (searchTerms: string[]): string | undefined => {
        if (!Array.isArray(body.responses)) return undefined;

        for (const response of body.responses) {
          if (!response || typeof response !== 'object') continue;

          // Try different property combinations for questions/labels
          const questionKeys = ['question', 'label', 'name', 'fieldId', 'field'];
          const answerKeys = ['answer', 'value', 'response', 'data'];

          let questionText = '';
          let answerValue = undefined;

          // Extract question text from various possible keys
          for (const qKey of questionKeys) {
            if (response[qKey]) {
              questionText = String(response[qKey]).toLowerCase().trim();
              break;
            }
          }

          // Extract answer value from various possible keys
          for (const aKey of answerKeys) {
            if (response[aKey]) {
              answerValue = response[aKey];
              break;
            }
          }

          if (!questionText || !answerValue) continue;

          // Check if question matches any of our search terms
          for (const term of searchTerms) {
            if (questionText.includes(term.toLowerCase())) {
              const normalized = normalizeValue(answerValue);
              if (normalized) return normalized;
            }
          }
        }
        return undefined;
      };

      // Extract ig_username with multiple fallbacks
      const igUsername = extractFromFlat(['ig_username', 'instagram_username', 'instagram', 'ig']) ||
                        extractFromResponses(['instagram username', 'ig username', 'instagram', 'ig', 'instagram_username']);

      // Extract business_name
      const businessName = extractFromFlat(['business_name', 'company_name', 'name']) ||
                          extractFromResponses(['business name', 'company name', 'name']);

      // Extract booking_link
      let bookingLink = extractFromFlat(['booking_link', 'booking_url', 'booking', 'calendly']) ||
                       extractFromResponses(['booking link', 'booking url', 'booking', 'calendly']);
      
      // If booking_link contains multiple URLs, extract first valid one
      if (bookingLink && bookingLink.includes(' ')) {
        const urls = bookingLink.split(/\s+/).filter(url => url.includes('http') || url.includes('.com'));
        bookingLink = urls[0] || bookingLink;
      }

      // Extract industry
      const industry = extractFromFlat(['industry', 'sector', 'category']) ||
                      extractFromResponses(['industry', 'sector', 'category']);

      // Extract optional fields
      const email = extractFromFlat(['email', 'email_address']) ||
                   extractFromResponses(['email', 'email address', 'e-mail']);

      const phone = extractFromFlat(['phone', 'phone_number', 'telephone']) ||
                   extractFromResponses(['phone', 'phone number', 'telephone']);

      const location = extractFromFlat(['location', 'address', 'city']) ||
                      extractFromResponses(['location', 'address', 'city']);

      const hours = extractFromFlat(['hours', 'business_hours', 'operating_hours']) ||
                   extractFromResponses(['hours', 'business hours', 'operating hours']);

      const tone = extractFromFlat(['tone', 'voice', 'style']) ||
                  extractFromResponses(['tone', 'voice', 'style']);

      // Validation
      if (!igUsername) {
        console.error('Validation error: Instagram username missing', {
          bodyKeys: Object.keys(body),
          hasResponses: Array.isArray(body.responses),
          responsesCount: Array.isArray(body.responses) ? body.responses.length : 0
        });

        const response = {
          success: false,
          message: 'Validation error',
          errors: [{
            path: 'ig_username',
            message: 'Instagram username is required'
          }]
        };
        res.status(400).json(response);
        return;
      }

      // Prepare profile data (map to service interface)
      const profileData = {
        ig_username: igUsername,
        business_name: businessName || igUsername, // Use ig_username as default if business_name is missing
        booking_link: bookingLink || undefined,
        industry: industry || undefined,
        email: email || undefined,
        phone: phone || undefined,
        location: location || undefined,
        hours: hours || undefined,
        tone: tone || undefined,
      };

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
      console.error('Error saving business profile:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        bodyKeys: req.body ? Object.keys(req.body) : []
      });
      
      const response = {
        success: false,
        message: 'Error saving business profile',
        error: error instanceof Error ? error.message : 'Unknown error'
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