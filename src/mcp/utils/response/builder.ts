/**
 * Main response enhancement builder for Response Enhancer
 */

import { formatCurrency } from '../currency-formatter.js'
import { formatDate } from '../date/formatter.js'
import {
  extractBookingDetails,
  extractMessageDetails,
  extractPaymentLinkDetails,
  extractRateDetails,
  extractWebhookDetails,
} from '../entity-extractors.js'
import { getNestedValue, getString, getStringOrNumber } from '../helpers.js'
import { generateSuggestions } from '../suggestion-generator.js'
import { generateSummary } from '../summary-generator.js'
import type { ApiResponseData, EnhancedResponse, EnhanceOptions, EntityType } from './types.js'
import { toApiResponseData, toISO8601String } from './validators.js'

/**
 * Extracts entity-specific details from API data
 */
export function extractEntityDetails(
  entityType: EntityType,
  apiData: ApiResponseData,
  inputParams?: ApiResponseData,
): ApiResponseData {
  let details: ApiResponseData = {}

  switch (entityType) {
    case 'booking':
      details = extractBookingDetails(apiData, inputParams)
      break
    case 'payment_link':
      details = extractPaymentLinkDetails(apiData, inputParams)
      break
    case 'quote': {
      // For quotes, we need special handling because data.id is the quote ID, not booking ID
      const baseDetails = extractBookingDetails(apiData, inputParams)
      // Override bookingId to prefer inputParams.bookingId over data.id for quotes
      const bookingId = getStringOrNumber(inputParams?.bookingId) || baseDetails.bookingId
      details = {
        ...baseDetails,
        bookingId, // This ensures we use the bookingId from inputParams if available
        quoteId: getStringOrNumber(apiData.quoteId) || getStringOrNumber(apiData.id),
        totalPrice: formatCurrency(
          (getNestedValue(apiData, 'totalPrice') as number | undefined) ||
            (getNestedValue(inputParams, 'payload.totalPrice') as number | undefined),
          getString(apiData.currency) || getString(getNestedValue(inputParams, 'payload.currency')),
        ),
        validUntil: formatDate(
          getString(apiData.validUntil) ||
            getString(getNestedValue(inputParams, 'payload.validUntil')),
          true,
        ),
      }
      break
    }
    case 'rate':
      details = extractRateDetails(apiData, inputParams)
      break
    case 'webhook':
      details = extractWebhookDetails(apiData, inputParams)
      break
    case 'message':
      details = extractMessageDetails(apiData, inputParams)
      break
    case 'thread':
      details = {
        threadId: getStringOrNumber(inputParams?.threadGuid) || getStringOrNumber(apiData.threadId),
        action: getString(inputParams?.action) || 'updated',
      }
      break
    case 'key_codes': {
      const keyCodes = getNestedValue(inputParams, 'payload.keyCodes')
      details = {
        bookingId: getStringOrNumber(inputParams?.id) || getStringOrNumber(apiData.bookingId),
        codesUpdated: Array.isArray(keyCodes) ? keyCodes.length : 0,
        codes: Array.isArray(keyCodes) ? keyCodes : [],
      }
      break
    }
    default: {
      // Generic details extraction
      const id = getStringOrNumber(apiData.id) // Handle numeric IDs
      const name = getString(apiData.name)
      const statusValue = getString(apiData.status)
      if (id) details.id = id
      if (name) details.name = name
      if (statusValue) details.status = statusValue
    }
  }

  return details
}

/**
 * Main function to enhance API responses with context
 */
export function enhanceResponse(data: unknown, options: EnhanceOptions): EnhancedResponse {
  const {
    operationType,
    entityType,
    status = 'success',
    inputParams,
    customSuggestions,
    customWarnings,
  } = options

  // Safely convert data to ApiResponseData format with validation
  const apiData = toApiResponseData(data, `${operationType} ${entityType}`)

  // Extract details based on entity type
  const details = extractEntityDetails(entityType, apiData, inputParams)

  // Generate summary
  const summary = generateSummary(operationType, entityType, details, status)

  // Generate suggestions
  const suggestions = customSuggestions || generateSuggestions(operationType, entityType, details)

  // Build enhanced response
  const enhancedResponse: EnhancedResponse = {
    operation: {
      type: operationType,
      entity: entityType,
      status,
      timestamp: toISO8601String(new Date().toISOString(), 'response_builder'),
    },
    summary,
    details,
    data: apiData,
  }

  // Add suggestions if any
  if (suggestions.length > 0) {
    enhancedResponse.suggestions = suggestions
  }

  // Add warnings if any
  if (customWarnings && customWarnings.length > 0) {
    enhancedResponse.warnings = customWarnings
  }

  return enhancedResponse
}

/**
 * Helper to format the enhanced response for MCP output
 */
export function formatMcpResponse(enhanced: EnhancedResponse): string {
  return JSON.stringify(enhanced, null, 2)
}
