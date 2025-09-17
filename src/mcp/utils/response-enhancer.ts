/**
 * Response Enhancer Utility
 * Provides contextual enhancement for API responses to improve user experience
 */

/**
 * Generic type for API response data
 */
export type ApiResponseData = Record<string, unknown>

/**
 * Helper to safely get a nested property value
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Helper to safely get a string value
 */
function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Helper to safely get a number value
 */
function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

/**
 * Helper to safely get a string or convert number to string
 * This is useful for IDs that might be returned as numbers from the API
 */
function getStringOrNumber(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toString()
  return undefined
}

/**
 * Operation types for API interactions
 */
export type OperationType = 'create' | 'update' | 'delete' | 'action'

/**
 * Entity types in the Lodgify system
 */
export type EntityType =
  | 'booking'
  | 'payment_link'
  | 'quote'
  | 'rate'
  | 'webhook'
  | 'message'
  | 'thread'
  | 'key_codes'

/**
 * Status of the operation
 */
export type OperationStatus = 'success' | 'partial' | 'failed'

/**
 * Enhanced response structure
 */
export interface EnhancedResponse {
  operation: {
    type: OperationType
    entity: EntityType
    status: OperationStatus
    timestamp: string
  }
  summary: string
  details: ApiResponseData
  suggestions?: string[]
  warnings?: string[]
  data: ApiResponseData // Original API response
}

/**
 * Options for enhancing a response
 */
export interface EnhanceOptions {
  operationType: OperationType
  entityType: EntityType
  status?: OperationStatus
  inputParams?: ApiResponseData
  customSuggestions?: string[]
  customWarnings?: string[]
}

/**
 * Comprehensive currency symbols mapping
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  // Major currencies
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  // Commonwealth currencies
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  // European currencies
  CHF: 'Fr.',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  // Asian currencies
  INR: '₹',
  KRW: '₩',
  THB: '฿',
  SGD: 'S$',
  HKD: 'HK$',
  TWD: 'NT$',
  PHP: '₱',
  IDR: 'Rp',
  MYR: 'RM',
  VND: '₫',
  // Middle East & Africa
  AED: 'د.إ',
  SAR: '﷼',
  ILS: '₪',
  ZAR: 'R',
  EGP: 'E£',
  // Americas
  BRL: 'R$',
  MXN: '$',
  ARS: '$',
  COP: '$',
  CLP: '$',
  PEN: 'S/',
  // Other
  RUB: '₽',
  TRY: '₺',
  UAH: '₴',
}

/**
 * Format currency values with expanded symbol support
 */
export function formatCurrency(amount: number | undefined, currency?: string): string {
  if (amount === undefined || amount === null) return 'N/A'

  const targetCurrency = currency || 'USD'

  try {
    const formatted = amount.toLocaleString('en-US', {
      style: 'currency',
      currency: targetCurrency,
    })

    // Check if the formatter used the generic currency symbol
    // This happens for unknown currency codes
    if (formatted.includes('¤')) {
      // Try to use a known symbol from our mapping
      const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency
      const plainFormatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return `${symbol} ${plainFormatted}`
    }

    return formatted
  } catch (e) {
    // Fallback for invalid currency codes, which throw a RangeError
    if (e instanceof RangeError) {
      // Try to use a known symbol from our mapping
      const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency
      const formatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return `${symbol} ${formatted}`
    }
    // Re-throw other errors
    throw e
  }
}

/**
 * Format date for display
 */
export function formatDate(date: string | undefined | unknown, includeTime = false): string {
  const dateStr = getString(date)
  if (!dateStr) return 'N/A'

  try {
    const dateObj = new Date(dateStr)
    if (Number.isNaN(dateObj.getTime())) return dateStr // Return original if invalid

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }

    if (includeTime) {
      options.hour = '2-digit'
      options.minute = '2-digit'
    }

    return dateObj.toLocaleDateString('en-US', options)
  } catch {
    return dateStr // Return original on error
  }
}

/**
 * Calculate nights between dates
 * Handles timezone edge cases by normalizing to UTC midnight
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  try {
    // Parse dates and normalize to UTC midnight to avoid timezone issues
    const start = new Date(checkIn)
    const end = new Date(checkOut)

    // Check for invalid dates
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 0
    }

    // Normalize to UTC midnight to handle cross-timezone calculations
    // This ensures consistent behavior regardless of local timezone
    const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())

    const diffTime = endUTC - startUTC
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    // Ensure non-negative result
    return Math.max(0, diffDays)
  } catch {
    return 0
  }
}

/**
 * Generate operation summary based on type and entity
 */
function generateSummary(
  operationType: OperationType,
  entityType: EntityType,
  details: ApiResponseData,
  status: OperationStatus = 'success',
): string {
  const statusText =
    status === 'success' ? 'Successfully' : status === 'partial' ? 'Partially' : 'Failed to'

  switch (operationType) {
    case 'create':
      switch (entityType) {
        case 'booking':
          return `${statusText} created booking ${details.bookingId || 'new'} for ${details.guest || 'guest'}`
        case 'payment_link':
          return `${statusText} created payment link for ${details.amount || 'booking'}`
        case 'quote': {
          // For quotes, prefer the bookingId from details (which comes from inputParams)
          const bookingId = details.bookingId
          if (bookingId) {
            return `${statusText} created quote for booking ${bookingId}`
          }
          return `${statusText} created quote ${details.quoteId || ''}`.trim()
        }
        case 'webhook':
          return `${statusText} subscribed to ${details.event || 'event'} webhook`
        case 'message':
          return `${statusText} sent message to ${details.recipient || 'recipient'}`
        default:
          return `${statusText} created ${entityType}`
      }

    case 'update':
      switch (entityType) {
        case 'booking':
          return `${statusText} updated booking ${details.bookingId || ''}`
        case 'rate':
          return `${statusText} updated rates for ${details.property || 'property'}`
        case 'key_codes':
          return `${statusText} updated access codes for booking ${details.bookingId || ''}`
        case 'thread':
          return `${statusText} marked thread as ${details.action || 'updated'}`
        default:
          return `${statusText} updated ${entityType}`
      }

    case 'delete':
      switch (entityType) {
        case 'booking':
          return `${statusText} deleted booking ${details.bookingId || ''}`
        case 'webhook':
          return `${statusText} unsubscribed from webhook ${details.webhookId || ''}`
        default:
          return `${statusText} deleted ${entityType}`
      }

    case 'action':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${details.action || 'performed action on'} booking ${details.bookingId || ''}`
        case 'thread':
          return `${statusText} ${details.action || 'performed action on'} thread`
        default:
          return `${statusText} performed action on ${entityType}`
      }

    default:
      return `${statusText} processed ${entityType}`
  }
}

/**
 * Generate contextual suggestions based on entity and operation
 */
function generateSuggestions(
  operationType: OperationType,
  entityType: EntityType,
  details: ApiResponseData,
): string[] {
  const suggestions: string[] = []

  switch (entityType) {
    case 'booking':
      if (operationType === 'create') {
        suggestions.push(
          `Send confirmation email to ${details.guestEmail || 'guest'}`,
          'Create payment link for deposit or full payment',
          'Update property access codes for check-in',
          'Review and confirm room availability',
          'Add any special guest requirements or notes',
        )
      } else if (operationType === 'update') {
        suggestions.push(
          'Notify guest of booking changes',
          'Update payment amount if dates changed',
          'Verify room availability for new dates',
          'Review cancellation policy',
        )
      } else if (operationType === 'delete') {
        suggestions.push(
          'Send cancellation confirmation to guest',
          'Process any refunds if applicable',
          'Update property availability calendar',
          'Review cancellation reason for improvements',
        )
      }
      break

    case 'payment_link':
      suggestions.push(
        'Send payment link to guest via email',
        'Set reminder for payment follow-up',
        'Monitor payment status',
        'Prepare receipt for completed payment',
      )
      break

    case 'quote':
      suggestions.push(
        'Review quote with guest',
        'Set expiration reminder',
        'Follow up if quote not accepted',
        'Prepare contract once accepted',
      )
      break

    case 'rate':
      suggestions.push(
        'Update property listings with new rates',
        'Notify existing bookings if affected',
        'Review competitor pricing',
        'Update seasonal rate strategies',
      )
      break

    case 'webhook':
      if (operationType === 'create') {
        suggestions.push(
          'Test webhook endpoint connectivity',
          'Configure webhook event handling',
          'Set up monitoring for webhook failures',
          'Document webhook integration',
        )
      }
      break

    case 'message':
      suggestions.push(
        'Monitor for guest reply',
        'Set follow-up reminder if needed',
        'Update booking notes with communication',
        'Escalate if urgent response required',
      )
      break

    case 'key_codes':
      suggestions.push(
        'Send access codes to guest before check-in',
        'Test access codes if possible',
        'Set reminder to reset codes after checkout',
        'Document backup entry method',
      )
      break
  }

  return suggestions
}

/**
 * Extract booking details from response
 */
function extractBookingDetails(
  data: ApiResponseData,
  inputParams?: ApiResponseData,
): ApiResponseData {
  const details: ApiResponseData = {}

  // Handle both response formats (with 'id' or specific fields)
  // Use getStringOrNumber for IDs since API returns numeric IDs
  details.bookingId =
    getStringOrNumber(data.id) ||
    getStringOrNumber(data.bookingId) ||
    getStringOrNumber(data.booking_id) ||
    getStringOrNumber(inputParams?.id) ||
    getStringOrNumber(inputParams?.bookingId) // Also check for bookingId in inputParams (used by quote creation)
  details.guest =
    getString(data.guest_name) ||
    getString(data.guestName) ||
    getString(inputParams?.guest_name) ||
    'Guest'
  details.guestEmail =
    getString(data.guest_email) || getString(data.guestEmail) || getString(inputParams?.guest_email)

  const propertyName = getString(data.propertyName) || getString(data.property_name)
  const propertyId =
    getStringOrNumber(data.property_id) ||
    getStringOrNumber(data.propertyId) ||
    getStringOrNumber(inputParams?.property_id)
  details.property = propertyName || (propertyId ? `Property ${propertyId}` : 'Property')
  details.propertyId = propertyId

  // Format dates
  const checkIn =
    getString(data.arrival) || getString(data.checkIn) || getString(inputParams?.arrival)
  const checkOut =
    getString(data.departure) || getString(data.checkOut) || getString(inputParams?.departure)

  if (checkIn) details.checkIn = formatDate(checkIn)
  if (checkOut) details.checkOut = formatDate(checkOut)
  if (checkIn && checkOut) {
    details.nights = calculateNights(checkIn, checkOut)
  }

  // Guest counts
  const adults = getNumber(data.adults) || getNumber(inputParams?.adults)
  const children = getNumber(data.children) || getNumber(inputParams?.children) || 0
  const infants = getNumber(data.infants) || getNumber(inputParams?.infants) || 0
  const totalGuests = (adults || 0) + children + infants

  if (totalGuests > 0) {
    details.totalGuests = totalGuests
    if (adults) details.adults = adults
    if (children > 0) details.children = children
    if (infants > 0) details.infants = infants
  }

  // Financial details
  const amount = getNumber(data.amount) || getNumber(data.totalAmount)
  const currency = getString(data.currency)
  if (amount !== undefined) {
    details.amount = formatCurrency(amount, currency)
  }

  // Status
  const status = getString(data.status)
  if (status) {
    details.status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  }

  // Room details
  const roomTypeId =
    getStringOrNumber(data.room_type_id) || getStringOrNumber(inputParams?.room_type_id)
  if (roomTypeId) {
    details.roomTypeId = roomTypeId
  }

  return details
}

/**
 * Extract payment link details
 */
function extractPaymentLinkDetails(
  data: ApiResponseData,
  inputParams?: ApiResponseData,
): ApiResponseData {
  const details: ApiResponseData = {}

  // Handle numeric booking IDs
  details.bookingId = getStringOrNumber(inputParams?.id) || getStringOrNumber(data.bookingId)
  const payloadAmount = getNumber(getNestedValue(inputParams, 'payload.amount'))
  const payloadCurrency = getString(getNestedValue(inputParams, 'payload.currency'))
  details.amount = formatCurrency(
    getNumber(data.amount) || payloadAmount,
    getString(data.currency) || payloadCurrency,
  )
  details.currency = getString(data.currency) || payloadCurrency || 'USD'

  const paymentUrl = getString(data.paymentUrl) || getString(data.url)
  if (paymentUrl) {
    details.paymentUrl = paymentUrl
  }

  const expiresAt = getString(data.expiresAt) || getString(data.validUntil)
  if (expiresAt) {
    details.expiresAt = formatDate(expiresAt, true)
  }

  const payloadDescription = getString(getNestedValue(inputParams, 'payload.description'))
  details.description = getString(data.description) || payloadDescription || 'Payment for booking'

  return details
}

/**
 * Extract rate details
 */
function extractRateDetails(data: ApiResponseData, inputParams?: ApiResponseData): ApiResponseData {
  const details: ApiResponseData = {}

  // Handle numeric property IDs
  const propertyId =
    getStringOrNumber(inputParams?.property_id) || getStringOrNumber(data.propertyId)
  details.property = propertyId ? `Property ${propertyId}` : 'Property'

  const rates = inputParams?.rates
  if (rates && Array.isArray(rates)) {
    details.ratesUpdated = rates.length
    const firstRate = rates[0] as Record<string, unknown>
    if (firstRate) {
      const startDate = getString(firstRate.start_date)
      const endDate = getString(firstRate.end_date)
      details.dateRange = `${formatDate(startDate)} to ${formatDate(endDate)}`
      details.pricePerDay = formatCurrency(
        getNumber(firstRate.price_per_day),
        getString(firstRate.currency),
      )
      const minStay = getNumber(firstRate.min_stay)
      if (minStay) {
        details.minimumStay = `${minStay} nights`
      }
    }
  }

  return details
}

/**
 * Extract webhook details
 */
function extractWebhookDetails(
  data: ApiResponseData,
  inputParams?: ApiResponseData,
): ApiResponseData {
  const details: ApiResponseData = {}

  // Handle numeric webhook IDs
  details.webhookId = getStringOrNumber(data.id) || getStringOrNumber(data.webhookId)
  details.event = getString(inputParams?.event) || getString(data.event) || 'unknown'
  details.targetUrl =
    getString(inputParams?.target_url) || getString(data.targetUrl) || getString(data.url)
  details.status = getString(data.status) || 'active'

  const createdAt = getString(data.createdAt)
  if (createdAt) {
    details.createdAt = formatDate(createdAt, true)
  }

  return details
}

/**
 * Extract message details
 */
function extractMessageDetails(
  data: ApiResponseData,
  inputParams?: ApiResponseData,
): ApiResponseData {
  const details: ApiResponseData = {}

  // Handle both string GUIDs and numeric IDs
  details.threadId = getStringOrNumber(inputParams?.threadGuid) || getStringOrNumber(data.threadId)
  details.messageId = getStringOrNumber(data.id) || getStringOrNumber(data.messageId)
  details.recipient = getString(data.recipientName) || getString(data.recipient) || 'recipient'
  const messageContent = getString(getNestedValue(inputParams, 'message.content'))
  details.messageSent = messageContent
    ? `"${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`
    : 'message'

  const sentAt = getString(data.sentAt)
  if (sentAt) {
    details.sentAt = formatDate(sentAt, true)
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

  // Convert data to ApiResponseData format
  const apiData = (typeof data === 'object' && data !== null ? data : {}) as ApiResponseData

  // Extract details based on entity type
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
          getNumber(apiData.totalPrice) ||
            getNumber(getNestedValue(inputParams, 'payload.totalPrice')),
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
      timestamp: new Date().toISOString(),
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
