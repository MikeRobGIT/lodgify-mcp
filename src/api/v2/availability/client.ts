/**
 * Availability API Client Module
 * Handles all availability-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type {
  AvailabilityCalendarResult,
  AvailabilityQueryParams,
  BookingPeriod,
  DateRangeAvailabilityResult,
  NextAvailabilityResult,
  PropertyAvailabilityResult,
  PropertyAvailabilityUpdatePayload,
} from './types.js'

/**
 * Date Utility Functions
 */

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Add days to a date and return in ISO format (YYYY-MM-DD)
 */
function addDays(date: string, days: number): string {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result.toISOString().split('T')[0]
}

/**
 * Check if a date string is valid and in YYYY-MM-DD format
 */
function isValidDateISO(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false
  }
  const date = new Date(dateString)
  return (
    date instanceof Date &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().split('T')[0] === dateString
  )
}

/**
 * Compare two date strings (YYYY-MM-DD format)
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
function compareDates(date1: string, date2: string): number {
  if (date1 < date2) return -1
  if (date1 > date2) return 1
  return 0
}

/**
 * Check if date is within a range (inclusive start, exclusive end for hotel bookings)
 */
function isDateInRange(date: string, startDate: string, endDate: string): boolean {
  return compareDates(date, startDate) >= 0 && compareDates(date, endDate) < 0
}

/**
 * Calculate the number of days between two dates
 */
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const timeDiff = end.getTime() - start.getTime()
  return Math.ceil(timeDiff / (1000 * 3600 * 24))
}

/**
 * Availability API Client
 * Manages property availability, booking conflicts, and calendar operations
 */
export class AvailabilityClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'availability',
      version: 'v2',
      basePath: 'availability',
    }
    super(client, config)
  }

  /**
   * Get all availabilities for the calling user
   * GET /v2/availability
   */
  async getAvailabilityAll<T = unknown>(params?: AvailabilityQueryParams): Promise<T> {
    return this.request<T>('GET', '', params ? { params: params as Record<string, unknown> } : {})
  }

  /**
   * Get availability for a specific property
   * GET /v2/availability/{propertyId}
   */
  async getAvailabilityForProperty<T = unknown>(
    propertyId: string,
    params?: AvailabilityQueryParams,
  ): Promise<T> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }

    // Convert from/to parameters to start/end for the availability API
    const apiParams: Record<string, unknown> = {}

    if (params?.from) {
      // Convert YYYY-MM-DD to ISO date-time format if needed
      apiParams.start = params.from.includes('T') ? params.from : `${params.from}T00:00:00Z`
    }

    if (params?.to) {
      // Convert YYYY-MM-DD to ISO date-time format if needed
      apiParams.end = params.to.includes('T') ? params.to : `${params.to}T23:59:59Z`
    }

    // Add includeDetails to get booking information when available
    if (params?.from && params?.to) {
      apiParams.includeDetails = true
    }

    return this.request<T>('GET', propertyId, { params: apiParams })
  }

  /**
   * Get availability for a specific room type
   * GET /v2/availability/{propertyId}/{roomTypeId}
   */
  async getAvailabilityForRoom<T = unknown>(
    propertyId: string,
    roomTypeId: string,
    params?: AvailabilityQueryParams,
  ): Promise<T> {
    if (!propertyId || !roomTypeId) {
      throw new Error('Property ID and Room Type ID are required')
    }
    return this.request<T>(
      'GET',
      `${propertyId}/${roomTypeId}`,
      params ? { params: params as Record<string, unknown> } : {},
    )
  }

  /**
   * Update property availability settings
   * PUT /v2/properties/{propertyId}/availability
   */
  async updatePropertyAvailability(
    propertyId: string,
    payload: PropertyAvailabilityUpdatePayload,
  ): Promise<void> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }

    // This endpoint is on the properties resource, so we need to construct the full path
    return this.request<void>('PUT', `../properties/${propertyId}/availability`, {
      body: payload,
    })
  }

  /**
   * Get the next available date for a property by analyzing availability data
   * Returns null if no availability found in the specified range
   */
  async getNextAvailableDate(
    propertyId: string,
    fromDate?: string,
    daysToCheck: number = 90,
  ): Promise<NextAvailabilityResult> {
    const startDate = fromDate || getTodayISO()
    const endDate = addDays(startDate, daysToCheck)

    try {
      // Use the availability API to get structured availability data
      const availabilityData = (await this.request<PropertyAvailabilityResult[]>(
        'GET',
        propertyId,
        {
          params: {
            start: `${startDate}T00:00:00Z`,
            end: `${endDate}T23:59:59Z`,
            includeDetails: true, // Include booking details
          },
        },
      )) as PropertyAvailabilityResult[]

      const availabilityResult = Array.isArray(availabilityData)
        ? availabilityData[0]
        : availabilityData

      if (
        !availabilityResult ||
        !availabilityResult.periods ||
        availabilityResult.periods.length === 0
      ) {
        return {
          nextAvailableDate: null,
          availableUntil: null,
          blockedPeriods: [],
          totalDaysAvailable: 0,
          message: `No availability data found for property ID ${propertyId}. Property may not exist.`,
        }
      }

      // Sort periods by start date
      const sortedPeriods = availabilityResult.periods.sort((a, b) =>
        compareDates(a.start, b.start),
      )

      let nextAvailableDate: string | null = null
      let availableUntil: string | null = null
      const blockedPeriods: BookingPeriod[] = []

      // Extract all blocked bookings for reporting
      for (const period of sortedPeriods) {
        if (period.available === 0 && period.bookings) {
          const periodBookings = period.bookings.map((booking) => ({
            arrival: booking.arrival,
            departure: booking.departure,
            status: booking.status || 'booked',
            isBlocked: true,
          }))
          blockedPeriods.push(...periodBookings)
        }
      }

      // Find the first available period
      for (const period of sortedPeriods) {
        if (period.available === 1) {
          // Convert period start/end to YYYY-MM-DD format
          nextAvailableDate = period.start.split('T')[0]
          availableUntil = period.end.split('T')[0]

          // Adjust to ensure we don't go beyond our check range
          if (compareDates(nextAvailableDate, startDate) < 0) {
            nextAvailableDate = startDate
          }
          if (compareDates(availableUntil, endDate) > 0) {
            availableUntil = endDate
          }
          break
        }
      }

      const totalDaysAvailable =
        nextAvailableDate && availableUntil ? daysBetween(nextAvailableDate, availableUntil) + 1 : 0

      let message: string
      if (nextAvailableDate) {
        if (availableUntil && compareDates(nextAvailableDate, availableUntil) < 0) {
          message = `Available from ${nextAvailableDate} to ${availableUntil} (${totalDaysAvailable} days)`
        } else {
          message = `Available starting ${nextAvailableDate}`
        }
      } else {
        message = `No availability found in the next ${daysToCheck} days`
      }

      return {
        nextAvailableDate,
        availableUntil,
        blockedPeriods,
        totalDaysAvailable,
        message,
      }
    } catch (_error) {
      // If availability API fails, return appropriate message
      return {
        nextAvailableDate: null,
        availableUntil: null,
        blockedPeriods: [],
        totalDaysAvailable: 0,
        message: `Unable to check availability for property ID ${propertyId}. Property may not exist or API error occurred.`,
      }
    }
  }

  /**
   * Check if a specific date range is available for a property
   */
  async checkDateRangeAvailability(
    propertyId: string,
    checkInDate: string,
    checkOutDate: string,
  ): Promise<DateRangeAvailabilityResult> {
    // Validate dates
    if (!isValidDateISO(checkInDate) || !isValidDateISO(checkOutDate)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD')
    }

    if (compareDates(checkInDate, checkOutDate) >= 0) {
      throw new Error('Check-in date must be before check-out date')
    }

    // Use the proper availability API endpoint with correct parameters
    const availabilityData = (await this.request<PropertyAvailabilityResult[]>('GET', propertyId, {
      params: {
        start: `${checkInDate}T00:00:00Z`, // Convert to ISO date-time format
        end: `${checkOutDate}T23:59:59Z`, // Convert to ISO date-time format
        includeDetails: true, // Include booking status details
      },
    })) as PropertyAvailabilityResult[]

    const availabilityResult = Array.isArray(availabilityData)
      ? availabilityData[0]
      : availabilityData

    if (!availabilityResult || !availabilityResult.periods) {
      throw new Error('No availability data returned for property')
    }

    // Check availability across all periods that overlap with our date range
    const relevantPeriods = availabilityResult.periods.filter((period) => {
      // Check if period overlaps with our requested range
      return !(
        compareDates(period.end, checkInDate) <= 0 || compareDates(period.start, checkOutDate) >= 0
      )
    })

    // Determine if the entire requested range is available
    let isAvailable = true
    const conflictingBookings: BookingPeriod[] = []

    for (const period of relevantPeriods) {
      if (period.available === 0) {
        isAvailable = false

        // Extract conflicting bookings from the period
        if (period.bookings) {
          const periodBookings = period.bookings
            .filter((booking) => {
              // Check if booking overlaps with our requested range
              return !(
                compareDates(booking.departure, checkInDate) <= 0 ||
                compareDates(booking.arrival, checkOutDate) >= 0
              )
            })
            .map((booking) => ({
              arrival: booking.arrival,
              departure: booking.departure,
              status: booking.status || 'booked',
              isBlocked: true,
            }))

          conflictingBookings.push(...periodBookings)
        }
      }
    }

    // Remove duplicate bookings (in case they appear in multiple periods)
    const uniqueConflictingBookings = conflictingBookings.filter(
      (booking, index, self) =>
        index ===
        self.findIndex((b) => b.arrival === booking.arrival && b.departure === booking.departure),
    )

    let message: string
    if (isAvailable) {
      const nights = daysBetween(checkInDate, checkOutDate)
      message = `Available for ${nights} nights from ${checkInDate} to ${checkOutDate}`
    } else {
      message = `Not available: ${uniqueConflictingBookings.length} conflicting booking(s) found`
    }

    return {
      isAvailable,
      conflictingBookings: uniqueConflictingBookings,
      message,
    }
  }

  /**
   * Get an availability calendar for a property showing blocked and available periods
   */
  async getAvailabilityCalendar(
    propertyId: string,
    fromDate?: string,
    daysToShow: number = 30,
  ): Promise<AvailabilityCalendarResult> {
    const startDate = fromDate || getTodayISO()
    const endDate = addDays(startDate, daysToShow - 1)
    const today = getTodayISO()

    try {
      // Use the availability API to get structured availability data
      const availabilityData = (await this.request<PropertyAvailabilityResult[]>(
        'GET',
        propertyId,
        {
          params: {
            start: `${startDate}T00:00:00Z`,
            end: `${endDate}T23:59:59Z`,
            includeDetails: true, // Include booking status details
          },
        },
      )) as PropertyAvailabilityResult[]

      const availabilityResult = Array.isArray(availabilityData)
        ? availabilityData[0]
        : availabilityData

      if (!availabilityResult || !availabilityResult.periods) {
        throw new Error('No availability data returned for property')
      }

      // Create calendar array
      const calendar = []
      let availableDays = 0

      for (let i = 0; i < daysToShow; i++) {
        const currentDate = addDays(startDate, i)

        // Find which availability period covers this date
        const coveringPeriod = availabilityResult.periods.find((period) => {
          const periodStart = period.start.split('T')[0]
          const periodEnd = period.end.split('T')[0]
          return (
            compareDates(currentDate, periodStart) >= 0 && compareDates(currentDate, periodEnd) < 0
          )
        })

        const isAvailable = coveringPeriod ? coveringPeriod.available === 1 : true // Default to available if no period data

        // Find booking status if not available
        let bookingStatus: string | undefined
        if (!isAvailable && coveringPeriod?.bookings) {
          const relevantBooking = coveringPeriod.bookings.find((booking) =>
            isDateInRange(currentDate, booking.arrival, booking.departure),
          )
          bookingStatus = relevantBooking?.status || undefined
        }

        if (isAvailable) availableDays++

        calendar.push({
          date: currentDate,
          isAvailable,
          bookingStatus,
          isToday: currentDate === today,
        })
      }

      const blockedDays = daysToShow - availableDays
      const availabilityRate = Math.round((availableDays / daysToShow) * 100)

      return {
        calendar,
        summary: {
          totalDays: daysToShow,
          availableDays,
          blockedDays,
          availabilityRate,
        },
      }
    } catch (_error) {
      // Fallback: create calendar with all days showing as unavailable if API fails
      const calendar = []
      for (let i = 0; i < daysToShow; i++) {
        const currentDate = addDays(startDate, i)
        calendar.push({
          date: currentDate,
          isAvailable: false,
          bookingStatus: 'unknown',
          isToday: currentDate === today,
        })
      }

      return {
        calendar,
        summary: {
          totalDays: daysToShow,
          availableDays: 0,
          blockedDays: daysToShow,
          availabilityRate: 0,
        },
      }
    }
  }
}

// Export date utility functions for testing
export { addDays, compareDates, daysBetween, getTodayISO, isDateInRange, isValidDateISO }
