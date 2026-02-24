import { Logger } from '../utils/logger.js';

const logger = new Logger();

/**
 * Analytics service for tracking conversation events and user interactions.
 * This service provides event tracking functionality that can be integrated
 * with various analytics providers (Google Analytics, Mixpanel, etc.).
 * 
 * Currently implemented as a stub that logs events to console.
 * In production, replace the implementation to send events to your analytics provider.
 */

export interface AnalyticsEvent {
  businessId: string;
  eventName: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Available event names for conversation tracking
 */
export const CONVERSATION_EVENTS = {
  CONVERSATION_STARTED: 'conversation_started',
  QUALIFIED: 'qualified',
  BOOK_LINK_CLICKED: 'book_link_clicked',
  BOOK_CALENDLY_GENERATED: 'book_calendly_generated',
  BOOK_FALLBACK: 'book_fallback',
  VIEWED_PRICES: 'viewed_prices',
  VIEWED_LOCATION: 'viewed_location',
  FOLLOW_UP_SENT: 'follow_up_sent',
  CONVERSATION_ENDED: 'conversation_ended',
} as const;

export type ConversationEventName = typeof CONVERSATION_EVENTS[keyof typeof CONVERSATION_EVENTS];

/**
 * Track a conversation or business event for analytics
 * 
 * @param businessId - Unique identifier for the business
 * @param eventName - Name of the event to track
 * @param metadata - Additional event data and context
 * 
 * @example
 * ```typescript
 * await trackEvent('business-123', 'conversation_started', {
 *   source: 'instagram',
 *   customerLocation: 'New York'
 * });
 * ```
 */
export async function trackEvent(
  businessId: string,
  eventName: ConversationEventName | string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const event: AnalyticsEvent = {
      businessId,
      eventName,
      metadata,
      timestamp: new Date()
    };

    // Log event for debugging (replace with actual analytics service in production)
    logger.info('Analytics Event Tracked', {
      event,
      type: 'analytics_event'
    });

    // TODO: Implement actual analytics provider integration
    // Examples:
    // - Google Analytics 4: gtag('event', eventName, metadata)
    // - Mixpanel: mixpanel.track(eventName, { businessId, ...metadata })
    // - Custom API: await fetch('/api/analytics/track', { method: 'POST', body: JSON.stringify(event) })
    
    console.log(`📊 [ANALYTICS] ${eventName}:`, {
      businessId,
      metadata,
      timestamp: event.timestamp
    });

  } catch (error) {
    logger.error('Failed to track analytics event', error instanceof Error ? error : new Error('Unknown error'), {
      businessId,
      eventName,
      metadata
    });
    // Don't throw - analytics failures shouldn't break the conversation flow
  }
}

/**
 * Track multiple events in batch for performance
 * 
 * @param events - Array of events to track
 */
export async function trackEvents(events: AnalyticsEvent[]): Promise<void> {
  await Promise.allSettled(
    events.map(event => trackEvent(event.businessId, event.eventName, event.metadata))
  );
}