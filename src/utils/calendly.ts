import { Logger } from './logger.js';

const logger = new Logger();

/**
 * Calendly integration utilities for generating booking links
 * Provides functionality to create dynamic Calendly links based on business data and services
 * 
 * This is currently implemented as a stub that generates example links.
 * In production, integrate with Calendly API or your booking system.
 */

export interface CalendlyLinkOptions {
  service?: string;           // Service type (nails, lashes, facial, etc.)
  duration?: number;          // Appointment duration in minutes
  name?: string;             // Pre-fill customer name
  email?: string;            // Pre-fill customer email
  notes?: string;            // Pre-fill appointment notes
  timezone?: string;         // Customer timezone
  customFields?: Record<string, string>; // Additional custom fields
}

export interface CalendlyConfig {
  calendlyUsername: string;   // Calendly username/organization
  eventType?: string;         // Default event type
  baseUrl?: string;          // Custom Calendly domain if applicable
}

/**
 * Service-specific Calendly event type mappings
 * Maps conversation services to Calendly event types
 */
const SERVICE_EVENT_MAPPINGS: Record<string, string> = {
  'nail services': 'nail-appointment',
  'nails': 'nail-appointment',
  'manicure': 'nail-appointment',
  'pedicure': 'nail-appointment',
  
  'lash services': 'lash-appointment',
  'lashes': 'lash-appointment',
  'eyelashes': 'lash-appointment',
  'lash extension': 'lash-appointment',
  
  'facial treatment': 'facial-appointment',
  'facial': 'facial-appointment',
  'skincare': 'facial-appointment',
  
  'massage therapy': 'massage-appointment',
  'massage': 'massage-appointment',
  'therapeutic massage': 'massage-appointment',
  
  // Default fallback
  'consultation': 'consultation',
  'general': 'general-appointment'
};

/**
 * Generate a Calendly booking link for a specific business and service
 * 
 * @param businessId - Business identifier
 * @param options - Calendly link options
 * @returns Generated Calendly URL or null if generation fails
 * 
 * @example
 * ```typescript
 * const link = await generateCalendlyLink('business-123', {
 *   service: 'nail services',
 *   name: 'Jane Doe',
 *   email: 'jane@example.com'
 * });
 * console.log(link); // https://calendly.com/mybusiness/nail-appointment?name=Jane%20Doe
 * ```
 */
export async function generateCalendlyLink(
  businessId: string,
  options: CalendlyLinkOptions = {}
): Promise<string | null> {
  try {
    // TODO: Implement actual Calendly API integration
    // This would typically involve:
    // 1. Fetch business Calendly configuration from database
    // 2. Map service to appropriate Calendly event type
    // 3. Generate properly formatted Calendly URL with pre-fill parameters
    
    const calendlyConfig = await getBusinessCalendlyConfig(businessId);
    
    if (!calendlyConfig || !calendlyConfig.calendlyUsername) {
      logger.warn('No Calendly configuration found for business', { businessId });
      return null;
    }

    // Determine event type based on service
    const eventType = determineEventType(options.service, calendlyConfig.eventType);
    
    // Build Calendly URL
    const baseUrl = calendlyConfig.baseUrl || 'https://calendly.com';
    const calendlyUrl = new URL(`${baseUrl}/${calendlyConfig.calendlyUsername}/${eventType}`);
    
    // Add pre-fill parameters
    if (options.name) {
      calendlyUrl.searchParams.set('name', options.name);
    }
    
    if (options.email) {
      calendlyUrl.searchParams.set('email', options.email);
    }
    
    if (options.notes || options.service) {
      const notes = options.notes || `Service requested: ${options.service}`;
      calendlyUrl.searchParams.set('a1', notes); // Calendly custom field
    }
    
    if (options.timezone) {
      calendlyUrl.searchParams.set('month', new Date().toISOString().slice(0, 7));
    }

    // Add custom fields
    if (options.customFields) {
      Object.entries(options.customFields).forEach(([key, value], index) => {
        calendlyUrl.searchParams.set(`a${index + 2}`, `${key}: ${value}`);
      });
    }

    const generatedLink = calendlyUrl.toString();
    
    logger.info('Calendly link generated', {
      businessId,
      eventType,
      service: options.service,
      generatedLink
    });
    
    console.log(`📅 [CALENDLY] Generated booking link for ${options.service || 'general service'}:`, {
      businessId,
      eventType,
      link: generatedLink
    });

    return generatedLink;

  } catch (error) {
    logger.error('Failed to generate Calendly link', error instanceof Error ? error : new Error('Unknown error'), {
      businessId,
      options
    });
    return null;
  }
}

/**
 * Get Calendly configuration for a business
 * Currently returns stub data - implement database lookup in production
 * 
 * @param businessId - Business identifier
 * @returns Calendly configuration or null
 */
async function getBusinessCalendlyConfig(businessId: string): Promise<CalendlyConfig | null> {
  // TODO: Implement actual database lookup
  // Example:
  // const business = await prisma.businessProfile.findUnique({
  //   where: { id: businessId },
  //   select: { calendlyUsername: true, calendlyEventType: true }
  // });
  
  // Stub implementation - return example config
  const stubConfig: CalendlyConfig = {
    calendlyUsername: 'mybusiness', // This would come from business settings
    eventType: 'consultation',
    baseUrl: 'https://calendly.com'
  };
  
  console.log(`📋 [CALENDLY-CONFIG] Using stub config for business ${businessId}`);
  return stubConfig;
}

/**
 * Determine appropriate Calendly event type based on requested service
 * 
 * @param service - Service name from conversation
 * @param defaultEventType - Fallback event type
 * @returns Appropriate event type slug
 */
function determineEventType(service?: string, defaultEventType?: string): string {
  if (!service) {
    return defaultEventType || 'consultation';
  }
  
  const serviceKey = service.toLowerCase().trim();
  
  // Check direct mapping
  if (SERVICE_EVENT_MAPPINGS[serviceKey]) {
    return SERVICE_EVENT_MAPPINGS[serviceKey];
  }
  
  // Check partial matches
  for (const [key, eventType] of Object.entries(SERVICE_EVENT_MAPPINGS)) {
    if (serviceKey.includes(key) || key.includes(serviceKey)) {
      return eventType;
    }
  }
  
  // Fallback to default or consultation
  return defaultEventType || 'consultation';
}

/**
 * Validate if a Calendly username/organization exists
 * Currently returns true - implement actual validation in production
 * 
 * @param username - Calendly username to validate
 * @returns Promise resolving to true if valid
 */
export async function validateCalendlyUsername(username: string): Promise<boolean> {
  if (!username || username.trim().length === 0) {
    return false;
  }
  
  // TODO: Implement actual Calendly API validation
  // Example:
  // try {
  //   const response = await fetch(`https://calendly.com/api/users/${username}`);
  //   return response.ok;
  // } catch {
  //   return false;
  // }
  
  console.log(`✅ [CALENDLY-VALIDATION] Would validate username: ${username}`);
  return true; // Assume valid for now
}