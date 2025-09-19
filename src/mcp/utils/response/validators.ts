/**
 * Runtime validators for Response Enhancer types
 */

import { safeLogger } from '../../../logger.js'
import type { ApiResponseData, ISO8601String } from './types.js'

/**
 * Type guard to check if a string is a valid ISO 8601 timestamp
 * Validates the format YYYY-MM-DDTHH:mm:ss.sssZ (UTC timezone required)
 *
 * @param value - The string to validate
 * @returns True if the string is a valid ISO 8601 timestamp
 */
export function isISO8601String(value: string): value is ISO8601String {
  // ISO 8601 regex pattern for UTC timestamps (with optional milliseconds)
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

  if (!iso8601Pattern.test(value)) {
    return false
  }

  // Additional validation: ensure it's a valid date
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return false
  }

  // Check if the input contains milliseconds
  const hasMilliseconds = value.includes('.')

  // Compare appropriately based on whether input has milliseconds
  if (hasMilliseconds) {
    return date.toISOString() === value
  } else {
    // Remove milliseconds from the ISO string for comparison
    return date.toISOString().replace('.000Z', 'Z') === value
  }
}

/**
 * Safely convert a string to ISO8601String with validation
 * Returns the branded type if valid, throws an error if invalid
 *
 * @param value - The string to convert
 * @param context - Optional context for error messages
 * @returns Validated ISO8601String
 * @throws Error if the string is not a valid ISO 8601 timestamp
 */
export function toISO8601String(value: string, context?: string): ISO8601String {
  if (isISO8601String(value)) {
    return value
  }

  const errorMsg = `Invalid ISO 8601 timestamp format: ${value}`
  safeLogger.error(errorMsg, {
    context: context || 'timestamp_validation',
    providedValue: value,
    expectedFormat: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  })

  throw new Error(`${errorMsg}. Expected format: YYYY-MM-DDTHH:mm:ss.sssZ (UTC)`)
}

/**
 * Type guard to check if a value is valid ApiResponseData
 * ApiResponseData is defined as Record<string, unknown>, which is
 * essentially any object that isn't null or an array
 *
 * @param value - The value to check
 * @returns True if value is a valid ApiResponseData object
 */
export function isApiResponseData(value: unknown): value is ApiResponseData {
  // Check if value is an object, not null, and not an array
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Safely convert unknown data to ApiResponseData format
 * Logs a warning if the data is invalid and returns an empty object
 *
 * @param data - The data to convert
 * @param context - Optional context for logging (e.g., operation name)
 * @returns Valid ApiResponseData object
 */
export function toApiResponseData(data: unknown, context?: string): ApiResponseData {
  if (isApiResponseData(data)) {
    return data
  }

  // Log structured warning for invalid data
  const dataType = Array.isArray(data) ? 'array' : typeof data

  safeLogger.warn('Invalid data type for ApiResponseData', {
    context: context || 'unknown',
    expected: 'object',
    actualType: dataType,
    fallbackUsed: true,
  })

  // Return empty object as fallback
  return {}
}
