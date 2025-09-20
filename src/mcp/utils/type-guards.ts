/**
 * Type guard utilities for runtime type checking
 * Provides safe type validation without unsafe type assertions
 */

import type { PropertiesListResponse } from '../../api/v2/properties/types.js'
import type { ApiResponseData } from './response/types.js'

/**
 * Type guard to check if a value is a PropertiesListResponse
 */
export function isPropertiesListResponse(value: unknown): value is PropertiesListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray((value as Record<string, unknown>).data)
  )
}

/**
 * Type guard to check if a value has pagination information
 */
export function hasPagination(value: unknown): value is { pagination: { hasNext?: boolean } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pagination' in value &&
    typeof (value as Record<string, unknown>).pagination === 'object' &&
    (value as Record<string, unknown>).pagination !== null
  )
}

/**
 * Type guard to check if a value is a valid API response data structure
 */
export function isApiResponseData(value: unknown): value is ApiResponseData {
  return typeof value === 'object' && value !== null
}

/**
 * Safe getter for pagination hasNext property
 */
export function getPaginationHasNext(value: unknown): boolean {
  if (!hasPagination(value)) {
    return false
  }

  const pagination = value.pagination
  if ('hasNext' in pagination) {
    return Boolean(pagination.hasNext)
  }

  return false
}

/**
 * Transform unknown response to ApiResponseData safely
 */
export function toApiResponseData(value: unknown): ApiResponseData {
  if (isApiResponseData(value)) {
    return value
  }

  // Return a safe default structure
  return {
    data: value,
    error: 'Invalid response structure',
  }
}
