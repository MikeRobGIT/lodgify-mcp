/**
 * Availability API Client Module
 * Handles all availability-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type { Booking, BookingsListResponse } from '../bookings/types.js'
import type {
  AvailabilityCalendarResult,
  AvailabilityQueryParams,
  BookingPeriod,
  DateRangeAvailabilityResult,
  NextAvailabilityResult,
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
    return this.request<T>(
      'GET',
      propertyId,
      params ? { params: params as Record<string, unknown> } : {},
    )
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
   * Get the next available date for a property by analyzing bookings
   * Returns null if no availability found in the specified range
   */
  async getNextAvailableDate(
    propertyId: string,
    fromDate?: string,
    daysToCheck: number = 90,
  ): Promise<NextAvailabilityResult> {
    const startDate = fromDate || getTodayISO()
    const endDate = addDays(startDate, daysToCheck)

    // Get all bookings in the date range (without property filter to check if property exists)
    const bookingsData = (await this.request<BookingsListResponse>(
      'GET',
      '../reservations/bookings',
      {
        from: startDate,
        to: endDate,
      },
    )) as BookingsListResponse

    const bookings: Booking[] = bookingsData?.data || []

    // Filter and sort bookings for this property
    const propertyBookings = bookings
      .filter(
        (booking) =>
          booking.propertyId?.toString() === propertyId.toString() &&
          booking.status !== 'declined' &&
          booking.checkIn &&
          booking.checkOut,
      )
      .map((booking) => ({
        arrival: booking.checkIn,
        departure: booking.checkOut,
        status: booking.status as string,
        isBlocked: ['booked', 'tentative'].includes(booking.status),
      }))
      .sort((a: BookingPeriod, b: BookingPeriod) => compareDates(a.arrival, b.arrival))

    // If no bookings found for this property, check if property exists
    if (propertyBookings.length === 0) {
      // Only check property existence if there are other bookings in the system
      if (bookings.length > 0) {
        const propertyExists = bookings.some(
          (booking) => booking.propertyId?.toString() === propertyId.toString(),
        )

        if (!propertyExists) {
          // No bookings found for this property ID in a system that has other bookings
          return {
            nextAvailableDate: null,
            availableUntil: null,
            blockedPeriods: [],
            totalDaysAvailable: 0,
            message: `No booking data found for property ID ${propertyId}. Property may not exist or may not have any bookings in the system. Use lodgify_find_properties to discover available property IDs.`,
          }
        }
      }
      // If no bookings exist at all in the system, we cannot verify property existence
      // so we proceed with the assumption that no bookings = available
    }

    // Find the next available date
    let currentDate = startDate
    let nextAvailableDate: string | null = null
    let availableUntil: string | null = null

    while (compareDates(currentDate, endDate) <= 0) {
      // Check if current date is blocked by any booking
      const isBlocked = propertyBookings.some(
        (booking: BookingPeriod) =>
          booking.isBlocked && isDateInRange(currentDate, booking.arrival, booking.departure),
      )

      if (!isBlocked) {
        if (!nextAvailableDate) {
          nextAvailableDate = currentDate
        }
        // Find how long this availability period lasts
        let checkDate = currentDate
        while (compareDates(checkDate, endDate) <= 0) {
          const stillAvailable = !propertyBookings.some(
            (booking: BookingPeriod) =>
              booking.isBlocked && isDateInRange(checkDate, booking.arrival, booking.departure),
          )
          if (stillAvailable) {
            availableUntil = checkDate
            checkDate = addDays(checkDate, 1)
          } else {
            break
          }
        }
        break
      }

      currentDate = addDays(currentDate, 1)
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
      blockedPeriods: propertyBookings.filter((b: BookingPeriod) => b.isBlocked),
      totalDaysAvailable,
      message,
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

    // Get bookings that might overlap with the requested range
    const bookingsData = (await this.request<BookingsListResponse>(
      'GET',
      '../reservations/bookings',
      {
        propertyId,
        from: addDays(checkInDate, -1), // Check one day before to catch overlaps
        to: addDays(checkOutDate, 1), // Check one day after to catch overlaps
      },
    )) as BookingsListResponse

    const bookings: Booking[] = bookingsData?.data || []

    // Find conflicting bookings
    const conflictingBookings = bookings
      .filter(
        (booking) =>
          booking.propertyId?.toString() === propertyId.toString() &&
          booking.status !== 'declined' &&
          booking.checkIn &&
          booking.checkOut &&
          ['booked', 'tentative'].includes(booking.status),
      )
      .map((booking) => ({
        arrival: booking.checkIn,
        departure: booking.checkOut,
        status: booking.status,
        isBlocked: true,
      }))
      .filter((booking: BookingPeriod) => {
        // Check for date overlap: booking overlaps if it doesn't end before check-in or start after check-out
        return !(
          compareDates(booking.departure, checkInDate) <= 0 ||
          compareDates(booking.arrival, checkOutDate) >= 0
        )
      })

    const isAvailable = conflictingBookings.length === 0

    let message: string
    if (isAvailable) {
      const nights = daysBetween(checkInDate, checkOutDate)
      message = `Available for ${nights} nights from ${checkInDate} to ${checkOutDate}`
    } else {
      message = `Not available: ${conflictingBookings.length} conflicting booking(s) found`
    }

    return {
      isAvailable,
      conflictingBookings,
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

    // Get bookings for the date range
    const bookingsData = (await this.request<BookingsListResponse>(
      'GET',
      '../reservations/bookings',
      {
        propertyId,
        from: startDate,
        to: endDate,
      },
    )) as BookingsListResponse

    const bookings: Booking[] = bookingsData?.data || []

    // Create calendar array
    const calendar = []
    let availableDays = 0

    for (let i = 0; i < daysToShow; i++) {
      const currentDate = addDays(startDate, i)

      // Find if this date is blocked by any booking
      const blockingBooking = bookings.find(
        (booking) =>
          booking.propertyId?.toString() === propertyId.toString() &&
          booking.status !== 'declined' &&
          booking.checkIn &&
          booking.checkOut &&
          ['booked', 'confirmed', 'tentative'].includes(booking.status) &&
          isDateInRange(currentDate, booking.checkIn, booking.checkOut),
      )

      const isAvailable = !blockingBooking
      if (isAvailable) availableDays++

      calendar.push({
        date: currentDate,
        isAvailable,
        bookingStatus: blockingBooking?.status,
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
  }
}

// Export date utility functions for testing
export { addDays, compareDates, daysBetween, getTodayISO, isDateInRange, isValidDateISO }
