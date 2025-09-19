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
export function extractBookingDetails(
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
    details.status = formatStatus(status)
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
export function extractPaymentLinkDetails(
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
export function extractRateDetails(
  data: ApiResponseData,
  inputParams?: ApiResponseData,
): ApiResponseData {
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
export function extractWebhookDetails(
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
 * Extract vacant inventory details
 */
export function extractVacantInventoryDetails(
  data: ApiResponseData,
  inputParams?: ApiResponseData,
): ApiResponseData {
  const details: ApiResponseData = {}

  // Date range
  const from = getString(data.from) || getString(inputParams?.from)
  const to = getString(data.to) || getString(inputParams?.to)
  if (from && to) {
    details.dateRange = `${formatDate(from)} to ${formatDate(to)}`
    details.from = formatDate(from)
    details.to = formatDate(to)
  }

  // Counts
  const counts = getNestedValue(data, 'counts') as Record<string, number> | undefined
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
  const properties = getNestedValue(data, 'properties') as VacantInventoryProperty[] | undefined
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
  const diagnostics = getNestedValue(data, 'diagnostics') as Record<string, unknown> | undefined
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
  const propertyIds = inputParams?.propertyIds as unknown[] | undefined
  if (Array.isArray(propertyIds) && propertyIds.length > 0) {
    details.filteredByPropertyIds = propertyIds.length
  }
  const includeRooms = inputParams?.includeRooms
  if (includeRooms !== undefined) {
    details.roomDetailsRequested = includeRooms === true
  }

  return details
}

/**
 * Extract message details
 */
export function extractMessageDetails(
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
