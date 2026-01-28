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

  /**
   * Fillout webhook handler - robust extraction for any payload structure
   * POST /api/fillout-webhook
   */
  static async handleFilloutWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      
      // Log full payload for debugging
      console.log('Fillout webhook received:', JSON.stringify(payload, null, 2));

      // Helper function to normalize Instagram username
      const normalizeInstagramUsername = (value: any): string | undefined => {
        if (!value) return undefined;
        
        let username = String(value).trim().toLowerCase();
        
        // Remove @ symbol if present
        if (username.startsWith('@')) {
          username = username.substring(1);
        }
        
        return username || undefined;
      };

      // Helper function to search for Instagram username in nested objects/arrays
      const searchForInstagramInAnswers = (answers: any[]): string | undefined => {
        if (!Array.isArray(answers)) return undefined;
        
        for (const answer of answers) {
          if (!answer || typeof answer !== 'object') continue;
          
          // Check if field name/label contains "instagram"
          const labelKeys = ['field', 'label', 'question', 'name', 'title'];
          const valueKeys = ['value', 'answer', 'response', 'data'];
          
          let fieldLabel = '';
          let fieldValue = undefined;
          
          // Extract field label
          for (const key of labelKeys) {
            if (answer[key]) {
              fieldLabel = String(answer[key]).toLowerCase();
              break;
            }
          }
          
          // Extract field value
          for (const key of valueKeys) {
            if (answer[key] !== undefined && answer[key] !== null) {
              fieldValue = answer[key];
              break;
            }
          }
          
          // Check if this field is about Instagram
          if (fieldLabel.includes('instagram') || fieldLabel.includes('ig')) {
            const normalized = normalizeInstagramUsername(fieldValue);
            if (normalized) return normalized;
          }
        }
        
        return undefined;
      };

      // Safe extraction with multiple fallback strategies
      let igUsername: string | undefined;
      
      // Strategy 1: Direct properties
      igUsername = normalizeInstagramUsername(payload.ig_username) ||
                  normalizeInstagramUsername(payload.instagram_username) ||
                  normalizeInstagramUsername(payload.instagram) ||
                  normalizeInstagramUsername(payload.ig);
      
      // Strategy 2: Check answers array at root level
      if (!igUsername && payload.answers) {
        igUsername = searchForInstagramInAnswers(payload.answers);
      }
      
      // Strategy 3: Check submission.answers
      if (!igUsername && payload.submission?.answers) {
        igUsername = searchForInstagramInAnswers(payload.submission.answers);
      }
      
      // Strategy 4: Check data.answers
      if (!igUsername && payload.data?.answers) {
        igUsername = searchForInstagramInAnswers(payload.data.answers);
      }
      
      // Strategy 5: Check responses array (from previous implementation)
      if (!igUsername && payload.responses) {
        igUsername = searchForInstagramInAnswers(payload.responses);
      }
      
      // Strategy 6: Search entire payload for strings containing "@"
      if (!igUsername) {
        const searchForAtSymbol = (obj: any): string | undefined => {
          if (typeof obj === 'string' && obj.includes('@') && obj.length < 50) {
            // Potential Instagram username
            const normalized = normalizeInstagramUsername(obj);
            if (normalized && normalized.length > 0) return normalized;
          }
          
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const result = searchForAtSymbol(item);
              if (result) return result;
            }
          }
          
          if (obj && typeof obj === 'object') {
            for (const value of Object.values(obj)) {
              const result = searchForAtSymbol(value);
              if (result) return result;
            }
          }
          
          return undefined;
        };
        
        igUsername = searchForAtSymbol(payload);
      }

      // If no Instagram username found, return success with message
      if (!igUsername) {
        console.log('Fillout webhook: Instagram username not found in payload');
        res.status(200).json({
          success: false,
          message: 'ig_username not found'
        });
        return;
      }

      // Extract other fields with safe fallback
      const extractField = (primaryKeys: string[], answerLabels: string[]): string | undefined => {
        // Try direct properties first
        for (const key of primaryKeys) {
          if (payload[key]) {
            const value = String(payload[key]).trim();
            if (value) return value;
          }
        }
        
        // Search in answers arrays
        const searchInAnswers = (answers: any[]): string | undefined => {
          if (!Array.isArray(answers)) return undefined;
          
          for (const answer of answers) {
            if (!answer || typeof answer !== 'object') continue;
            
            const labelKeys = ['field', 'label', 'question', 'name', 'title'];
            const valueKeys = ['value', 'answer', 'response', 'data'];
            
            let fieldLabel = '';
            let fieldValue = undefined;
            
            for (const key of labelKeys) {
              if (answer[key]) {
                fieldLabel = String(answer[key]).toLowerCase();
                break;
              }
            }
            
            for (const key of valueKeys) {
              if (answer[key] !== undefined && answer[key] !== null) {
                fieldValue = answer[key];
                break;
              }
            }
            
            for (const label of answerLabels) {
              if (fieldLabel.includes(label.toLowerCase())) {
                const value = String(fieldValue || '').trim();
                if (value) return value;
              }
            }
          }
          
          return undefined;
        };
        
        // Search in various possible locations
        return searchInAnswers(payload.answers) ||
               searchInAnswers(payload.submission?.answers) ||
               searchInAnswers(payload.data?.answers) ||
               searchInAnswers(payload.responses);
      };

      // Extract business fields
      const businessName = extractField(
        ['business_name', 'company_name', 'name'],
        ['business name', 'company name', 'business', 'company']
      );
      
      const bookingLink = extractField(
        ['booking_link', 'booking_url', 'booking'],
        ['booking link', 'booking url', 'booking', 'calendar', 'calendly']
      );
      
      const industry = extractField(
        ['industry', 'sector'],
        ['industry', 'sector', 'category', 'business type']
      );
      
      const email = extractField(
        ['email', 'email_address'],
        ['email', 'email address', 'e-mail']
      );
      
      const phone = extractField(
        ['phone', 'phone_number'],
        ['phone', 'phone number', 'telephone', 'mobile']
      );
      
      const location = extractField(
        ['location', 'address'],
        ['location', 'address', 'city', 'where']
      );

      // Prepare data for database
      const profileData = {
        ig_username: igUsername,
        business_name: businessName || igUsername, // Use ig_username as fallback
        booking_link: bookingLink || undefined,
        industry: industry || undefined,
        email: email || undefined,
        phone: phone || undefined,
        location: location || undefined,
        hours: undefined,
        tone: undefined,
      };

      console.log('Fillout webhook: Extracted data:', profileData);

      // Upsert business profile
      await BusinessProfileService.upsertBusinessProfile(profileData);

      console.log(`Fillout webhook: Successfully saved business profile for @${igUsername}`);

      // Always return 200 OK for webhooks
      res.status(200).json({
        success: true
      });

    } catch (error) {
      console.error('Fillout webhook error:', error);
      
      // Always return 200 OK for webhooks, even on error
      res.status(200).json({
        success: true
      });
    }
  }
}