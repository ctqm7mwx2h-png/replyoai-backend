/**
 * URL validation utilities for booking links and external URLs
 * Provides robust URL validation with support for common booking platforms
 */

/**
 * Common booking platform domains that we consider valid and trusted
 */
const TRUSTED_BOOKING_DOMAINS = [
  'calendly.com',
  'acuityscheduling.com',
  'booksy.com',
  'square.com',
  'schedulicity.com',
  'setmore.com',
  'appointmentplus.com',
  'timely.com',
  'fresha.com',
  'genbook.com'
];

/**
 * Validate if a URL is properly formatted and accessible
 * 
 * @param url - URL string to validate
 * @param options - Validation options
 * @returns True if URL is valid, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = validateUrl('https://calendly.com/mybusiness/appointment');
 * console.log(isValid); // true
 * 
 * const isInvalid = validateUrl('not-a-url');
 * console.log(isInvalid); // false
 * ```
 */
export function validateUrl(
  url: string,
  options: {
    requireHttps?: boolean;
    allowedDomains?: string[];
    checkReachability?: boolean;
  } = {}
): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url.trim());

    // Check protocol
    if (options.requireHttps !== false && urlObj.protocol !== 'https:') {
      // Allow http only if explicitly allowed
      if (options.requireHttps === true || urlObj.protocol !== 'http:') {
        return false;
      }
    }

    // Check if domain is in allowed list
    if (options.allowedDomains && options.allowedDomains.length > 0) {
      const hostname = urlObj.hostname.toLowerCase();
      const isAllowed = options.allowedDomains.some(domain => 
        hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`)
      );
      
      if (!isAllowed) {
        return false;
      }
    }

    // Check for suspicious or malicious patterns
    if (containsMaliciousPatterns(url)) {
      return false;
    }

    return true;

  } catch (error) {
    // Invalid URL format
    return false;
  }
}

/**
 * Validate if a booking URL is from a trusted booking platform
 * 
 * @param url - Booking URL to validate
 * @returns True if URL is from a trusted booking platform
 */
export function validateBookingUrl(url: string): boolean {
  return validateUrl(url, {
    requireHttps: true,
    allowedDomains: TRUSTED_BOOKING_DOMAINS
  });
}

/**
 * Check if URL contains suspicious patterns that might indicate malicious intent
 * 
 * @param url - URL to check
 * @returns True if suspicious patterns detected
 */
function containsMaliciousPatterns(url: string): boolean {
  const suspiciousPatterns = [
    // Common phishing patterns
    /bit\.ly|tinyurl|t\.co/i,
    // Suspicious subdomains
    /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/,
    // Common spam patterns
    /free|win|claim|urgent|limited/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(url));
}

/**
 * Normalize and clean a URL for consistent usage
 * 
 * @param url - URL to normalize
 * @returns Cleaned URL or null if invalid
 */
export function normalizeUrl(url: string): string | null {
  if (!validateUrl(url)) {
    return null;
  }

  try {
    const urlObj = new URL(url.trim());
    
    // Remove trailing slashes and fragments
    urlObj.hash = '';
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    return urlObj.toString();
  } catch {
    return null;
  }
}

/**
 * Check if URL is reachable (async version for production use)
 * Currently returns true - implement actual HTTP check in production
 * 
 * @param url - URL to check
 * @returns Promise resolving to true if reachable
 */
export async function isUrlReachable(url: string): Promise<boolean> {
  if (!validateUrl(url)) {
    return false;
  }

  // TODO: Implement actual reachability check
  // Example implementation:
  // try {
  //   const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
  //   return response.ok;
  // } catch {
  //   return false;
  // }
  
  console.log(`🔗 [URL-CHECK] Would check reachability for: ${url}`);
  return true; // Assume reachable for now
}