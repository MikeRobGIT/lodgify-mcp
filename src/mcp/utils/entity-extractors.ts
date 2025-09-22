/**
 * Entity extraction functions for Response Enhancer
 */

import { formatCurrency } from './currency-formatter.js'
import { calculateNights, formatDate } from './date/formatter.js'
import { formatStatus, getNestedValue, getNumber, getString, getStringOrNumber } from './helpers.js'
import type { ApiResponseData } from './response/types.js'

/**
 * Extract booking details from response
 */
export function extractBookingDetails(data: unknown, inputParams?: unknown): ApiResponseData {
  const details: ApiResponseData = {}

  // Cast to ApiResponseData for internal use
  const responseData = data as ApiResponseData
  const params = inputParams as ApiResponseData

  // Handle both response formats (with 'id' or specific fields)
  // Use getStringOrNumber for IDs since API returns numeric IDs
  details.bookingId =
    getStringOrNumber(responseData?.id) ||
    getStringOrNumber(responseData?.bookingId) ||
    getStringOrNumber(responseData?.booking_id) ||
    getStringOrNumber(params?.id) ||
    getStringOrNumber(params?.bookingId) // Also check for bookingId in inputParams (used by quote creation)
  details.guest =
    getString(responseData?.guest_name) ||
    getString(responseData?.guestName) ||
    getString(params?.guest_name) ||
    'Guest'
  details.guestEmail =
    getString(responseData?.guest_email) ||
    getString(responseData?.guestEmail) ||
    getString(params?.guest_email)

  const propertyName =
    getString(responseData?.propertyName) || getString(responseData?.property_name)
  const propertyId =
    getStringOrNumber(responseData?.property_id) ||
    getStringOrNumber(responseData?.propertyId) ||
    getStringOrNumber(params?.property_id)
  details.property = propertyName || (propertyId ? `Property ${propertyId}` : 'Property')
  details.propertyId = propertyId

  // Format dates
  const checkIn =
    getString(responseData?.arrival) ||
    getString(responseData?.checkIn) ||
    getString(params?.arrival)
  const checkOut =
    getString(responseData?.departure) ||
    getString(responseData?.checkOut) ||
    getString(params?.departure)

  if (checkIn) details.checkIn = formatDate(checkIn)
  if (checkOut) details.checkOut = formatDate(checkOut)
  if (checkIn && checkOut) {
    details.nights = calculateNights(checkIn, checkOut)
  }

  // Guest counts
  const adults = getNumber(responseData?.adults) || getNumber(params?.adults)
  const children = getNumber(responseData?.children) || getNumber(params?.children) || 0
  const infants = getNumber(responseData?.infants) || getNumber(params?.infants) || 0
  const totalGuests = (adults || 0) + children + infants

  if (totalGuests > 0) {
    details.totalGuests = totalGuests
    if (adults) details.adults = adults
    if (children > 0) details.children = children
    if (infants > 0) details.infants = infants
  }

  // Financial details
  const amount = getNumber(responseData?.amount) || getNumber(responseData?.totalAmount)
  const currency = getString(responseData?.currency)
  if (amount !== undefined) {
    details.amount = formatCurrency(amount, currency)
  }

  // Status
  const status = getString(responseData?.status)
  if (status) {
    details.status = formatStatus(status)
  }

  // Room details
  const roomTypeId =
    getStringOrNumber(responseData?.room_type_id) || getStringOrNumber(params?.room_type_id)
  if (roomTypeId) {
    details.roomTypeId = roomTypeId
  }

  return details
}

/**
 * Extract payment link details
 */
export function extractPaymentLinkDetails(data: unknown, inputParams?: unknown): ApiResponseData {
  const details: ApiResponseData = {}

  // Cast to ApiResponseData for internal use
  const responseData = data as ApiResponseData
  const params = inputParams as ApiResponseData

  // Handle numeric booking IDs
  details.bookingId = getStringOrNumber(params?.id) || getStringOrNumber(responseData?.bookingId)
  const payloadAmount = getNumber(getNestedValue(params, 'payload.amount'))
  const payloadCurrency = getString(getNestedValue(params, 'payload.currency'))
  details.amount = formatCurrency(
    getNumber(responseData?.amount) || payloadAmount,
    getString(responseData?.currency) || payloadCurrency,
  )
  details.currency = getString(responseData?.currency) || payloadCurrency || 'USD'

  const paymentUrl = getString(responseData?.paymentUrl) || getString(responseData?.url)
  if (paymentUrl) {
    details.paymentUrl = paymentUrl
  }

  const expiresAt = getString(responseData?.expiresAt) || getString(responseData?.validUntil)
  if (expiresAt) {
    details.expiresAt = formatDate(expiresAt, true)
  }

  const payloadDescription = getString(getNestedValue(params, 'payload.description'))
  details.description =
    getString(responseData?.description) || payloadDescription || 'Payment for booking'

  return details
}

/**
 * Extract rate details
 */
export function extractRateDetails(data: unknown, inputParams?: unknown): ApiResponseData {
  const details: ApiResponseData = {}

  // Cast to ApiResponseData for internal use
  const responseData = data as ApiResponseData
  const params = inputParams as ApiResponseData

  // Handle numeric property IDs
  const propertyId =
    getStringOrNumber(params?.property_id) ||
    (responseData ? getStringOrNumber(responseData.propertyId) : undefined)
  details.property = propertyId ? `Property ${propertyId}` : 'Property'

  const rates = params?.rates
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
export function extractWebhookDetails(data: unknown, inputParams?: unknown): ApiResponseData {
  const details: ApiResponseData = {}

  // Cast to ApiResponseData for internal use
  const responseData = data as ApiResponseData
  const params = inputParams as ApiResponseData

  // Handle numeric webhook IDs
  details.webhookId =
    getStringOrNumber(responseData?.id) || getStringOrNumber(responseData?.webhookId)
  details.event = getString(params?.event) || getString(responseData?.event) || 'unknown'
  details.targetUrl =
    getString(params?.target_url) ||
    getString(responseData?.targetUrl) ||
    getString(responseData?.url)
  details.status = getString(responseData?.status) || 'active'

  const createdAt = getString(responseData?.createdAt)
  if (createdAt) {
    details.createdAt = formatDate(createdAt, true)
  }

  return details
}

/**
 * Extract vacant inventory details
 */
export function extractVacantInventoryDetails(
  data: unknown,
  inputParams?: unknown,
): ApiResponseData {
  const details: ApiResponseData = {}

  // Cast to ApiResponseData for internal use
  const responseData = data as ApiResponseData
  const params = inputParams as ApiResponseData

  // Date range
  const from = getString(responseData?.from) || getString(params?.from)
  const to = getString(responseData?.to) || getString(params?.to)
  if (from && to) {
    details.dateRange = `${formatDate(from)} to ${formatDate(to)}`
    details.from = formatDate(from)
    details.to = formatDate(to)
  }

  // Counts
  const counts = getNestedValue(responseData, 'counts') as Record<string, number> | undefined
  if (counts) {
    if (counts.propertiesRequested !== undefined) {
      details.propertiesRequested = counts.propertiesRequested
    }
    if (counts.propertiesFound !== undefined) {
      details.propertiesFound = counts.propertiesFound
    }
    if (counts.propertiesChecked !== undefined) {
      details.propertiesChecked = counts.propertiesChecked
    }
    if (counts.availableProperties !== undefined) {
      details.availableProperties = counts.availableProperties
      details.vacantCount = counts.availableProperties // Alias for clarity
    }
  }

  // Define types for vacant inventory properties and rooms
  type VacantInventoryProperty = {
    available?: boolean
    rooms?: Array<{ available?: boolean }>
  }

  // Properties list
  const properties = getNestedValue(responseData, 'properties') as
    | VacantInventoryProperty[]
    | undefined
  if (Array.isArray(properties)) {
    details.propertiesReturned = properties.length

    // Count available properties if not provided in counts
    if (details.vacantCount === undefined) {
      const availableProps = properties.filter((p) => p.available === true)
      details.vacantCount = availableProps.length
    }

    // Include rooms information if available
    const hasRooms = properties.some((p) => p.rooms && Array.isArray(p.rooms))
    if (hasRooms) {
      details.includesRoomDetails = true
      let totalRooms = 0
      let availableRooms = 0
      properties.forEach((p) => {
        if (p.rooms && Array.isArray(p.rooms)) {
          totalRooms += p.rooms.length
          availableRooms += p.rooms.filter((r) => r.available === true).length
        }
      })
      if (totalRooms > 0) {
        details.totalRooms = totalRooms
        details.availableRooms = availableRooms
      }
    }
  }

  // Diagnostics if available
  const diagnostics = getNestedValue(responseData, 'diagnostics') as
    | Record<string, unknown>
    | undefined
  if (diagnostics) {
    details.hasDiagnostics = true
    const apiCalls = diagnostics.apiCalls as unknown[] | undefined
    if (Array.isArray(apiCalls)) {
      details.apiCallsCount = apiCalls.length
    }
    const possibleIssues = diagnostics.possibleIssues as string[] | undefined
    if (Array.isArray(possibleIssues) && possibleIssues.length > 0) {
      details.issuesIdentified = possibleIssues.length
    }
  }

  // Search filters
  const propertyIds = params?.propertyIds as unknown[] | undefined
  if (Array.isArray(propertyIds) && propertyIds.length > 0) {
    details.filteredByPropertyIds = propertyIds.length
  }
  const includeRooms = params?.includeRooms
  if (includeRooms !== undefined) {
    details.roomDetailsRequested = includeRooms === true
  }

  return details
}

/**
 * Extract message details
 */
export function extractMessageDetails(data: unknown, inputParams?: unknown): ApiResponseData {
  const details: ApiResponseData = {}

  // Cast to ApiResponseData for internal use
  const responseData = data as ApiResponseData
  const params = inputParams as ApiResponseData

  // Handle both string GUIDs and numeric IDs
  details.threadId =
    getStringOrNumber(params?.threadGuid) || getStringOrNumber(responseData?.threadId)
  details.messageId =
    getStringOrNumber(responseData?.id) || getStringOrNumber(responseData?.messageId)
  details.recipient =
    getString(responseData?.recipientName) || getString(responseData?.recipient) || 'recipient'
  const messageContent = getString(getNestedValue(params, 'message.content'))
  details.messageSent = messageContent
    ? `"${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`
    : 'message'

  const sentAt = getString(responseData?.sentAt)
  if (sentAt) {
    details.sentAt = formatDate(sentAt, true)
  }

  return details
}
