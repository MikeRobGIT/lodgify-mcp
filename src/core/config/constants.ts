/**
 * Configuration Constants
 * Centralized configuration for all system constants and limits
 */

/**
 * Pagination Limits
 */
export const PAGINATION = {
  /** Default number of items per page */
  DEFAULT_PAGE_SIZE: 50,
  /** Maximum number of items per page for most endpoints */
  MAX_PAGE_SIZE: 50,
  /** Maximum page number to prevent excessive pagination */
  MAX_PAGE_NUMBER: 10000,
  /** Default limit for vacant inventory queries */
  DEFAULT_VACANT_INVENTORY_LIMIT: 25,
  /** Maximum limit for vacant inventory queries */
  MAX_VACANT_INVENTORY_LIMIT: 200,
  /** Default limit for property searches */
  DEFAULT_PROPERTY_SEARCH_LIMIT: 10,
  /** Maximum limit for property searches */
  MAX_PROPERTY_SEARCH_LIMIT: 50,
} as const

/**
 * Guest Count Limits
 */
export const GUEST_LIMITS = {
  /** Minimum number of adults required */
  MIN_ADULTS: 1,
  /** Maximum number of adults allowed */
  MAX_ADULTS: 50,
  /** Maximum number of children allowed */
  MAX_CHILDREN: 50,
  /** Maximum number of infants allowed */
  MAX_INFANTS: 20,
  /** Maximum total guest count allowed */
  MAX_TOTAL_GUESTS: 100,
} as const

/**
 * String Length Limits
 */
export const STRING_LIMITS = {
  /** Maximum length for general string inputs */
  MAX_STRING_LENGTH: 10000,
  /** Maximum length for property IDs */
  MAX_PROPERTY_ID_LENGTH: 100,
  /** Maximum length for payment descriptions */
  MAX_PAYMENT_DESCRIPTION_LENGTH: 500,
  /** Maximum length for currency codes */
  CURRENCY_CODE_LENGTH: 3,
} as const

/**
 * Date Range Limits
 */
export const DATE_LIMITS = {
  /** Maximum date range in days (5 years) */
  MAX_DATE_RANGE_DAYS: 365 * 5,
  /** Maximum past days for availability queries */
  MAX_PAST_DAYS_AVAILABILITY: 365,
  /** Maximum future days for availability queries */
  MAX_FUTURE_DAYS_AVAILABILITY: 365 * 2,
  /** Maximum past days for bookings */
  MAX_PAST_DAYS_BOOKING: 365 * 2,
  /** Maximum future days for bookings */
  MAX_FUTURE_DAYS_BOOKING: 365 * 3,
} as const

/**
 * Price Limits
 */
export const PRICE_LIMITS = {
  /** Minimum price value (must be non-negative) */
  MIN_PRICE: 0,
  /** Maximum price value */
  MAX_PRICE: 1000000,
  /** Maximum decimal places for prices */
  MAX_PRICE_DECIMAL_PLACES: 2,
} as const

/**
 * Session & Timeout Configuration
 */
export const SESSION_CONFIG = {
  /** Session TTL in milliseconds (30 minutes) */
  SESSION_TTL_MS: 30 * 60 * 1000,
  /** Default request timeout in milliseconds */
  DEFAULT_REQUEST_TIMEOUT_MS: 30000,
  /** Maximum request timeout in milliseconds */
  MAX_REQUEST_TIMEOUT_MS: 120000,
} as const

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONFIG = {
  /** Maximum retry attempts */
  MAX_RETRY_ATTEMPTS: 5,
  /** Maximum backoff time in seconds */
  MAX_BACKOFF_SECONDS: 30,
  /** Minimum wait time in milliseconds */
  MIN_WAIT_TIME_MS: 1000,
} as const

/**
 * Messaging Limits
 */
export const MESSAGING_LIMITS = {
  /** Minimum message limit per thread */
  MIN_MESSAGE_LIMIT: 1,
  /** Maximum message limit per thread */
  MAX_MESSAGE_LIMIT: 200,
} as const

/**
 * Webhook Configuration
 */
export const WEBHOOK_CONFIG = {
  /** Valid webhook event types */
  VALID_EVENTS: [
    'rate_change',
    'availability_change',
    'booking_new_any_status',
    'booking_new_status_booked',
    'booking_change',
    'booking_status_change_booked',
    'booking_status_change_tentative',
    'booking_status_change_open',
    'booking_status_change_declined',
    'guest_message_received',
  ] as const,
} as const

/**
 * Booking Configuration
 */
export const BOOKING_CONFIG = {
  /** Valid booking statuses */
  VALID_STATUSES: ['booked', 'tentative', 'declined', 'confirmed', 'open'] as const,
  /** Default stay filter for booking queries */
  DEFAULT_STAY_FILTER: 'Upcoming' as const,
  /** Valid stay filter options */
  VALID_STAY_FILTERS: [
    'Upcoming',
    'Current',
    'Historic',
    'All',
    'ArrivalDate',
    'DepartureDate',
  ] as const,
} as const

/**
 * Helper function to get configuration value with optional override
 */
export function getConfigValue<T>(value: T, override?: T): T {
  return override !== undefined ? override : value
}
